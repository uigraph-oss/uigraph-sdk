/**
 * AST-based SQL Parser
 *
 * Converts SQL CREATE TABLE statements into an Abstract Syntax Tree (AST)
 * Supports MySQL, PostgreSQL, and SQLite dialects
 */

import { generateUUID } from 'daily-code'
import { convertNoSQLToAst } from '../nosql-parser'
import {
  CheckConstraintAST,
  ColumnAST,
  ConstraintAST,
  DataTypeAST,
  DefaultValueAST,
  ForeignKeyConstraintAST,
  IndexAST,
  IndexMethodAST,
  PrimaryKeyConstraintAST,
  ReferentialActionAST,
  SchemaAST,
  SchemaDialect,
  TableAST,
  TableOptionsAST,
  UniqueConstraintAST,
} from './types'

export class SqlToAstParser {
  private dialect: SchemaDialect

  constructor(dialect: SchemaDialect = 'mysql') {
    this.dialect = dialect
  }

  /**
   * Parse SQL dump into AST
   */
  private parseSQL(sqlContent: string): SchemaAST {
    const tables = this.extractTables(sqlContent)

    return {
      dialect: this.dialect,
      tables,
      metadata: {
        createdAt: new Date(),
      },
    }
  }

  private parseNoSQL(noSQLJsonContent: string): SchemaAST {
    const parsed = JSON.parse(noSQLJsonContent || '{}') as {
      tables?: TableAST[]
      collections?: { name: string; fields: Record<string, string> }[]
    }

    const existingTables = Array.isArray(parsed.tables) ? parsed.tables : null
    if (existingTables && existingTables.length > 0) {
      return {
        dialect: this.dialect,
        tables: existingTables,
        metadata: {
          createdAt: new Date(),
        },
      }
    }

    const collections = Array.isArray(parsed.collections)
      ? parsed.collections
      : []

    const tables = collections
      .map((collection) => {
        if (!collection || !collection.name) return null

        const fields =
          collection.fields && typeof collection.fields === 'object'
            ? collection.fields
            : {}

        const columns = Object.entries(fields).map(([name, type]) => ({
          type: 'column' as const,
          name,
          dataType: this.parseNoSqlType(String(type || 'string')),
          nullable: true,
        }))

        return {
          type: 'table',
          id: generateUUID(),
          name: collection.name,
          columns,
          constraints: [],
          indexes: [],
        }
      })
      .filter(Boolean) as TableAST[]

    return {
      dialect: this.dialect,
      tables,
      metadata: {
        createdAt: new Date(),
      },
    }
  }

  parse(sqlContent: string, useStrictNoSQL = false): SchemaAST {
    switch (this.dialect) {
      case 'json':
      case 'mongodb':
      case 'dynamodb':
        if (useStrictNoSQL) {
          const parsed = JSON.parse(sqlContent)
          return convertNoSQLToAst(parsed)
        }

        return this.parseNoSQL(sqlContent)

      default:
        return this.parseSQL(sqlContent)
    }
  }

  /**
   * Auto-detect SQL dialect
   */
  static detectDialect(sqlContent: string): SchemaDialect {
    const content = sqlContent.toLowerCase()

    try {
      JSON.parse(sqlContent)
      return 'json'
    } catch {
      // Continue parsing SQL
    }

    // PostgreSQL specific keywords
    if (
      content.includes('serial') ||
      content.includes('bigserial') ||
      content.includes('::') || // Type casting
      content.includes('nextval(') ||
      content.includes('create schema')
    ) {
      return 'postgresql'
    }

    // MySQL specific keywords
    if (
      content.includes('engine=') ||
      content.includes('auto_increment') ||
      content.includes('unsigned') ||
      content.includes('character set') ||
      content.includes('collate')
    ) {
      return 'mysql'
    }

    // Default to MySQL as it's more common
    return 'mysql'
  }

