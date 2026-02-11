import { describe, expect, it } from 'vitest'
import { SqlToAstParser } from '../ast-parser'
import type { PrimaryKeyConstraintAST } from '../types'

describe('quoting-edges-senario: edge cases in identifiers', () => {
  it('names with spaces and punctuation', () => {
    const sql = `
      CREATE TABLE \`Weird Name!\` (
        \`Col 1\` INT,
        \`Email-Addr\` VARCHAR(200),
        PRIMARY KEY (\`Col 1\`)
      );
    `
    const t = new SqlToAstParser('mysql').parse(sql).tables[0]
    expect(t.name).toBe('Weird Name!')
    expect(t.columns.map((c) => c.name)).toEqual(['Col 1', 'Email-Addr'])
    const pk = t.constraints.find((c) => c.type === 'primary_key') as
      | PrimaryKeyConstraintAST
      | undefined
    expect(pk?.columns).toEqual(['Col 1'])
  })

  it('mixed quotes in one statement', () => {
    const sql = `
      CREATE TABLE "A" ( \`B\` INT, 'C' INT, PRIMARY KEY ("A"."B") );
    `
    const t = new SqlToAstParser('postgresql').parse(sql).tables[0]
    expect(t.columns.map((c) => c.name).sort()).toEqual(['B', 'C'].sort())
  })
})
