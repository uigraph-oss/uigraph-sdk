import { describe, expect, it } from 'vitest'
import { SqlToAstParser } from '../ast-parser'

describe('complex CHECK expressions', () => {
  it('logical operators', () => {
    const sql = `
      CREATE TABLE t ( v INT, CHECK ((v > 0 AND v < 10) OR (v IS NULL)) );
    `
    const ast = new SqlToAstParser('postgresql').parse(sql)
    const ck = ast.tables[0].constraints.find((c) => c.type === 'check')
    expect(Boolean(ck && 'expression' in ck)).toBe(true)
  })

  it('function calls inside check', () => {
    const sql = `
      CREATE TABLE t ( ts TIMESTAMP, CHECK (date_part('year', ts) >= 2000) );
    `
    const ast = new SqlToAstParser('postgresql').parse(sql)
    const ck = ast.tables[0].constraints.find((c) => c.type === 'check')
    expect(Boolean(ck && 'expression' in ck)).toBe(true)
  })

  it('arithmetic and parentheses', () => {
    const sql = `
      CREATE TABLE t ( a INT, b INT, CHECK (((a + b) * (a - b)) <> 0) );
    `
    const ast = new SqlToAstParser('postgresql').parse(sql)
    const ck = ast.tables[0].constraints.find((c) => c.type === 'check')
    expect(Boolean(ck && 'expression' in ck)).toBe(true)
  })

  it('null checks and comparisons', () => {
    const sql = `
      CREATE TABLE t ( a INT, CHECK (a IS NOT NULL AND a >= 0) );
    `
    const ast = new SqlToAstParser('postgresql').parse(sql)
    const ck = ast.tables[0].constraints.find((c) => c.type === 'check')
    expect(Boolean(ck && 'expression' in ck)).toBe(true)
  })

  it('multiple CHECKs preserved', () => {
    const sql = `
      CREATE TABLE t (
        a INT,
        CHECK (a > 0),
        CHECK (a < 100),
        CHECK (a % 2 = 0)
      );
    `
    const ast = new SqlToAstParser('postgresql').parse(sql)
    expect(
      ast.tables[0].constraints.filter((c) => c.type === 'check').length
    ).toBe(3)
  })
})
