export type SchemaDialect =
  | 'mysql'
  | 'sqlite'
  | 'postgresql'
  | 'json'
  | 'mongodb'
  | 'dynamodb'

export interface SchemaAST {
  dialect: SchemaDialect
  tables: TableAST[]
  metadata?: {
    version?: string
    createdAt?: Date
    sourceFile?: string
  }
}

export interface TableAST {
  type: 'table'
  id: string
  name: string
  columns: ColumnAST[]
  constraints: ConstraintAST[]
  indexes: IndexAST[]
  options?: TableOptionsAST
  position?: { x: number; y: number }
}

export interface ColumnAST {
  type: 'column'
  name: string
  dataType: DataTypeAST
  nullable: boolean
  defaultValue?: DefaultValueAST
  autoIncrement?: boolean
  comment?: string
  collation?: string
  charset?: string
}

export interface DataTypeAST {
  name: string
  unsigned?: boolean
  timezone?: boolean
  parameters?: (number | string)[]
}

export interface DefaultValueAST {
  type: 'literal' | 'function' | 'expression'
  value: string | number | boolean | null
  raw?: string
}

export type ConstraintAST =
  | PrimaryKeyConstraintAST
  | ForeignKeyConstraintAST
  | UniqueConstraintAST
  | CheckConstraintAST

export interface PrimaryKeyConstraintAST {
  type: 'primary_key'
  name?: string
  columns: string[]
}

export interface ForeignKeyConstraintAST {
  type: 'foreign_key'
  name?: string
  columns: string[]
  referencedTable: string
  referencedColumns: string[]
  onDelete?: ReferentialActionAST
  onUpdate?: ReferentialActionAST
}

export interface UniqueConstraintAST {
  type: 'unique'
  name?: string
  columns: string[]
}

export interface CheckConstraintAST {
  type: 'check'
  name?: string
  expression: string
}

export type ReferentialActionAST =
  | 'CASCADE'
  | 'SET NULL'
  | 'SET DEFAULT'
  | 'RESTRICT'
  | 'NO ACTION'

export interface IndexAST {
  type: 'index'
  name: string
  columns: IndexColumnAST[]
  unique: boolean
  method?: IndexMethodAST
  where?: string
}

export interface IndexColumnAST {
  name: string
  order?: 'ASC' | 'DESC'
  length?: number
}

export type IndexMethodAST =
  | 'btree'
  | 'hash'
  | 'gin'
  | 'gist'
  | 'spgist'
  | 'brin'

export interface TableOptionsAST {
  engine?: string
  charset?: string
  collation?: string
  autoIncrement?: number
  comment?: string
  rowFormat?: string
  tablespace?: string
}

export interface SchemaUIRepresentation {
  tables: {
    id: string
    name: string
    position: { x: number; y: number }
    columns: {
      name: string
      type: string
      isPrimaryKey: boolean
      isForeignKey: boolean
      nullable: boolean
      defaultValue?: string
    }[]
  }[]
  relationships: {
    id: string
    sourceTable: string
    sourceColumn: string
    targetTable: string
    targetColumn: string
    onDelete?: string
    onUpdate?: string
  }[]
}

export interface TParsedTable {
  name: string
  columns: TParsedColumn[]
  primaryKeys: string[]
  foreignKeys: TParsedForeignKey[]
  indexes: TParsedIndex[]
}

export interface TParsedColumn {
  name: string
  type: string
  nullable: boolean
  defaultValue?: string
  description?: string
}

export interface TParsedForeignKey {
  columnName: string
  referencedTable: string
  referencedColumn: string
  constraintName?: string
}

export interface TParsedIndex {
  name: string
  columns: string[]
  unique: boolean
}

export interface TParsedSchema {
  tables: TParsedTable[]
  relationships: TParsedForeignKey[]
}
