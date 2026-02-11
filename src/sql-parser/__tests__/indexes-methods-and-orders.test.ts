import { describe, expect, it } from 'vitest'
import { SqlToAstParser } from '../ast-parser'
import type { IndexAST } from '../types'

describe('index methods and orders', () => {
  it('btree', () => {
    const sql = `CREATE TABLE t ( a INT, INDEX i (a) USING btree );`
    const ast = new SqlToAstParser('mysql').parse(sql)
    const i = ast.tables[0].indexes[0] as IndexAST
    expect(i.method).toBe('btree')
  })

  it('hash', () => {
    const sql = `CREATE TABLE t ( a INT, INDEX i (a) USING hash );`
    const ast = new SqlToAstParser('mysql').parse(sql)
    expect(ast.tables[0].indexes[0].method).toBe('hash')
  })

  it('gin/gist methods recorded', () => {
    const sql = `
      CREATE TABLE t ( a INT, b INT );
      CREATE TABLE t2 ( c INT );
      ALTER TABLE t ADD INDEX i1 (a) USING gin;
      ALTER TABLE t2 ADD INDEX i2 (c) USING gist;
    `
    const ast = new SqlToAstParser('postgresql').parse(sql)
    const t = ast.tables.find((x) => x.name === 't')!
    const t2 = ast.tables.find((x) => x.name === 't2')!
    expect(t.indexes[0].method).toBe('gin')
    expect(t2.indexes[0].method).toBe('gist')
  })

  it('orders asc/desc per column', () => {
    const sql = `
      CREATE TABLE t ( a INT, b INT, c INT );
      ALTER TABLE t ADD INDEX ix (a ASC, b DESC, c);
    `
    const ast = new SqlToAstParser('mysql').parse(sql)
    const cols = ast.tables[0].indexes[0].columns
    expect(cols[0].order).toBe('ASC')
    expect(cols[1].order).toBe('DESC')
    expect(cols[2].order).toBeUndefined()
  })
})
