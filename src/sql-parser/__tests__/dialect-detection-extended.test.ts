import { describe, expect, it } from 'vitest'
import { SqlToAstParser } from '../ast-parser'

describe('dialect detection extended', () => {
  it('detects mysql via engine, collate, charset', () => {
    const sql = `
      CREATE TABLE t ( id INT ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
    `
    expect(SqlToAstParser.detectDialect(sql)).toBe('mysql')
  })

  it('detects mysql via unsigned', () => {
    const sql = `
      CREATE TABLE t ( id INT UNSIGNED );
    `
    expect(SqlToAstParser.detectDialect(sql)).toBe('mysql')
  })

  it('detects postgresql via serial', () => {
    const sql = `
      CREATE TABLE t ( id SERIAL );
    `
    expect(SqlToAstParser.detectDialect(sql)).toBe('postgresql')
  })

  it('detects postgresql via bigserial', () => {
    const sql = `
      CREATE TABLE t ( id BIGSERIAL );
    `
    expect(SqlToAstParser.detectDialect(sql)).toBe('postgresql')
  })

  it('detects postgresql via nextval', () => {
    const sql = `
      CREATE TABLE t ( id INT DEFAULT nextval('s') );
    `
    expect(SqlToAstParser.detectDialect(sql)).toBe('postgresql')
  })

  it('detects postgresql via create schema', () => {
    const sql = `
      CREATE SCHEMA s;
      CREATE TABLE s.t ( id INT );
    `
    expect(SqlToAstParser.detectDialect(sql)).toBe('postgresql')
  })

  it('falls back to mysql for generic statements', () => {
    const sql = `
      CREATE TABLE t ( id INT );
    `
    expect(SqlToAstParser.detectDialect(sql)).toBe('mysql')
  })
})