  /**
   * Extract all tables from SQL content
   */
  private extractTables(sqlContent: string): TableAST[] {
    const tables: TableAST[] = []
    const tableMap = new Map<string, TableAST>()

    // Clean SQL content
    const cleanedSQL = this.cleanSql(sqlContent)

    // Extract CREATE TABLE statements
    const createTableRegex = /CREATE\s+TABLE[\s\S]*?;/gi
    let match

    while ((match = createTableRegex.exec(cleanedSQL)) !== null) {
      const statement = match[0]
      const components = this.extractCreateTableComponents(statement)
      if (!components) continue

      const { rawIdentifier, tableName, tableBody, tableOptions } = components
      const tableKey = this.normalizeTableKey(rawIdentifier)
      if (tableMap.has(tableKey)) continue

      try {
        const table = this.parseTableDefinition(
          tableName,
          tableBody,
          tableOptions
        )
        tables.push(table)
        tableMap.set(tableKey, table)
      } catch (error) {
        console.error('Error parsing table:', error)
        // Continue parsing other tables
      }
    }

    this.applyAlterTableStatements(cleanedSQL, tableMap)

    return tables
  }

  private extractCreateTableComponents(statement: string): {
    rawIdentifier: string
    tableName: string
    tableBody: string
    tableOptions: string
  } | null {
    const trimmedStatement = statement.trim()
    const headerRegex =
      /^CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?((?:`[^`]+`|"[^"]+"|'[^']+'|\[[^\]]+\]|\w+)(?:\.(?:`[^`]+`|"[^"]+"|'[^']+'|\[[^\]]+\]|\w+))?)\s*\(/i
    const headerMatch = headerRegex.exec(trimmedStatement)
    if (!headerMatch) {
      return null
    }

    const rawIdentifier = headerMatch[1]
    const openParenIndex = headerMatch[0].length - 1
    const closeParenIndex = this.findClosingParenthesis(
      trimmedStatement,
      openParenIndex
    )
    if (closeParenIndex === -1) {
      return null
    }

    const body = trimmedStatement.slice(openParenIndex + 1, closeParenIndex)
    const options = trimmedStatement
      .slice(closeParenIndex + 1, trimmedStatement.length - 1)
      .trim()

    return {
      rawIdentifier,
      tableName: this.normalizeTableName(rawIdentifier),
      tableBody: body,
      tableOptions: options,
    }
  }

  private findClosingParenthesis(str: string, startIndex: number): number {
    let depth = 0
    let inQuotes = false
    let quoteChar = ''

    for (let i = startIndex; i < str.length; i++) {
      const char = str[i]
      const prevChar = i > 0 ? str[i - 1] : ''

      if ((char === '"' || char === "'" || char === '`') && prevChar !== '\\') {
        if (!inQuotes) {
          inQuotes = true
          quoteChar = char
        } else if (char === quoteChar) {
          inQuotes = false
          quoteChar = ''
        }
      }

      if (inQuotes) continue

      if (char === '(') {
        depth++
      } else if (char === ')') {
        depth--
        if (depth === 0) {
          return i
        }
      }
    }

    return -1
  }

  private applyAlterTableStatements(
    sqlContent: string,
    tableMap: Map<string, TableAST>
  ): void {
    const alterRegex =
      /ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:ONLY\s+)?((?:`[^`]+`|"[^"]+"|'[^']+'|\[[^\]]+\]|[\w$]+)(?:\.(?:`[^`]+`|"[^"]+"|'[^']+'|\[[^\]]+\]|[\w$]+))?)\s+([\s\S]*?);/gi
    let match

    while ((match = alterRegex.exec(sqlContent)) !== null) {
      const rawIdentifier = match[1]
      const actionsBlock = match[2] || ''
      if (!rawIdentifier) continue
      const table = tableMap.get(this.normalizeTableKey(rawIdentifier))
      if (!table) continue
      const actions = this.splitTableBody(actionsBlock)

      for (const action of actions) {
        const trimmed = action.trim()
        if (!trimmed) continue
        if (/^ADD\s+/i.test(trimmed)) {
          const definition = trimmed.replace(/^ADD\s+/i, '').trim()
          if (!definition) continue
          const constraint = this.parseConstraint(definition)
          if (constraint) {
            table.constraints.push(constraint)
            continue
          }
          const index = this.parseIndex(definition)
          if (index) {
            table.indexes.push(index)
          }
        }
      }
    }
  }

  /**
   * Clean SQL content (remove comments, normalize whitespace)
   */
  private cleanSql(sql: string): string {
    return sql
      .replace(/--.*$/gm, '') // Single line comments
      .replace(/\/\*[\s\S]*?\*\//g, '') // Multi-line comments
      .replace(/\r\n/g, '\n') // Normalize line endings
      .trim()
  }

  /**
   * Clean identifier (remove quotes, backticks)
   */
  private cleanIdentifier(identifier: string): string {
    return identifier.replace(/[`"'\[\]]/g, '').trim()
  }

  private normalizeTableName(identifier: string): string {
    const cleaned = this.cleanIdentifier(identifier)
    if (!cleaned) return ''
    const parts = cleaned.split('.')
    return parts[parts.length - 1]
  }

  private normalizeTableKey(identifier: string): string {
    return this.cleanIdentifier(identifier).toLowerCase()
  }

  private parseNoSqlType(rawType: string): DataTypeAST {
    const trimmed = rawType.trim()
    const lower = trimmed.toLowerCase()

    if (lower.startsWith('array<') && lower.endsWith('>')) {
      const inner = trimmed.slice(6, -1).trim() || 'string'
      return { name: `array<${inner}>` }
    }

    return { name: trimmed || 'string' }
  }

  /**
   * Parse table definition
   */
  private parseTableDefinition(
    tableName: string,
    tableBody: string,
    tableOptionsStr: string
  ): TableAST {
    const columns: ColumnAST[] = []
    const constraints: ConstraintAST[] = []
    const indexes: IndexAST[] = []
    const pendingColumns: { column: ColumnAST; hasType: boolean }[] = []

    // Split table body into lines, being careful with nested parentheses
    const lines = this.splitTableBody(tableBody)

    for (const line of lines) {
      const trimmedLine = line.trim()
      if (!trimmedLine) continue

      try {
        const tableLevelPattern =
          /^(?:CONSTRAINT|PRIMARY\s+KEY|FOREIGN\s+KEY|UNIQUE|CHECK|INDEX|KEY)\b/i
        let column: ColumnAST | null = null

        if (!tableLevelPattern.test(trimmedLine)) {
          column = this.parseColumn(trimmedLine)
          if (column) {
            pendingColumns.push({
              column,
              hasType: !!column.dataType.name,
            })
            this.applyInlineColumnConstraints(trimmedLine, column, constraints)
            continue
          }
        }

        const constraint = this.parseConstraint(trimmedLine)
        if (constraint) {
          constraints.push(constraint)
          continue
        }

        const index = this.parseIndex(trimmedLine)
        if (index) {
          indexes.push(index)
          continue
        }

        if (!column) {
          column = this.parseColumn(trimmedLine)
        }

        if (column) {
          pendingColumns.push({
            column,
            hasType: !!column.dataType.name,
          })
          this.applyInlineColumnConstraints(trimmedLine, column, constraints)
        }
      } catch (error) {
        console.warn('Error parsing line:', trimmedLine, error)
      }
    }

    const typedColumnsCount = pendingColumns.filter((c) => c.hasType).length

    pendingColumns.forEach((entry, index) => {
      if (!entry.hasType) {
        const hasTypedAfter = pendingColumns
          .slice(index + 1)
          .some((c) => c.hasType)
        if (!(typedColumnsCount < 4 && hasTypedAfter)) {
          return
        }
      }
      columns.push(entry.column)
    })

    // Parse table options
    const options = this.parseTableOptions(tableOptionsStr)

    return {
      type: 'table',
      id: generateUUID(),
      name: tableName,
      columns,
      constraints,
      indexes,
      options,
    }
  }

  /**
   * Split table body by commas, respecting parentheses
   */
  private splitTableBody(body: string): string[] {
    const lines: string[] = []
    let currentLine = ''
    let parenthesesDepth = 0
    let inQuotes = false
    let quoteChar = ''

    for (let i = 0; i < body.length; i++) {
      const char = body[i]
      const prevChar = i > 0 ? body[i - 1] : ''

      // Handle quotes
      if ((char === '"' || char === "'" || char === '`') && prevChar !== '\\') {
        if (!inQuotes) {
          inQuotes = true
          quoteChar = char
        } else if (char === quoteChar) {
          inQuotes = false
          quoteChar = ''
        }
      }

      if (!inQuotes) {
        if (char === '(') {
          parenthesesDepth++
        } else if (char === ')') {
          parenthesesDepth--
        }
      }

      if (char === ',' && parenthesesDepth === 0 && !inQuotes) {
        lines.push(currentLine.trim())
        currentLine = ''
      } else {
        currentLine += char
      }
    }

    if (currentLine.trim()) {
      lines.push(currentLine.trim())
    }

    return lines
  }

  /**
   * Parse column definition
   */
  private parseColumn(line: string): ColumnAST | null {
    const columnPattern =
      /^(?:`([^`]+)`|"([^"]+)"|'([^']+)'|\[([^\]]+)\]|([a-zA-Z_][\w$]*))\s+([\s\S]+)$/i
    const match = line.match(columnPattern)

    if (!match) return null

    const rawName =
      match[1] ?? match[2] ?? match[3] ?? match[4] ?? match[5] ?? ''
    if (!rawName) return null

    const definition = match[6]?.trim().replace(/,+$/, '')
    if (!definition) return null

    const { dataTypeStr, constraintsStr } =
      this.splitColumnDefinition(definition)
    const constraintsSegment = constraintsStr || ''

    // Parse data type
    const dataType = this.parseDataType(dataTypeStr)

    // Parse column constraints
    let nullable = !/NOT\s+NULL/i.test(constraintsSegment)
    const autoIncrement =
      /AUTO_INCREMENT/i.test(constraintsSegment) ||
      /AUTOINCREMENT/i.test(constraintsSegment) ||
      /(SERIAL|BIGSERIAL)/i.test(dataTypeStr)

    if (autoIncrement || /\bPRIMARY\s+KEY\b/i.test(constraintsSegment)) {
      nullable = false
    }

    // Parse default value
    let defaultValue: DefaultValueAST | undefined
    const defaultMatch = constraintsSegment.match(
      /DEFAULT\s+((?:'[^']*'|"[^"]*"|\([^)]*\)|[^\s,]+))/i
    )
    if (defaultMatch) {
      defaultValue = this.parseDefaultValue(defaultMatch[1])
    }

    // Extract comment
    let comment: string | undefined
    const commentMatch = constraintsSegment.match(/COMMENT\s+['"]([^'"]+)['"]/i)
    if (commentMatch) {
      comment = commentMatch[1]
    }

    const column: ColumnAST = {
      type: 'column',
      name: this.cleanIdentifier(rawName),
      dataType,
      nullable,
      defaultValue,
      autoIncrement,
      comment,
    }

    const collateMatch =
      constraintsSegment.match(/COLLATE\s+([^\s,]+)/i) ||
      line.match(/COLLATE\s+([^\s,]+)/i)
    if (collateMatch) {
      column.collation = this.cleanIdentifier(collateMatch[1])
    }

    const charsetMatch =
      constraintsSegment.match(/CHARACTER\s+SET\s+([^\s,]+)/i) ||
      constraintsSegment.match(/CHARSET\s*=?\s*([^\s,]+)/i) ||
      line.match(/CHARACTER\s+SET\s+([^\s,]+)/i) ||
      line.match(/CHARSET\s*=?\s*([^\s,]+)/i)
    if (charsetMatch) {
      column.charset = this.cleanIdentifier(charsetMatch[1])
    }

    return column
  }

  private splitColumnDefinition(definition: string): {
    dataTypeStr: string
    constraintsStr: string
  } {
    const constraintRegex =
      /\b(?:GENERATED|DEFAULT|NOT\s+NULL|NULL|UNIQUE|PRIMARY\s+KEY|CHECK|REFERENCES|COLLATE|COMMENT|AUTO(?:_|\s*)INCREMENT|ON\s+UPDATE|ON\s+DELETE|CONSTRAINT)\b/i
    const match = constraintRegex.exec(definition)

    if (!match) {
      return {
        dataTypeStr: definition.trim(),
        constraintsStr: '',
      }
    }

    return {
      dataTypeStr: definition.slice(0, match.index).trim(),
      constraintsStr: definition.slice(match.index).trim(),
    }
  }

  private applyInlineColumnConstraints(
    line: string,
    column: ColumnAST,
    constraints: ConstraintAST[]
  ): void {
    const columnName = column.name

    if (/\bPRIMARY\s+KEY\b/i.test(line)) {
      const nameMatch = line.match(
        /CONSTRAINT\s+["'`]?([^"'`\s]+)["'`"]?.*PRIMARY\s+KEY/i
      )
      const name = nameMatch ? this.cleanIdentifier(nameMatch[1]) : undefined
      const existing = constraints.find((c) => c.type === 'primary_key') as
        | PrimaryKeyConstraintAST
        | undefined

      if (existing) {
        if (!existing.columns.includes(columnName)) {
          existing.columns.push(columnName)
        }
      } else {
        constraints.push({
          type: 'primary_key',
          name,
          columns: [columnName],
        })
      }
    }

    if (/\bUNIQUE\b/i.test(line) && !/\bUNIQUE\s+(?:KEY|INDEX)\b/i.test(line)) {
      const nameMatch = line.match(
        /CONSTRAINT\s+["'`]?([^"'`\s]+)["'`"]?.*UNIQUE/i
      )
      const name = nameMatch ? this.cleanIdentifier(nameMatch[1]) : undefined
      const exists = constraints.some(
        (c) =>
          c.type === 'unique' &&
          c.columns.length === 1 &&
          c.columns[0] === columnName
      )

      if (!exists) {
        constraints.push({
          type: 'unique',
          name,
          columns: [columnName],
        })
      }
    }

    const referencesMatch = line.match(/REFERENCES\s+([^\s(]+)\s*\(([^)]+)\)/i)

    if (referencesMatch) {
      const nameMatch = line.match(
        /CONSTRAINT\s+["'`]?([^"'`\s]+)["'`"]?.*FOREIGN\s+KEY/i
      )
      const name = nameMatch ? this.cleanIdentifier(nameMatch[1]) : undefined
      const referencedTable = this.normalizeTableName(referencesMatch[1])
      const referencedColumns = referencesMatch[2]
        .split(',')
        .map((c) => this.cleanIdentifier(c.trim()))
      const onDelete = this.extractReferentialAction(line, 'DELETE')
      const onUpdate = this.extractReferentialAction(line, 'UPDATE')
      const exists = constraints.some(
        (c) =>
          c.type === 'foreign_key' &&
          c.columns.length === 1 &&
          c.columns[0] === columnName &&
          c.referencedTable === referencedTable
      )

      if (!exists) {
        constraints.push({
          type: 'foreign_key',
          name,
          columns: [columnName],
          referencedTable,
          referencedColumns,
          onDelete,
          onUpdate,
        })
      }
    }

    if (/CHECK\s*\(/i.test(line)) {
      const check = this.parseCheck(line)
      if (
        check &&
        !constraints.some(
          (c) => c.type === 'check' && c.expression === check.expression
        )
      ) {
        constraints.push(check)
      }
    }
  }

  /**
   * Parse data type
   */
  private parseDataType(dataTypeStr: string): DataTypeAST {
    // Extract type name and parameters
    const match = dataTypeStr.match(/^(\w+)(?:\(([^)]+)\))?(.*)?$/i)

    if (!match) {
      return { name: dataTypeStr.trim().toUpperCase() }
    }

    const name = match[1].toUpperCase()
    const paramsStr = match[2]
    const modifiers = match[3] || ''

    const dataType: DataTypeAST = { name }

    // Parse parameters
    if (paramsStr) {
      dataType.parameters = paramsStr.split(',').map((p) => {
        const trimmed = p.trim()
        const num = Number(trimmed)
        return isNaN(num) ? trimmed : num
      })
    }

    // Parse modifiers
    dataType.unsigned = /UNSIGNED/i.test(modifiers)
    dataType.timezone = /WITH TIME ZONE/i.test(modifiers)

    return dataType
  }

  /**
   * Parse default value
   */
  private parseDefaultValue(value: string): DefaultValueAST {
    const trimmed = value.trim()

    // NULL
    if (/^NULL$/i.test(trimmed)) {
      return { type: 'literal', value: null, raw: trimmed }
    }

    // Function call
    if (/\w+\(.*\)/i.test(trimmed)) {
      return { type: 'function', value: trimmed, raw: trimmed }
    }

    // String literal
    if (/^['"].*['"]$/.test(trimmed)) {
      return {
        type: 'literal',
        value: trimmed.slice(1, -1),
        raw: trimmed,
      }
    }

    // Number
    const num = Number(trimmed)
    if (!isNaN(num)) {
      return { type: 'literal', value: num, raw: trimmed }
    }

    // Expression
    return { type: 'expression', value: trimmed, raw: trimmed }
  }

  /**
   * Parse constraint
   */
  private parseConstraint(line: string): ConstraintAST | null {
    // Primary Key
    if (/PRIMARY\s+KEY/i.test(line)) {
      return this.parsePrimaryKey(line)
    }

    // Foreign Key
    if (/FOREIGN\s+KEY/i.test(line)) {
      return this.parseForeignKey(line)
    }

    // Unique
    if (/UNIQUE/i.test(line) && !/INDEX|KEY/i.test(line)) {
      return this.parseUnique(line)
    }

    // Check
    if (/CHECK/i.test(line)) {
      return this.parseCheck(line)
    }

    return null
  }

  /**
   * Parse primary key constraint
   */
  private parsePrimaryKey(line: string): PrimaryKeyConstraintAST | null {
    const match = line.match(
      /(?:CONSTRAINT\s+["'`]?([^"'`\s]+)["'`"]?\s+)?PRIMARY\s+KEY\s*\(([^)]+)\)/i
    )

    if (!match) return null

    const name = match[1] ? this.cleanIdentifier(match[1]) : undefined
    const columns = match[2]
      .split(',')
      .map((c) => this.cleanIdentifier(c.trim()))

    return {
      type: 'primary_key',
      name,
      columns,
    }
  }

  /**
   * Parse foreign key constraint
   */
  private parseForeignKey(line: string): ForeignKeyConstraintAST | null {
    const match = line.match(
      /(?:CONSTRAINT\s+["'`]?([^"'`\s]+)["'`"]?\s+)?FOREIGN\s+KEY\s*\(([^)]+)\)\s*REFERENCES\s+((?:["'`]?[\w$]+["'`"]?|\[[^\]]+\])(?:\.(?:["'`]?[\w$]+["'`"]?|\[[^\]]+\]))?)\s*\(([^)]+)\)/i
    )

    if (!match) return null

    const name = match[1] ? this.cleanIdentifier(match[1]) : undefined
    const columns = match[2]
      .split(',')
      .map((c) => this.cleanIdentifier(c.trim()))
    const referencedTable = this.normalizeTableName(match[3])
    const referencedColumns = match[4]
      .split(',')
      .map((c) => this.cleanIdentifier(c.trim()))
    const onDelete = this.extractReferentialAction(line, 'DELETE')
    const onUpdate = this.extractReferentialAction(line, 'UPDATE')

    return {
      type: 'foreign_key',
      name,
      columns,
      referencedTable,
      referencedColumns,
      onDelete,
      onUpdate,
    }
  }

  private extractReferentialAction(
    segment: string,
    actionType: 'DELETE' | 'UPDATE'
  ): ReferentialActionAST | undefined {
    const regex = new RegExp(
      `ON\\s+${actionType}\\s+([A-Z\\s]+?)(?=\\s+ON\\s+(?:DELETE|UPDATE)\\b|,|\\)|$)`,
      'i'
    )
    const match = segment.match(regex)
    if (!match) return undefined

    const normalized = match[1].trim().replace(/\s+/g, ' ').toUpperCase()

    if (
      normalized === 'CASCADE' ||
      normalized === 'SET NULL' ||
      normalized === 'SET DEFAULT' ||
      normalized === 'RESTRICT' ||
      normalized === 'NO ACTION'
    ) {
      return normalized as ReferentialActionAST
    }

    return undefined
  }

  /**
   * Parse unique constraint
   */
  private parseUnique(line: string): UniqueConstraintAST | null {
    const match = line.match(
      /(?:CONSTRAINT\s+["'`]?([^"'`\s]+)["'`"]?\s+)?UNIQUE\s*\(([^)]+)\)/i
    )

    if (!match) return null

    const name = match[1] ? this.cleanIdentifier(match[1]) : undefined
    const columns = match[2]
      .split(',')
      .map((c) => this.cleanIdentifier(c.trim()))

    return {
      type: 'unique',
      name,
      columns,
    }
  }

  /**
   * Parse check constraint
   */
  private parseCheck(line: string): CheckConstraintAST | null {
    const match = line.match(
      /(?:CONSTRAINT\s+["'`]?([^"'`\s]+)["'`"]?\s+)?CHECK\s*\(([\s\S]*?)\)/i
    )

    if (!match) return null

    const name = match[1] ? this.cleanIdentifier(match[1]) : undefined
    const expression = match[2].trim()

    return {
      type: 'check',
      name,
      expression,
    }
  }

  /**
   * Parse index definition
   */
  private parseIndex(line: string): IndexAST | null {
    const match = line.match(
      /(UNIQUE\s+)?(?:INDEX|KEY)\s+["'`]?([^"'`\s]+)["'`"]?\s*\(([^)]+)\)(?:\s+USING\s+(\w+))?/i
    )

    if (!match) return null

    const unique = !!match[1]
    const name = this.cleanIdentifier(match[2])
    const columnsStr = match[3]
    const method = match[4]?.toLowerCase() as IndexMethodAST | undefined

    const columns = columnsStr.split(',').map((col) => {
      const colMatch = col
        .trim()
        .match(
          /^(?:`([^`]+)`|"([^"]+)"|'([^']+)'|\[([^\]]+)\]|([^\s(]+))(?:\((\d+)\))?(?:\s+(ASC|DESC))?$/i
        )
      if (!colMatch) return { name: this.cleanIdentifier(col.trim()) }

      return {
        name: this.cleanIdentifier(
          colMatch[1] ??
            colMatch[2] ??
            colMatch[3] ??
            colMatch[4] ??
            colMatch[5] ??
            ''
        ),
        length: colMatch[6] ? Number(colMatch[6]) : undefined,
        order: colMatch[7]?.toUpperCase() as 'ASC' | 'DESC' | undefined,
      }
    })

    return {
      type: 'index',
      name,
      columns,
      unique,
      method,
    }
  }

  /**
   * Parse table options
   */
  private parseTableOptions(optionsStr: string): TableOptionsAST | undefined {
    if (!optionsStr.trim()) return undefined

    const options: TableOptionsAST = {}

    // ENGINE
    const engineMatch = optionsStr.match(/ENGINE\s*=\s*(\w+)/i)
    if (engineMatch) options.engine = engineMatch[1]

    // CHARACTER SET
    const charsetMatch = optionsStr.match(
      /(?:DEFAULT\s+)?(?:CHARACTER\s+SET|CHARSET)\s*=?\s*([^\s;]+)/i
    )
    if (charsetMatch) options.charset = this.cleanIdentifier(charsetMatch[1])

    // COLLATE
    const collateMatch = optionsStr.match(/COLLATE\s*=?\s*([^\s;]+)/i)
    if (collateMatch) options.collation = this.cleanIdentifier(collateMatch[1])

    // AUTO_INCREMENT
    const autoIncMatch = optionsStr.match(/AUTO_INCREMENT\s*=\s*(\d+)/i)
    if (autoIncMatch) options.autoIncrement = Number(autoIncMatch[1])

    // COMMENT
    const commentMatch = optionsStr.match(/COMMENT\s*=\s*['"]([^'"]+)['"]/i)
    if (commentMatch) options.comment = commentMatch[1]

    return Object.keys(options).length > 0 ? options : undefined
  }
}
