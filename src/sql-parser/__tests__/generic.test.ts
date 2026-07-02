import fs from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'
import { SqlToAstParser } from '../ast-parser'

const SQL_SAMPLES = {
  eCom: {
    src: './demo/ecommerce-schema.sql',
    expectedTables: 10,
    expectedRelationships: 13,
  },
  simple: {
    src: './demo/sample.sql',
    expectedTables: 4,
    expectedRelationships: 3,
  },
}

Object.entries(SQL_SAMPLES).forEach(([name, info]) => {
  describe(name, () => {
    const fullPath = path.resolve(info.src)
    const sampleSQL = fs.readFileSync(fullPath, 'utf8')

    const dialect = SqlToAstParser.detectDialect(sampleSQL)
    const parser = new SqlToAstParser(dialect)
    const ast = parser.parse(sampleSQL)

    it(`parses ${info.src} and generates ${ast.tables.length} tables`, () => {
      expect(ast.tables.length).toBe(info.expectedTables)
    })

    it('parses correct relationships', () => {
      const relationships = ast.tables.flatMap((table) =>
        table.constraints.filter(
          (constraint) => constraint.type === 'foreign_key'
        )
      )
      expect(relationships.length).toBe(info.expectedRelationships)
    })
  })
})
