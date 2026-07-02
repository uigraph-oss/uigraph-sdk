import { describe, expect, it } from 'vitest'
import { SqlToAstParser } from '../ast-parser'

describe('table options matrix', () => {
  it('engine only', () => {
    const sql = `CREATE TABLE t ( id INT ) ENGINE=InnoDB;`
    const ast = new SqlToAstParser('mysql').parse(sql)
    expect(ast.tables[0].options?.engine).toBe('InnoDB')
  })

  it('charset only', () => {
    const sql = `CREATE TABLE t ( id INT ) DEFAULT CHARSET=utf8mb4;`
    const ast = new SqlToAstParser('mysql').parse(sql)
    expect(ast.tables[0].options?.charset).toBe('utf8mb4')
  })

  it('collate only', () => {
    const sql = `CREATE TABLE t ( id INT ) COLLATE=utf8mb4_bin;`
    const ast = new SqlToAstParser('mysql').parse(sql)
    expect(ast.tables[0].options?.collation).toBe('utf8mb4_bin')
  })

  it('auto increment only', () => {
    const sql = `CREATE TABLE t ( id INT ) AUTO_INCREMENT=101;`
    const ast = new SqlToAstParser('mysql').parse(sql)
    expect(ast.tables[0].options?.autoIncrement).toBe(101)
  })

  it('comment only', () => {
    const sql = `CREATE TABLE t ( id INT ) COMMENT='hello';`
    const ast = new SqlToAstParser('mysql').parse(sql)
    expect(ast.tables[0].options?.comment).toBe('hello')
  })

  it('mix order', () => {
    const sql = `
      CREATE TABLE t ( id INT )
      COLLATE = utf8mb4_bin ENGINE=InnoDB COMMENT='x' AUTO_INCREMENT=5 CHARACTER SET = utf8mb4;
    `
    const ast = new SqlToAstParser('mysql').parse(sql)
    const o = ast.tables[0].options
    expect(o?.engine).toBe('InnoDB')
    expect(o?.collation).toBe('utf8mb4_bin')
    expect(o?.comment).toBe('x')
    expect(o?.autoIncrement).toBe(5)
    expect(o?.charset).toBe('utf8mb4')
  })

  it('no options yields undefined', () => {
    const sql = `CREATE TABLE t ( id INT );`
    const ast = new SqlToAstParser('mysql').parse(sql)
    expect(ast.tables[0].options).toBeUndefined()
  })
})
