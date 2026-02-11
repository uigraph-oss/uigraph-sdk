import { describe, expect, it } from 'vitest'
import { SqlToAstParser } from '../ast-parser'
import type { ForeignKeyConstraintAST, UniqueConstraintAST } from '../types'

describe('alter-chains-senario: long chains of ALTER TABLE additions', () => {
  it('many ADDs across multiple statements', () => {
    const sql = `
      CREATE TABLE t ( a INT, b INT, c INT, d INT );
      ALTER TABLE t ADD INDEX i_a (a);
      ALTER TABLE t ADD CONSTRAINT uq_b UNIQUE (b);
      ALTER TABLE t ADD INDEX i_c (c);
      ALTER TABLE t ADD CONSTRAINT uq_d UNIQUE (d);
    `
    const t = new SqlToAstParser('mysql').parse(sql).tables[0]
    expect(t.indexes.map((x) => x.name).sort()).toEqual(['i_a', 'i_c'].sort())
    const uniques = t.constraints.filter(
      (c) => c.type === 'unique'
    ) as UniqueConstraintAST[]
    expect(uniques.length).toBe(2)
  })

  it('single ALTER with multiple comma-separated ADDs', () => {
    const sql = `
      CREATE TABLE t ( a INT, b INT, c INT );
      ALTER TABLE t
        ADD CONSTRAINT uq_ab UNIQUE (a, b),
        ADD INDEX i_b (b),
        ADD INDEX i_c (c) USING hash;
    `
    const t = new SqlToAstParser('mysql').parse(sql).tables[0]
    expect(t.indexes.map((i) => i.name).sort()).toEqual(['i_b', 'i_c'].sort())
    expect(t.indexes.find((i) => i.name === 'i_c')?.method).toBe('hash')
    expect(
      (
        t.constraints.find((c) => c.type === 'unique') as
          | UniqueConstraintAST
          | undefined
      )?.columns
    ).toEqual(['a', 'b'])
  })

  it('ALTER with ONLY and IF EXISTS keywords', () => {
    const sql = `
      CREATE TABLE t ( a INT );
      ALTER TABLE IF EXISTS ONLY t ADD INDEX i_a (a);
    `
    const t = new SqlToAstParser('postgresql').parse(sql).tables[0]
    expect(t.indexes[0].name).toBe('i_a')
  })

  it('ALTER referencing unknown table yields no changes', () => {
    const sql = `
      CREATE TABLE t ( a INT );
      ALTER TABLE x ADD INDEX i (a);
    `
    const t = new SqlToAstParser('mysql').parse(sql).tables[0]
    expect(t.indexes.length).toBe(0)
  })

  it('adds FKs via ALTER and respects actions', () => {
    const sql = `
      CREATE TABLE p ( id INT );
      CREATE TABLE c ( pid INT );
      ALTER TABLE c ADD CONSTRAINT fk FOREIGN KEY (pid) REFERENCES p(id) ON DELETE SET NULL ON UPDATE CASCADE;
    `
    const c = new SqlToAstParser('mysql')
      .parse(sql)
      .tables.find((x) => x.name === 'c')!
    const fk = c.constraints.find((x) => x.type === 'foreign_key') as
      | ForeignKeyConstraintAST
      | undefined
    expect(fk?.onDelete).toBe('SET NULL')
    expect(fk?.onUpdate).toBe('CASCADE')
  })

  it('long chain with 15 operations', () => {
    const ops = [
      `ADD INDEX i1 (a)`,
      `ADD INDEX i2 (b)`,
      `ADD INDEX i3 (c)`,
      `ADD INDEX i4 (d)`,
      `ADD INDEX i5 (a)`,
      `ADD CONSTRAINT uq1 UNIQUE (a)`,
      `ADD CONSTRAINT uq2 UNIQUE (b)`,
      `ADD CONSTRAINT uq3 UNIQUE (c)`,
      `ADD INDEX i6 (b)`,
      `ADD INDEX i7 (c)`,
      `ADD INDEX i8 (d)`,
      `ADD INDEX i9 (a)`,
      `ADD INDEX i10 (b)`,
      `ADD INDEX i11 (c)`,
      `ADD INDEX i12 (d)`,
    ].join(', ')

    const sql = `
      CREATE TABLE t ( a INT, b INT, c INT, d INT );
      ALTER TABLE t ${ops};
    `
    const t = new SqlToAstParser('mysql').parse(sql).tables[0]
    expect(t.indexes.length).toBeGreaterThanOrEqual(10)
    expect(t.constraints.filter((c) => c.type === 'unique').length).toBe(3)
  })
})
