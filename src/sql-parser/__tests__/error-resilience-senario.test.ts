import { describe, expect, it } from 'vitest'
import { SqlToAstParser } from '../ast-parser'

describe('error-resilience-senario: tolerate odd input and continue', () => {
  it('unknown statements do not break parsing', () => {
    const sql = `
      -- random line
      CREATE VIEW v AS SELECT 1;
      CREATE TABLE t ( id INT );
      DROP FUNCTION whatever();
    `
    const ast = new SqlToAstParser('mysql').parse(sql)
    expect(ast.tables.map((t) => t.name)).toEqual(['t'])
  })

  it('malformed CREATE TABLE is skipped, next table parsed', () => {
    const sql = `
      CREATE TABLE bad id INT, name TEXT );
      CREATE TABLE good ( id INT );
    `
    const ast = new SqlToAstParser('mysql').parse(sql)
    expect(ast.tables.map((t) => t.name)).toEqual(['good'])
  })

  it('ALTER for missing table is ignored while valid remains', () => {
    const sql = `
      CREATE TABLE a ( id INT );
      ALTER TABLE x ADD INDEX i (id);
      ALTER TABLE a ADD INDEX ia (id);
    `
    const ast = new SqlToAstParser('mysql').parse(sql)
    expect(ast.tables[0].indexes.map((i) => i.name)).toEqual(['ia'])
  })
})
