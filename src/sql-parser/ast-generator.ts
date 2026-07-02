/**
 * AST to SQL Generator
 *
 * Converts AST back to SQL CREATE TABLE statements
 * Supports MySQL, PostgreSQL, and SQLite dialects
 */

import {
  CheckConstraintAST,
  ColumnAST,
  ConstraintAST,
  DataTypeAST,
  DefaultValueAST,
  ForeignKeyConstraintAST,
  IndexAST,
  PrimaryKeyConstraintAST,
  SchemaAST,
  SchemaDialect,
  TableAST,
  UniqueConstraintAST,
} from './types'

export class AstToSqlGenerator {
  private dialect: SchemaDialect
  private indentSize: number

  constructor(dialect: SchemaDialect = 'mysql', indentSize: number = 2) {
    this.dialect = dialect
    this.indentSize = indentSize
  }

  private generateNoSQL(schema: SchemaAST): string {
    return JSON.stringify({ tables: schema.tables }, null, this.indentSize)
  }

  /**
   * Generate SQL from schema AST
   */
  private generateSQL(schema: SchemaAST): string {
    const statements: string[] = []

    // Add header comment
    statements.push(`-- Generated SQL Schema (${schema.dialect.toUpperCase()})`)
    statements.push(`-- Generated at: ${new Date().toISOString()}`)
    statements.push('')

    // Generate CREATE TABLE statements
    schema.tables.forEach((table) => {
      const sql = this.generateCreateTable(table)
      statements.push(sql)
      statements.push('')
    })

    return statements.join('\n')
  }

  public generate(schema: SchemaAST): string {
    switch (this.dialect) {
      case 'dynamodb':
      case 'mongodb':
      case 'json':
        return this.generateNoSQL(schema)

      default:
        return this.generateSQL(schema)
    }
  }

  /**
   * Generate CREATE TABLE statement
   */
  private generateCreateTable(table: TableAST): string {
    const lines: string[] = []
    const indent = ' '.repeat(this.indentSize)

    // Table header
    const tableName = this.quoteIdentifier(table.name)
    lines.push(`CREATE TABLE IF NOT EXISTS ${tableName} (`)

    // Collect all definitions
    const definitions: string[] = []

    // Add columns
    table.columns.forEach((column) => {
      definitions.push(this.generateColumn(column))
    })

    // Add constraints
    table.constraints.forEach((constraint) => {
      definitions.push(this.generateConstraint(constraint))
    })

    // Add inline indexes (for MySQL)
    if (this.dialect === 'mysql') {
      table.indexes.forEach((index) => {
        definitions.push(this.generateIndex(index))
      })
    }

    // Join definitions with commas
    lines.push(definitions.map((def) => `${indent}${def}`).join(',\n'))

    // Close table definition
    lines.push(')')

    // Add table options
    const options = this.generateTableOptions(table)
    if (options) {
      lines[lines.length - 1] += ` ${options}`
    }

    lines[lines.length - 1] += ';'

    // Add PostgreSQL indexes separately
    if (this.dialect === 'postgresql') {
      table.indexes.forEach((index) => {
        lines.push('')
        lines.push(this.generatePostgresIndex(index, table.name))
      })
    }

    return lines.join('\n')
  }

  /**
   * Generate column definition
   */
  private generateColumn(column: ColumnAST): string {
    const parts: string[] = []

    // Column name
    parts.push(this.quoteIdentifier(column.name))

    // Data type
    parts.push(this.generateDataType(column.dataType))

    // NULL/NOT NULL
    parts.push(column.nullable ? 'NULL' : 'NOT NULL')

    // Default value
    if (column.defaultValue) {
      parts.push(`DEFAULT ${this.generateDefaultValue(column.defaultValue)}`)
    }

    // Auto increment
    if (column.autoIncrement) {
      if (this.dialect === 'mysql') {
        parts.push('AUTO_INCREMENT')
      } else if (this.dialect === 'postgresql') {
        // PostgreSQL uses SERIAL type instead
      }
    }

    // Comment
    if (column.comment) {
      if (this.dialect === 'mysql') {
        parts.push(`COMMENT '${column.comment.replace(/'/g, "''")}'`)
      }
    }

    return parts.join(' ')
  }

  /**
   * Generate data type string
   */
  private generateDataType(dataType: DataTypeAST): string {
    let type = dataType.name

    // Add parameters
    if (dataType.parameters && dataType.parameters.length > 0) {
      type += `(${dataType.parameters.join(', ')})`
    }

    // Add modifiers
    if (dataType.unsigned) {
      type += ' UNSIGNED'
    }

    if (dataType.timezone) {
      type += ' WITH TIME ZONE'
    }

    return type
  }

  /**
   * Generate default value
   */
  private generateDefaultValue(defaultValue: DefaultValueAST): string {
    if (defaultValue.type === 'literal') {
      if (defaultValue.value === null) {
        return 'NULL'
      }
      if (typeof defaultValue.value === 'string') {
        return `'${defaultValue.value.replace(/'/g, "''")}'`
      }
      return String(defaultValue.value)
    }

    if (
      defaultValue.type === 'function' ||
      defaultValue.type === 'expression'
    ) {
      return defaultValue.raw || String(defaultValue.value)
    }

    return String(defaultValue.value)
  }

