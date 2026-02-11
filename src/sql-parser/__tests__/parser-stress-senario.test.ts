import { describe, expect, it } from 'vitest'
import { SqlToAstParser } from '../ast-parser'

describe('parser-stress-senario: many tables and constraints', () => {
  it('parses 30 small tables quickly', () => {
    const parts: string[] = []
    for (let i = 0; i < 30; i++) {
      parts.push(`
        CREATE TABLE t${i} (
          id INT PRIMARY KEY,
          v VARCHAR(10) UNIQUE
        );
      `)
    }
    const sql = parts.join('\n')
    const ast = new SqlToAstParser('mysql').parse(sql)
    expect(ast.tables.length).toBe(30)
    expect(
      ast.tables.every((t) =>
        t.constraints.some((c) => c.type === 'primary_key')
      )
    ).toBe(true)
    expect(
      ast.tables.every((t) => t.constraints.some((c) => c.type === 'unique'))
    ).toBe(true)
  })

  it('parses chain of related tables', () => {
    const count = 10
    const parts: string[] = []
    parts.push(`CREATE TABLE t0 ( id INT PRIMARY KEY );`)
    for (let i = 1; i < count; i++) {
      parts.push(`
        CREATE TABLE t${i} (
          id INT PRIMARY KEY,
          pid INT REFERENCES t${i - 1}(id)
        );
      `)
    }
    const sql = parts.join('\n')
    const ast = new SqlToAstParser('postgresql').parse(sql)
    expect(ast.tables.length).toBe(count)
    for (let i = 1; i < count; i++) {
      const t = ast.tables.find((x) => x.name === `t${i}`)!
      expect(t.constraints.some((c) => c.type === 'foreign_key')).toBe(true)
    }
  })
})
