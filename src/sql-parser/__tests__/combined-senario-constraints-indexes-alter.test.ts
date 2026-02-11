import { describe, expect, it } from 'vitest'
import { SqlToAstParser } from '../ast-parser'
import type {
  CheckConstraintAST,
  ForeignKeyConstraintAST,
  IndexAST,
  PrimaryKeyConstraintAST,
  UniqueConstraintAST,
} from '../types'

describe('combined-senario: constraints + indexes + alter + options + quoting', () => {
  it('adds indexes and uniques via ALTER to existing tables', () => {
    const sql = `
      CREATE TABLE t ( a INT, b INT, c INT );
      ALTER TABLE t ADD INDEX i_a (a), ADD CONSTRAINT uq_b UNIQUE (b), ADD INDEX i_c (c) USING btree;
    `
    const ast = new SqlToAstParser('mysql').parse(sql)
    const t = ast.tables[0]
    expect(t.indexes.map((i) => i.name).sort()).toEqual(['i_a', 'i_c'].sort())
    const uq = t.constraints.find((c) => c.type === 'unique') as
      | UniqueConstraintAST
      | undefined
    expect(uq?.columns).toEqual(['b'])
    const ic = t.indexes.find((i) => i.name === 'i_c') as IndexAST | undefined
    expect(ic?.method).toBe('btree')
  })

  it('composite PK and FK across multiple tables with actions', () => {
    const sql = `
      CREATE TABLE parents (
        a INT, b INT,
        PRIMARY KEY (a, b)
      );
      CREATE TABLE children (
        x INT, y INT,
        CONSTRAINT fk1 FOREIGN KEY (x, y) REFERENCES parents(a, b) ON DELETE CASCADE ON UPDATE NO ACTION
      );
    `
    const ast = new SqlToAstParser('postgresql').parse(sql)
    const p = ast.tables.find((t) => t.name === 'parents')!
    const pk = p.constraints.find((c) => c.type === 'primary_key') as
      | PrimaryKeyConstraintAST
      | undefined
    expect(pk?.columns).toEqual(['a', 'b'])
    const c = ast.tables.find((t) => t.name === 'children')!
    const fk = c.constraints.find((cn) => cn.type === 'foreign_key') as
      | ForeignKeyConstraintAST
      | undefined
    expect(fk?.columns).toEqual(['x', 'y'])
    expect(fk?.referencedTable).toBe('parents')
    expect(fk?.onDelete).toBe('CASCADE')
    expect(fk?.onUpdate).toBe('NO ACTION')
  })

  it('dedupes inline unique for same column', () => {
    const sql = `
      CREATE TABLE u (
        email VARCHAR(200) UNIQUE,
        email VARCHAR(200) UNIQUE
      );
    `
    const ast = new SqlToAstParser('mysql').parse(sql)
    const uniques = ast.tables[0].constraints.filter(
      (c) => c.type === 'unique'
    ) as UniqueConstraintAST[]
    expect(uniques.length).toBe(1)
    expect(uniques[0].columns).toEqual(['email'])
  })

  it('CHECK constraints with complex expressions preserved', () => {
    const sql = `
      CREATE TABLE ck (
        v INT,
        CHECK (((v + 1) > 0) AND (v % 2 = 0)),
        CONSTRAINT c2 CHECK ((v IS NULL) OR (v BETWEEN 1 AND 9))
      );
    `
    const ast = new SqlToAstParser('postgresql').parse(sql)
    const checks = ast.tables[0].constraints.filter(
      (c) => c.type === 'check'
    ) as CheckConstraintAST[]
    expect(checks.length).toBe(2)
    expect(typeof checks[0].expression).toBe('string')
    expect(checks[1].name).toBe('c2')
  })

  it('default values matrix types', () => {
    const sql = `
      CREATE TABLE d (
        a INT DEFAULT 0,
        b TEXT DEFAULT 'hi',
        c TIMESTAMP DEFAULT now(),
        d INT DEFAULT NULL,
        e TEXT DEFAULT CURRENT_DATE
      );
    `
    const ast = new SqlToAstParser('postgresql').parse(sql)
    const t = ast.tables[0]
    expect(t.columns.find((c) => c.name === 'a')?.defaultValue?.type).toBe(
      'literal'
    )
    expect(t.columns.find((c) => c.name === 'b')?.defaultValue?.type).toBe(
      'literal'
    )
    expect(t.columns.find((c) => c.name === 'c')?.defaultValue?.type).toBe(
      'function'
    )
    expect(t.columns.find((c) => c.name === 'd')?.defaultValue?.type).toBe(
      'literal'
    )
    expect(t.columns.find((c) => c.name === 'e')?.defaultValue?.type).toBe(
      'expression'
    )
  })

  it('charset and collation per column and table', () => {
    const sql = `
      CREATE TABLE t (
        name VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci
      ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
    `
    const ast = new SqlToAstParser('mysql').parse(sql)
    const col = ast.tables[0].columns[0]
    expect(col.charset).toBe('utf8mb4')
    expect(col.collation).toBe('utf8mb4_general_ci')
    expect(ast.tables[0].options?.collation).toBe('utf8mb4_bin')
    expect(ast.tables[0].options?.charset).toBe('utf8mb4')
  })

  it('ALTER adds multiple items across statements and respects unknown table', () => {
    const sql = `
      CREATE TABLE t ( a INT, b INT );
      ALTER TABLE t ADD INDEX i_a (a);
      ALTER TABLE x ADD INDEX i_b (b);
      ALTER TABLE t ADD CONSTRAINT uq UNIQUE (b);
    `
    const ast = new SqlToAstParser('mysql').parse(sql)
    const t = ast.tables.find((tt) => tt.name === 't')!
    expect(t.indexes.map((i) => i.name)).toEqual(['i_a'])
    expect(
      (
        t.constraints.find((c) => c.type === 'unique') as
          | UniqueConstraintAST
          | undefined
      )?.columns
    ).toEqual(['b'])
  })

  it('detects dialect mysql via options and unsigned', () => {
    const sql = `
      CREATE TABLE t ( a INT UNSIGNED ) ENGINE=InnoDB;
    `
    expect(SqlToAstParser.detectDialect(sql)).toBe('mysql')
  })

  it('detects dialect postgresql via serial and create schema', () => {
    const sql = `
      CREATE SCHEMA s;
      CREATE TABLE s.t ( id SERIAL );
    `
    expect(SqlToAstParser.detectDialect(sql)).toBe('postgresql')
  })

  it('handles bracketed identifiers with FK', () => {
    const sql = `
      CREATE TABLE [A] ( [Id] INT PRIMARY KEY );
      CREATE TABLE [B] ( [Aid] INT, CONSTRAINT [FK] FOREIGN KEY ([Aid]) REFERENCES [A]([Id]) );
    `
    const ast = new SqlToAstParser('sqlite').parse(sql)
    const b = ast.tables.find((x) => x.name === 'B')!
    const fk = b.constraints.find((c) => c.type === 'foreign_key') as
      | ForeignKeyConstraintAST
      | undefined
    expect(fk?.referencedTable).toBe('A')
    expect(fk?.columns).toEqual(['Aid'])
    expect(fk?.referencedColumns).toEqual(['Id'])
  })

  it('splits complex table bodies with nested parentheses', () => {
    const sql = `
      CREATE TABLE s (
        a INT,
        b DECIMAL(10, 2),
        c CHECK ((a + (1)) > 0),
        d VARCHAR(10),
        PRIMARY KEY (a, d)
      );
    `
    const ast = new SqlToAstParser('postgresql').parse(sql)
    const t = ast.tables[0]
    expect(t.columns.length).toBe(4)
    const pk = t.constraints.find((c) => c.type === 'primary_key') as
      | PrimaryKeyConstraintAST
      | undefined
    expect(pk?.columns).toEqual(['a', 'd'])
  })

  it('INDEX and UNIQUE INDEX recorded as indexes not constraints', () => {
    const sql = `
      CREATE TABLE t ( email VARCHAR(200) );
      ALTER TABLE t ADD UNIQUE INDEX ui_email (email);
      ALTER TABLE t ADD INDEX i_email (email);
    `
    const ast = new SqlToAstParser('mysql').parse(sql)
    const t = ast.tables[0]
    expect(t.indexes.filter((i) => i.unique).length).toBe(1)
    expect(t.constraints.filter((c) => c.type === 'unique').length).toBe(0)
  })

  it('supports GIN/GIST index methods via ALTER', () => {
    const sql = `
      CREATE TABLE t ( a INT );
      ALTER TABLE t ADD INDEX i_gin (a) USING gin;
      ALTER TABLE t ADD INDEX i_gist (a) USING gist;
    `
    const ast = new SqlToAstParser('postgresql').parse(sql)
    const names = ast.tables[0].indexes
      .map((i) => `${i.name}:${i.method}`)
      .sort()
    expect(names).toEqual(['i_gin:gin', 'i_gist:gist'])
  })

  it('handles many constraints in single table', () => {
    const sql = `
      CREATE TABLE z (
        id INT,
        a INT,
        b INT,
        c INT,
        d INT,
        PRIMARY KEY (id),
        UNIQUE (a),
        UNIQUE (b),
        UNIQUE (c),
        CHECK (d > 0)
      );
    `
    const ast = new SqlToAstParser('mysql').parse(sql)
    const z = ast.tables[0]
    expect(z.constraints.filter((c) => c.type === 'unique').length).toBe(3)
    expect(z.constraints.some((c) => c.type === 'check')).toBe(true)
  })

  it('handles multiple tables and cross references', () => {
    const sql = `
      CREATE TABLE authors ( id INT PRIMARY KEY, name TEXT );
      CREATE TABLE posts ( id INT PRIMARY KEY, author_id INT REFERENCES authors(id), title TEXT );
      CREATE TABLE comments ( id INT PRIMARY KEY, post_id INT REFERENCES posts(id), author_id INT REFERENCES authors(id) );
    `
    const ast = new SqlToAstParser('postgresql').parse(sql)
    expect(ast.tables.length).toBe(3)
    const posts = ast.tables.find((t) => t.name === 'posts')!
    const postFk = posts.constraints.find((c) => c.type === 'foreign_key') as
      | ForeignKeyConstraintAST
      | undefined
    expect(postFk?.referencedTable).toBe('authors')
    const comments = ast.tables.find((t) => t.name === 'comments')!
    const commentFks = comments.constraints.filter(
      (c) => c.type === 'foreign_key'
    ) as ForeignKeyConstraintAST[]
    expect(commentFks.map((f) => f.referencedTable).sort()).toEqual(
      ['authors', 'posts'].sort()
    )
  })

  it('column comments and table comment captured', () => {
    const sql = `
      CREATE TABLE notes (
        id INT COMMENT 'pk',
        body TEXT
      ) COMMENT='table note';
    `
    const ast = new SqlToAstParser('mysql').parse(sql)
    expect(ast.tables[0].columns[0].comment).toBe('pk')
    expect(ast.tables[0].options?.comment).toBe('table note')
  })

  it('NULL and NOT NULL precedence with PK and SERIAL', () => {
    const sql = `
      CREATE TABLE n (
        id SERIAL,
        code INT NOT NULL,
        opt INT NULL
      );
    `
    const ast = new SqlToAstParser('postgresql').parse(sql)
    const id = ast.tables[0].columns.find((c) => c.name === 'id')!
    expect(id.autoIncrement).toBe(true)
    expect(id.nullable).toBe(false)
    expect(ast.tables[0].columns.find((c) => c.name === 'code')!.nullable).toBe(
      false
    )
    expect(ast.tables[0].columns.find((c) => c.name === 'opt')!.nullable).toBe(
      true
    )
  })

  it('quoted constraint names retained', () => {
    const sql = `
      CREATE TABLE q (
        id INT,
        CONSTRAINT "PK.Q" PRIMARY KEY (id),
        CONSTRAINT \`UQ.Q\` UNIQUE (id),
        CONSTRAINT 'CK.Q' CHECK (id > 0)
      );
    `
    const ast = new SqlToAstParser('postgresql').parse(sql)
    const pk = ast.tables[0].constraints.find(
      (c) => c.type === 'primary_key'
    ) as PrimaryKeyConstraintAST | undefined
    const uq = ast.tables[0].constraints.find((c) => c.type === 'unique') as
      | UniqueConstraintAST
      | undefined
    const ck = ast.tables[0].constraints.find((c) => c.type === 'check') as
      | CheckConstraintAST
      | undefined
    expect(pk?.name).toBe('PK.Q')
    expect(uq?.name).toBe('UQ.Q')
    expect(ck?.name).toBe('CK.Q')
  })

  it('INDEX fallbacks when column match partial', () => {
    const sql = `
      CREATE TABLE t ( a INT );
      ALTER TABLE t ADD INDEX ix (a);
    `
    const ast = new SqlToAstParser('mysql').parse(sql)
    const i = ast.tables[0].indexes[0]
    expect(i.columns[0].name).toBe('a')
  })
})
