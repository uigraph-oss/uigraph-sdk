import { describe, expect, it } from 'vitest'
import { SqlToAstParser } from '../ast-parser'
import type { ForeignKeyConstraintAST } from '../types'

describe('foreign-keys-senario: various foreign key combinations', () => {
  it('single-column fk inline with actions', () => {
    const sql = `
      CREATE TABLE child ( pid INT REFERENCES parent(id) ON DELETE CASCADE ON UPDATE RESTRICT );
    `
    const t = new SqlToAstParser('postgresql').parse(sql).tables[0]
    const fk = t.constraints.find((c) => c.type === 'foreign_key') as
      | ForeignKeyConstraintAST
      | undefined
    expect(fk?.columns).toEqual(['pid'])
    expect(fk?.referencedTable).toBe('parent')
    expect(fk?.referencedColumns).toEqual(['id'])
    expect(fk?.onDelete).toBe('CASCADE')
    expect(fk?.onUpdate).toBe('RESTRICT')
  })

  it('table-level fk named', () => {
    const sql = `
      CREATE TABLE child ( pid INT, CONSTRAINT fk FOREIGN KEY (pid) REFERENCES parent(id) );
    `
    const fk = new SqlToAstParser('mysql')
      .parse(sql)
      .tables[0].constraints.find((c) => c.type === 'foreign_key') as
      | ForeignKeyConstraintAST
      | undefined
    expect(fk?.name).toBe('fk')
  })

  it('multi-column fk inline not supported becomes table-level via parse', () => {
    const sql = `
      CREATE TABLE child (
        a INT, b INT,
        CONSTRAINT fk FOREIGN KEY (a, b) REFERENCES parent(x, y) ON DELETE SET NULL ON UPDATE CASCADE
      );
    `
    const fk = new SqlToAstParser('postgresql')
      .parse(sql)
      .tables[0].constraints.find((c) => c.type === 'foreign_key') as
      | ForeignKeyConstraintAST
      | undefined
    expect(fk?.columns).toEqual(['a', 'b'])
    expect(fk?.referencedColumns).toEqual(['x', 'y'])
    expect(fk?.onDelete).toBe('SET NULL')
    expect(fk?.onUpdate).toBe('CASCADE')
  })

  it('schema-qualified references normalized', () => {
    const sql = `
      CREATE TABLE c ( p INT, CONSTRAINT f FOREIGN KEY (p) REFERENCES "s"."p"("id") );
    `
    const fk = new SqlToAstParser('postgresql')
      .parse(sql)
      .tables[0].constraints.find((c) => c.type === 'foreign_key') as
      | ForeignKeyConstraintAST
      | undefined
    expect(fk?.referencedTable).toBe('p')
    expect(fk?.referencedColumns).toEqual(['id'])
  })

  it('bracketed identifiers in fk', () => {
    const sql = `
      CREATE TABLE [C] ( [Pid] INT, CONSTRAINT [F] FOREIGN KEY ([Pid]) REFERENCES [P]([Id]) );
    `
    const fk = new SqlToAstParser('sqlite')
      .parse(sql)
      .tables[0].constraints.find((c) => c.type === 'foreign_key') as
      | ForeignKeyConstraintAST
      | undefined
    expect(fk?.columns).toEqual(['Pid'])
    expect(fk?.referencedTable).toBe('P')
    expect(fk?.referencedColumns).toEqual(['Id'])
  })

  it('multiple fks present', () => {
    const sql = `
      CREATE TABLE c (
        u INT REFERENCES users(id),
        p INT REFERENCES posts(id)
      );
    `
    const t = new SqlToAstParser('postgresql').parse(sql).tables[0]
    const fks = t.constraints.filter(
      (c) => c.type === 'foreign_key'
    ) as ForeignKeyConstraintAST[]
    expect(fks.length).toBe(2)
  })
})