  /**
   * Generate constraint definition
   */
  private generateConstraint(constraint: ConstraintAST): string {
    switch (constraint.type) {
      case 'primary_key':
        return this.generatePrimaryKey(constraint)
      case 'foreign_key':
        return this.generateForeignKey(constraint)
      case 'unique':
        return this.generateUnique(constraint)
      case 'check':
        return this.generateCheck(constraint)
      default:
        return ''
    }
  }

  /**
   * Generate PRIMARY KEY constraint
   */
  private generatePrimaryKey(constraint: PrimaryKeyConstraintAST): string {
    const columns = constraint.columns
      .map((c: string) => this.quoteIdentifier(c))
      .join(', ')

    if (constraint.name) {
      return `CONSTRAINT ${this.quoteIdentifier(constraint.name)} PRIMARY KEY (${columns})`
    }

    return `PRIMARY KEY (${columns})`
  }

  /**
   * Generate FOREIGN KEY constraint
   */
  private generateForeignKey(constraint: ForeignKeyConstraintAST): string {
    const parts: string[] = []

    if (constraint.name) {
      parts.push(`CONSTRAINT ${this.quoteIdentifier(constraint.name)}`)
    }

    const columns = constraint.columns
      .map((c) => this.quoteIdentifier(c))
      .join(', ')
    const refTable = this.quoteIdentifier(constraint.referencedTable)
    const refColumns = constraint.referencedColumns
      .map((c) => this.quoteIdentifier(c))
      .join(', ')

    parts.push(`FOREIGN KEY (${columns})`)
    parts.push(`REFERENCES ${refTable} (${refColumns})`)

    if (constraint.onDelete) {
      parts.push(`ON DELETE ${constraint.onDelete}`)
    }

    if (constraint.onUpdate) {
      parts.push(`ON UPDATE ${constraint.onUpdate}`)
    }

    return parts.join(' ')
  }

  /**
   * Generate UNIQUE constraint
   */
  private generateUnique(constraint: UniqueConstraintAST): string {
    const columns = constraint.columns
      .map((c: string) => this.quoteIdentifier(c))
      .join(', ')

    if (constraint.name) {
      return `CONSTRAINT ${this.quoteIdentifier(constraint.name)} UNIQUE (${columns})`
    }

    return `UNIQUE (${columns})`
  }

  /**
   * Generate CHECK constraint
   */
  private generateCheck(constraint: CheckConstraintAST): string {
    if (constraint.name) {
      return `CONSTRAINT ${this.quoteIdentifier(constraint.name)} CHECK (${constraint.expression})`
    }

    return `CHECK (${constraint.expression})`
  }

  /**
   * Generate INDEX definition (MySQL inline)
   */
  private generateIndex(index: IndexAST): string {
    const parts: string[] = []

    if (index.unique) {
      parts.push('UNIQUE')
    }

    parts.push('INDEX')
    parts.push(this.quoteIdentifier(index.name))

    const columns = index.columns.map((col) => {
      let colDef = this.quoteIdentifier(col.name)
      if (col.length) {
        colDef += `(${col.length})`
      }
      if (col.order) {
        colDef += ` ${col.order}`
      }
      return colDef
    })

    parts.push(`(${columns.join(', ')})`)

    if (index.method && this.dialect === 'mysql') {
      parts.push(`USING ${index.method.toUpperCase()}`)
    }

    return parts.join(' ')
  }

  /**
   * Generate INDEX definition (PostgreSQL separate statement)
   */
  private generatePostgresIndex(index: IndexAST, tableName: string): string {
    const parts: string[] = []

    parts.push('CREATE')

    if (index.unique) {
      parts.push('UNIQUE')
    }

    parts.push('INDEX')
    parts.push(this.quoteIdentifier(index.name))
    parts.push('ON')
    parts.push(this.quoteIdentifier(tableName))

    if (index.method) {
      parts.push(`USING ${index.method.toUpperCase()}`)
    }

    const columns = index.columns.map((col) => {
      let colDef = this.quoteIdentifier(col.name)
      if (col.order) {
        colDef += ` ${col.order}`
      }
      return colDef
    })

    parts.push(`(${columns.join(', ')})`)

    if (index.where) {
      parts.push(`WHERE ${index.where}`)
    }

    return parts.join(' ') + ';'
  }

  /**
   * Generate table options
   */
  private generateTableOptions(table: TableAST): string | null {
    if (!table.options) return null

    const parts: string[] = []

    if (this.dialect === 'mysql') {
      if (table.options.engine) {
        parts.push(`ENGINE=${table.options.engine}`)
      }

      if (table.options.charset) {
        parts.push(`CHARACTER SET ${table.options.charset}`)
      }

      if (table.options.collation) {
        parts.push(`COLLATE ${table.options.collation}`)
      }

      if (table.options.autoIncrement) {
        parts.push(`AUTO_INCREMENT=${table.options.autoIncrement}`)
      }

      if (table.options.comment) {
        parts.push(`COMMENT='${table.options.comment.replace(/'/g, "''")}'`)
      }
    }

    if (this.dialect === 'postgresql') {
      // PostgreSQL table options are handled differently
      if (table.options.tablespace) {
        parts.push(`TABLESPACE ${table.options.tablespace}`)
      }
    }

    return parts.length > 0 ? parts.join(' ') : null
  }

  /**
   * Quote identifier based on dialect
   */
  private quoteIdentifier(identifier: string): string {
    switch (this.dialect) {
      case 'mysql':
        return `\`${identifier}\``
      case 'postgresql':
        return `"${identifier}"`
      case 'sqlite':
        return `"${identifier}"`
      default:
        return identifier
    }
  }
}
