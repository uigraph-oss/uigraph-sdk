import { describe, expect, it } from 'vitest'
import { SqlToAstParser } from '../ast-parser'
import type { PrimaryKeyConstraintAST } from '../types'

describe('splitting-robustness-senario: correct splitting of table body items', () => {
  it('commas inside parentheses do not split', () => {
    const sql = `
      CREATE TABLE t (
        a DECIMAL(10, 2),
        b VARCHAR(10),
        c CHECK ((a + (1)) > 0),
        PRIMARY KEY (b)
      );
    `
    const t = new SqlToAstParser('postgresql').parse(sql).tables[0]
    expect(t.columns.length).toBe(2)
    const pk = t.constraints.find((c) => c.type === 'primary_key') as
      | PrimaryKeyConstraintAST
      | undefined
    expect(pk?.columns).toEqual(['b'])
  })

  it('quotes with commas ignored', () => {
    const sql = `
      CREATE TABLE t (
        a TEXT DEFAULT 'x,y,z',
        b TEXT DEFAULT "1,2,3"
      );
    `
    const t = new SqlToAstParser('mysql').parse(sql).tables[0]
    expect(t.columns.length).toBe(2)
  })

  it('deep nested parentheses', () => {
    const sql = `
      CREATE TABLE t (
        a INT,
        CHECK ((((a + 1) * (a - 1)) <> 0))
      );
    `
    const t = new SqlToAstParser('postgresql').parse(sql).tables[0]
    expect(t.constraints.some((c) => c.type === 'check')).toBe(true)
  })
})
