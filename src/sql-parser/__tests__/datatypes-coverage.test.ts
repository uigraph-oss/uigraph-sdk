import { describe, expect, it } from 'vitest'
import { SqlToAstParser } from '../ast-parser'
import type { DataTypeAST } from '../types'

describe('data type parsing coverage', () => {
  it('parses numeric with precision and scale', () => {
    const sql = `
      CREATE TABLE t ( a DECIMAL(18,4) );
    `
    const ast = new SqlToAstParser('mysql').parse(sql)
    const dt: DataTypeAST = ast.tables[0].columns[0].dataType
    expect(dt.name).toBe('DECIMAL')
    expect(dt.parameters).toEqual([18, 4])
  })

  it('parses integer unsigned', () => {
    const sql = `
      CREATE TABLE t ( a INT UNSIGNED );
    `
    const dt = new SqlToAstParser('mysql').parse(sql).tables[0].columns[0]
      .dataType
    expect(dt.unsigned).toBe(true)
  })

  it('parses varchar length', () => {
    const sql = `
      CREATE TABLE t ( a VARCHAR(255) );
    `
    const dt = new SqlToAstParser('mysql').parse(sql).tables[0].columns[0]
      .dataType
    expect(dt.parameters).toEqual([255])
  })

  it('parses timestamp with time zone', () => {
    const sql = `
      CREATE TABLE t ( a TIMESTAMP WITH TIME ZONE );
    `
    const dt = new SqlToAstParser('postgresql').parse(sql).tables[0].columns[0]
      .dataType
    expect(dt.timezone).toBe(true)
  })

  it('parses unrecognized type as-is', () => {
    const sql = `
      CREATE TABLE t ( a CUSTOMTYPE(1,2) );
    `
    const dt = new SqlToAstParser('postgresql').parse(sql).tables[0].columns[0]
      .dataType
    expect(dt.name).toBe('CUSTOMTYPE')
    expect(dt.parameters).toEqual([1, 2])
  })

  it('parses mixed numeric parameters including strings', () => {
    const sql = `
      CREATE TABLE t ( a DECIMAL(10, x) );
    `
    const dt = new SqlToAstParser('postgresql').parse(sql).tables[0].columns[0]
      .dataType
    expect(dt.parameters).toEqual([10, 'x'])
  })

  it('parses type with trailing modifiers', () => {
    const sql = `
      CREATE TABLE t ( a INT unsigned );
    `
    const dt = new SqlToAstParser('mysql').parse(sql).tables[0].columns[0]
      .dataType
    expect(dt.unsigned).toBe(true)
  })
})
