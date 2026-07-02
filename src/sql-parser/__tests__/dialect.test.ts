import fs from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'
import { SqlToAstParser } from '../ast-parser'
import { SchemaDialect } from '../types'

const SQL_SAMPLES = {
  postgresql: {
    src: './demo/postgres.sql',
    expectedTables: 7,
    expectedRelationships: 6,
  },
  mysql: {
    src: './demo/mysql.sql',
    expectedTables: 37,
    expectedRelationships: 31,
  },
  sqlite: {
    src: './demo/sqlite.sql',
    expectedTables: 43,
    expectedRelationships: 16,
  },
}

Object.entries(SQL_SAMPLES).forEach(([dialect, info]) => {
  describe(dialect, () => {
    const sampleSQL = fs.readFileSync(path.resolve(info.src), 'utf8')
    const parser = new SqlToAstParser(dialect as SchemaDialect)
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
