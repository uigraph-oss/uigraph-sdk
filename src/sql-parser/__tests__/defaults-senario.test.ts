import { describe, expect, it } from 'vitest'
import { SqlToAstParser } from '../ast-parser'

describe('defaults-senario: matrix of default values', () => {
  it('number and string defaults', () => {
    const sql = `
      CREATE TABLE t (
        a INT DEFAULT 1,
        b INT DEFAULT -5,
        c VARCHAR(10) DEFAULT 'hello',
        d TEXT DEFAULT 'x y z'
      );
    `
    const t = new SqlToAstParser('mysql').parse(sql).tables[0]
    expect(t.columns.find((c) => c.name === 'a')?.defaultValue?.type).toBe(
      'literal'
    )
    expect(t.columns.find((c) => c.name === 'b')?.defaultValue?.type).toBe(
      'literal'
    )
    expect(t.columns.find((c) => c.name === 'c')?.defaultValue?.type).toBe(
      'literal'
    )
    expect(t.columns.find((c) => c.name === 'd')?.defaultValue?.type).toBe(
      'literal'
    )
  })

  it('function defaults recognized', () => {
    const sql = `
      CREATE TABLE t (
        a TIMESTAMP DEFAULT now(),
        b DATE DEFAULT CURRENT_DATE,
        c TIME DEFAULT CURRENT_TIME
      );
    `
    const t = new SqlToAstParser('postgresql').parse(sql).tables[0]
    expect(t.columns.find((c) => c.name === 'a')?.defaultValue?.type).toBe(
      'function'
    )
    expect(t.columns.find((c) => c.name === 'b')?.defaultValue?.type).toBe(
      'expression'
    )
    expect(t.columns.find((c) => c.name === 'c')?.defaultValue?.type).toBe(
      'expression'
    )
  })

  it('null default', () => {
    const sql = `
      CREATE TABLE t ( a INT DEFAULT NULL );
    `
    const col = new SqlToAstParser('mysql').parse(sql).tables[0].columns[0]
    expect(col.defaultValue?.type).toBe('literal')
  })

  it('numeric literal including decimals', () => {
    const sql = `
      CREATE TABLE t ( a DECIMAL(10,2) DEFAULT 12.34 );
    `
    const col = new SqlToAstParser('mysql').parse(sql).tables[0].columns[0]
    expect(col.defaultValue?.type).toBe('literal')
  })

  it('expression default not recognized as function', () => {
    const sql = `
      CREATE TABLE t ( a INT DEFAULT (1 + 2) );
    `
    const col = new SqlToAstParser('postgresql').parse(sql).tables[0].columns[0]
    expect(col.defaultValue?.type).toBe('expression')
  })

  it('multiple defaults across many columns', () => {
    const cols = Array.from({ length: 20 })
      .map((_, i) => `c${i} INT DEFAULT ${i}`)
      .join(',\n')
    const sql = `CREATE TABLE t ( ${cols} );`
    const t = new SqlToAstParser('mysql').parse(sql).tables[0]
    expect(
      t.columns.filter((c) => c.defaultValue?.type === 'literal').length
    ).toBe(20)
  })

  it('string default with quotes preserved raw', () => {
    const sql = `
      CREATE TABLE t ( a TEXT DEFAULT 'It\\'s fine' );
    `
    const col = new SqlToAstParser('mysql').parse(sql).tables[0].columns[0]
    expect(!!col.defaultValue?.raw).toBe(true)
  })

  it('mixed types with defaults and constraints', () => {
    const sql = `
      CREATE TABLE t (
        id SERIAL,
        email VARCHAR(200) DEFAULT 'x' UNIQUE,
        price NUMERIC(10,2) DEFAULT 0 CHECK (price >= 0),
        active INT DEFAULT 1 NOT NULL
      );
    `
    const t = new SqlToAstParser('postgresql').parse(sql).tables[0]
    expect(t.constraints.some((c) => c.type === 'unique')).toBe(true)
    expect(t.constraints.some((c) => c.type === 'check')).toBe(true)
    expect(t.columns.find((c) => c.name === 'active')?.nullable).toBe(false)
  })
})
