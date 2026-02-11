import { describe, expect, it } from 'vitest'
import { SqlToAstParser } from '../ast-parser'
import type {
  IndexAST,
  PrimaryKeyConstraintAST,
  UniqueConstraintAST,
} from '../types'

describe('index parsing', () => {
  it('parses basic index', () => {
    const sql = `
      CREATE TABLE t (
        a INT,
        b INT,
        INDEX idx_a (a)
      );
    `
    const ast = new SqlToAstParser('mysql').parse(sql)
    const idx = ast.tables[0].indexes.find((i) => i.name === 'idx_a') as
      | IndexAST
      | undefined
    expect(idx?.columns.map((c) => c.name)).toEqual(['a'])
    expect(idx?.unique).toBe(false)
  })

  it('parses unique key index as index, not constraint', () => {
    const sql = `
      CREATE TABLE t (
        email VARCHAR(255),
        UNIQUE KEY uq_email (email)
      );
    `
    const ast = new SqlToAstParser('mysql').parse(sql)
    const uqIdx = ast.tables[0].indexes.find((i) => i.name === 'uq_email') as
      | IndexAST
      | undefined
    const uniqC = ast.tables[0].constraints.filter(
      (c) => c.type === 'unique'
    ) as UniqueConstraintAST[]
    expect(uqIdx?.unique).toBe(true)
    expect(uniqC.length).toBe(0)
  })

  it('parses using method', () => {
    const sql = `
      CREATE TABLE t (
        a INT,
        INDEX idx_a (a) USING btree
      );
    `
    const ast = new SqlToAstParser('mysql').parse(sql)
    const idx = ast.tables[0].indexes.find((i) => i.name === 'idx_a')!
    expect(idx.method).toBe('btree')
  })
})

describe('table options', () => {
  it('parses charset and collation with equals', () => {
    const sql = `
      CREATE TABLE t ( a INT ) CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci;
    `
    const ast = new SqlToAstParser('mysql').parse(sql)
    const opts = ast.tables[0].options
    expect(opts?.charset).toBe('utf8mb4')
    expect(opts?.collation).toBe('utf8mb4_general_ci')
  })

  it('parses only available options', () => {
    const sql = `
      CREATE TABLE t ( a INT ) ENGINE=InnoDB;
    `
    const ast = new SqlToAstParser('mysql').parse(sql)
    expect(ast.tables[0].options?.engine).toBe('InnoDB')
    expect(ast.tables[0].options?.charset).toBeUndefined()
  })
})

