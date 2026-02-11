import { describe, expect, it } from 'vitest'
import { SqlToAstParser } from '../ast-parser'
import type { ForeignKeyConstraintAST, UniqueConstraintAST } from '../types'

describe('ALTER TABLE variants', () => {
  it('adds multiple constraints via separate ALTERs', () => {
    const sql = `
      CREATE TABLE t ( a INT, b INT, c INT );
      ALTER TABLE t ADD CONSTRAINT uq_ab UNIQUE (a, b);
      ALTER TABLE t ADD INDEX idx_c (c);
    `
    const ast = new SqlToAstParser('mysql').parse(sql)
    const t = ast.tables[0]
    expect(
      (
        t.constraints.find((c) => c.type === 'unique') as
          | UniqueConstraintAST
          | undefined
      )?.columns
    ).toEqual(['a', 'b'])
    expect(t.indexes.some((i) => i.name === 'idx_c')).toBe(true)
  })

  it('adds FK with actions', () => {
    const sql = `
      CREATE TABLE p ( id INT );
      CREATE TABLE c ( pid INT );
      ALTER TABLE c ADD CONSTRAINT fk FOREIGN KEY (pid) REFERENCES p(id) ON DELETE CASCADE ON UPDATE RESTRICT;
    `
    const ast = new SqlToAstParser('mysql').parse(sql)
    const c = ast.tables.find((x) => x.name === 'c')!
    const fk = c.constraints.find((x) => x.type === 'foreign_key') as
      | ForeignKeyConstraintAST
      | undefined
    expect(fk?.onDelete).toBe('CASCADE')
    expect(fk?.onUpdate).toBe('RESTRICT')
  })

  it('adds multiple items in single ALTER with commas', () => {
    const sql = `
      CREATE TABLE t ( a INT, b INT, c INT );
      ALTER TABLE t ADD CONSTRAINT uq UNIQUE (a), ADD INDEX i_b (b), ADD CONSTRAINT uq2 UNIQUE (c);
    `
    const ast = new SqlToAstParser('mysql').parse(sql)
    const t = ast.tables[0]
    expect(t.constraints.filter((c) => c.type === 'unique').length).toBe(2)
    expect(t.indexes.some((i) => i.name === 'i_b')).toBe(true)
  })

  it('ignores ADD with empty definition', () => {
    const sql = `
      CREATE TABLE t ( a INT );
      ALTER TABLE t ADD   ;
    `
    const ast = new SqlToAstParser('mysql').parse(sql)
    expect(
      ast.tables[0].constraints.length + ast.tables[0].indexes.length
    ).toBe(0)
  })

  it('handles ONLY and IF EXISTS keywords', () => {
    const sql = `
      CREATE TABLE t ( a INT );
      ALTER TABLE IF EXISTS ONLY t ADD INDEX i_a (a);
    `
    const ast = new SqlToAstParser('postgresql').parse(sql)
    expect(ast.tables[0].indexes.some((i) => i.name === 'i_a')).toBe(true)
  })

  it('does nothing if ALTER table not found', () => {
    const sql = `
      CREATE TABLE t ( a INT );
      ALTER TABLE x ADD INDEX i (a);
    `
    const ast = new SqlToAstParser('mysql').parse(sql)
    expect(ast.tables[0].indexes.length).toBe(0)
  })

  it('adds named unique and index', () => {
    const sql = `
      CREATE TABLE t ( a INT, b INT );
      ALTER TABLE t ADD CONSTRAINT "UQ" UNIQUE (a), ADD INDEX \`I_B\` (b);
    `
    const ast = new SqlToAstParser('mysql').parse(sql)
    const t = ast.tables[0]
    expect(
      (
        t.constraints.find((c) => c.type === 'unique') as
          | UniqueConstraintAST
          | undefined
      )?.name
    ).toBe('UQ')
    expect(t.indexes.some((i) => i.name === 'I_B')).toBe(true)
  })

  it('adds FK referencing quoted identifiers', () => {
    const sql = `
      CREATE TABLE "P" ( "Id" INT );
      CREATE TABLE "C" ( "Pid" INT );
      ALTER TABLE "C" ADD CONSTRAINT "FK" FOREIGN KEY ("Pid") REFERENCES "P"("Id");
    `
    const ast = new SqlToAstParser('postgresql').parse(sql)
    const c = ast.tables.find((x) => x.name === 'C')!
    const fk = c.constraints.find((x) => x.type === 'foreign_key') as
      | ForeignKeyConstraintAST
      | undefined
    expect(fk?.referencedTable).toBe('P')
    expect(fk?.columns).toEqual(['Pid'])
    expect(fk?.referencedColumns).toEqual(['Id'])
  })
})
