import { describe, expect, it } from 'vitest'
import { SqlToAstParser } from '../ast-parser'
import type {
  CheckConstraintAST,
  ForeignKeyConstraintAST,
  PrimaryKeyConstraintAST,
  UniqueConstraintAST,
} from '../types'

describe('advanced constraints - breadth', () => {
  it('parses multiple table-level constraints', () => {
    const sql = `
      CREATE TABLE a (
        id INT,
        x INT,
        y INT,
        PRIMARY KEY (id),
        UNIQUE (x),
        UNIQUE (y),
        CHECK (x <> y)
      );
    `
    const ast = new SqlToAstParser('postgresql').parse(sql)
    const t = ast.tables[0]
    expect(t.constraints.filter((c) => c.type === 'primary_key').length).toBe(1)
    expect(t.constraints.filter((c) => c.type === 'unique').length).toBe(2)
    expect(t.constraints.filter((c) => c.type === 'check').length).toBe(1)
  })

  it('parses named constraints without quotes', () => {
    const sql = `
      CREATE TABLE a (
        id INT,
        CONSTRAINT pk_a PRIMARY KEY (id),
        CONSTRAINT uq_a UNIQUE (id),
        CONSTRAINT ck_a CHECK (id > 0)
      );
    `
    const ast = new SqlToAstParser('mysql').parse(sql)
    const t = ast.tables[0]
    expect(
      (
        t.constraints.find((c) => c.type === 'primary_key') as
          | PrimaryKeyConstraintAST
          | undefined
      )?.name
    ).toBe('pk_a')
    expect(
      (
        t.constraints.find((c) => c.type === 'unique') as
          | UniqueConstraintAST
          | undefined
      )?.name
    ).toBe('uq_a')
    expect(
      (
        t.constraints.find((c) => c.type === 'check') as
          | CheckConstraintAST
          | undefined
      )?.name
    ).toBe('ck_a')
  })

  it('parses composite unique constraints', () => {
    const sql = `
      CREATE TABLE a (
        x INT, y INT, z INT,
        CONSTRAINT uq_xyz UNIQUE (x, y, z)
      );
    `
    const ast = new SqlToAstParser('mysql').parse(sql)
    const uq = ast.tables[0].constraints.find((c) => c.type === 'unique') as
      | UniqueConstraintAST
      | undefined
    expect(uq?.columns).toEqual(['x', 'y', 'z'])
  })

  it('parses multiple checks', () => {
    const sql = `
      CREATE TABLE a (
        v INT,
        CHECK (v >= 0),
        CONSTRAINT c2 CHECK ((v % 2) = 0)
      );
    `
    const ast = new SqlToAstParser('postgresql').parse(sql)
    const checks = ast.tables[0].constraints.filter(
      (c) => c.type === 'check'
    ) as CheckConstraintAST[]
    expect(checks.length).toBe(2)
    expect(checks[1].name).toBe('c2')
  })

  it('parses inline fk with on delete', () => {
    const sql = `
      CREATE TABLE a (
        uid INT REFERENCES users(id) ON DELETE SET NULL
      );
    `
    const ast = new SqlToAstParser('postgresql').parse(sql)
    const fk = ast.tables[0].constraints.find(
      (c) => c.type === 'foreign_key'
    ) as ForeignKeyConstraintAST | undefined
    expect(fk?.onDelete).toBe('SET NULL')
  })

  it('parses fk without actions', () => {
    const sql = `
      CREATE TABLE a (
        pid INT,
        CONSTRAINT fk FOREIGN KEY (pid) REFERENCES parent(id)
      );
    `
    const ast = new SqlToAstParser('mysql').parse(sql)
    const fk = ast.tables[0].constraints.find(
      (c) => c.type === 'foreign_key'
    ) as ForeignKeyConstraintAST | undefined
    expect(fk?.onDelete).toBeUndefined()
    expect(fk?.onUpdate).toBeUndefined()
  })

  it('parses multiple fks', () => {
    const sql = `
      CREATE TABLE a (
        u INT REFERENCES u(id),
        p INT REFERENCES p(id)
      );
    `
    const ast = new SqlToAstParser('postgresql').parse(sql)
    const fks = ast.tables[0].constraints.filter(
      (c) => c.type === 'foreign_key'
    ) as ForeignKeyConstraintAST[]
    expect(fks.length).toBe(2)
  })

  it('parses constraint names with schema-like dots', () => {
    const sql = `
      CREATE TABLE a (
        id INT,
        CONSTRAINT "schema.pk" PRIMARY KEY (id)
      );
    `
    const ast = new SqlToAstParser('postgresql').parse(sql)
    const pk = ast.tables[0].constraints.find(
      (c) => c.type === 'primary_key'
    ) as PrimaryKeyConstraintAST | undefined
    expect(pk?.name).toBe('schema.pk')
  })

  it('parses fk referencing schema-qualified table', () => {
    const sql = `
      CREATE TABLE a (
        pid INT,
        CONSTRAINT f FOREIGN KEY (pid) REFERENCES "s"."t"(id)
      );
    `
    const ast = new SqlToAstParser('postgresql').parse(sql)
    const fk = ast.tables[0].constraints.find(
      (c) => c.type === 'foreign_key'
    ) as ForeignKeyConstraintAST | undefined
    expect(fk?.referencedTable).toBe('t')
  })

  it('parses fk with spaces in actions', () => {
    const sql = `
      CREATE TABLE a (
        pid INT,
        CONSTRAINT f FOREIGN KEY (pid) REFERENCES p(id) ON DELETE NO ACTION ON UPDATE SET DEFAULT
      );
    `
    const ast = new SqlToAstParser('postgresql').parse(sql)
    const fk = ast.tables[0].constraints.find(
      (c) => c.type === 'foreign_key'
    ) as ForeignKeyConstraintAST | undefined
    expect(fk?.onDelete).toBe('NO ACTION')
    expect(fk?.onUpdate).toBe('SET DEFAULT')
  })

  it('parses unique constraint ignoring KEY/INDEX keyword', () => {
    const sql = `
      CREATE TABLE a (
        email VARCHAR(200),
        UNIQUE (email),
        UNIQUE KEY uq_e (email),
        UNIQUE INDEX ui_e (email)
      );
    `
    const ast = new SqlToAstParser('mysql').parse(sql)
    const uniques = ast.tables[0].constraints.filter(
      (c) => c.type === 'unique'
    ) as UniqueConstraintAST[]
    const uniqueIdxCount = ast.tables[0].indexes.filter((i) => i.unique).length
    expect(uniques.length).toBe(1)
    expect(uniqueIdxCount).toBe(2)
  })

  it('parses check with nested parentheses', () => {
    const sql = `
      CREATE TABLE a (
        v INT,
        CHECK (((v + 1) > (0)))
      );
    `
    const ast = new SqlToAstParser('postgresql').parse(sql)
    expect(ast.tables[0].constraints.some((c) => c.type === 'check')).toBe(true)
  })

  it('handles many constraints without failure', () => {
    const checks = Array.from({ length: 20 })
      .map((_, i) => `CHECK (c${i} IS NOT NULL)`)
      .join(', ')
    const sql = `
      CREATE TABLE a (
        ${Array.from({ length: 20 })
          .map((_, i) => `c${i} INT`)
          .join(', ')},
        ${checks}
      );
    `
    const ast = new SqlToAstParser('postgresql').parse(sql)
    expect(
      ast.tables[0].constraints.filter((c) => c.type === 'check').length
    ).toBe(20)
  })
})