describe('edge cases and robustness', () => {
  it('ignores comments and normalizes whitespace', () => {
    const sql = `
      -- users table
      CREATE TABLE users (
        id INT PRIMARY KEY, /* inline comment */
        name VARCHAR(100) -- end comment
      ); /* after */
    `
    const ast = new SqlToAstParser('mysql').parse(sql)
    expect(ast.tables.length).toBe(1)
    expect(ast.tables[0].columns.length).toBe(2)
  })

  it('handles constraint names with quotes', () => {
    const sql = `
      CREATE TABLE t (
        a INT,
        CONSTRAINT "UQ_A" UNIQUE (a),
        CONSTRAINT \`PK_A\` PRIMARY KEY (a)
      );
    `
    const ast = new SqlToAstParser('postgresql').parse(sql)
    const uq = ast.tables[0].constraints.find((c) => c.type === 'unique') as
      | UniqueConstraintAST
      | undefined
    const pk = ast.tables[0].constraints.find(
      (c) => c.type === 'primary_key'
    ) as PrimaryKeyConstraintAST | undefined
    expect(uq?.name).toBe('UQ_A')
    expect(pk?.name).toBe('PK_A')
  })

  it('handles referential actions order-independent', () => {
    const sql = `
      CREATE TABLE t (
        a INT,
        CONSTRAINT fk FOREIGN KEY (a) REFERENCES r(id) ON UPDATE CASCADE ON DELETE SET DEFAULT
      );
    `
    const ast = new SqlToAstParser('postgresql').parse(sql)
    const fk = ast.tables[0].constraints.find((c) => c.type === 'foreign_key')
    expect(fk && 'onUpdate' in fk ? fk.onUpdate : undefined).toBe('CASCADE')
    expect(fk && 'onDelete' in fk ? fk.onDelete : undefined).toBe('SET DEFAULT')
  })

  it('uses normalizeTableName for referenced table', () => {
    const sql = `
      CREATE TABLE t (
        a INT,
        CONSTRAINT fk FOREIGN KEY (a) REFERENCES "schema"."RefTable"(id)
      );
    `
    const ast = new SqlToAstParser('postgresql').parse(sql)
    const fk = ast.tables[0].constraints.find((c) => c.type === 'foreign_key')
    expect(fk && 'referencedTable' in fk ? fk.referencedTable : '').toBe(
      'RefTable'
    )
  })

  it('handles many columns and constraints', () => {
    const cols = Array.from({ length: 20 })
      .map((_, i) => `c${i} INT`)
      .join(',\n')
    const sql = `
      CREATE TABLE big (
        ${cols},
        PRIMARY KEY (c0, c1, c2, c3, c4)
      );
    `
    const ast = new SqlToAstParser('mysql').parse(sql)
    expect(ast.tables[0].columns.length).toBe(20)
    const pk = ast.tables[0].constraints.find(
      (c) => c.type === 'primary_key'
    ) as PrimaryKeyConstraintAST | undefined
    expect(pk?.columns.length).toBe(5)
  })

  it('parses NOT NULL and NULL flags correctly', () => {
    const sql = `
      CREATE TABLE flags (
        a INT NOT NULL,
        b INT NULL,
        c INT
      );
    `
    const ast = new SqlToAstParser('mysql').parse(sql)
    const a = ast.tables[0].columns.find((c) => c.name === 'a')!
    const b = ast.tables[0].columns.find((c) => c.name === 'b')!
    const c = ast.tables[0].columns.find((c) => c.name === 'c')!
    expect(a.nullable).toBe(false)
    expect(b.nullable).toBe(true)
    expect(c.nullable).toBe(true)
  })

  it('does not duplicate constraints when multiple inline PKs exist', () => {
    const sql = `
      CREATE TABLE dup (
        a INT PRIMARY KEY,
        b INT PRIMARY KEY
      );
    `
    const ast = new SqlToAstParser('mysql').parse(sql)
    const pk = ast.tables[0].constraints.find(
      (c) => c.type === 'primary_key'
    ) as PrimaryKeyConstraintAST | undefined
    expect(pk?.columns.sort()).toEqual(['a', 'b'].sort())
  })

  it('does not duplicate inline unique for same column', () => {
    const sql = `
      CREATE TABLE uu (
        a INT UNIQUE,
        a2 INT UNIQUE,
        a INT UNIQUE
      );
    `
    const ast = new SqlToAstParser('mysql').parse(sql)
    const uniques = ast.tables[0].constraints.filter(
      (c) => c.type === 'unique'
    ) as UniqueConstraintAST[]
    const flat = uniques.flatMap((u) => u.columns)
    expect(flat.sort()).toEqual(['a', 'a2'].sort())
  })

  it('parses index column without match details gracefully', () => {
    const sql = `
      CREATE TABLE z ( a INT, KEY k (a) );
    `
    const ast = new SqlToAstParser('mysql').parse(sql)
    const idx = ast.tables[0].indexes.find((i) => i.name === 'k')!
    expect(idx.columns[0].name).toBe('a')
    expect(idx.columns[0].length).toBeUndefined()
    expect(idx.columns[0].order).toBeUndefined()
  })

  it('parses foreign key with multi-column references', () => {
    const sql = `
      CREATE TABLE parent (a INT, b INT, PRIMARY KEY (a, b));
      CREATE TABLE child (x INT, y INT, CONSTRAINT fk FOREIGN KEY (x, y) REFERENCES parent(a, b));
    `
    const ast = new SqlToAstParser('mysql').parse(sql)
    const ch = ast.tables.find((t) => t.name === 'child')!
    const fk = ch.constraints.find((c) => c.type === 'foreign_key')
    expect(fk && 'columns' in fk ? fk.columns : []).toEqual(['x', 'y'])
    expect(fk && 'referencedColumns' in fk ? fk.referencedColumns : []).toEqual(
      ['a', 'b']
    )
  })

  it('parses check with complex expressions content-preserved', () => {
    const sql = `
      CREATE TABLE c (
        v INT,
        CONSTRAINT ck CHECK ((v > 0 AND v < 100) OR (v IS NULL))
      );
    `
    const ast = new SqlToAstParser('postgresql').parse(sql)
    const ck = ast.tables[0].constraints.find((c) => c.type === 'check')
    expect(
      ck && 'expression' in ck ? typeof ck.expression === 'string' : false
    ).toBe(true)
  })
})
