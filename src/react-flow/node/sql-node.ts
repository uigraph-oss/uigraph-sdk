export interface DatabaseTableSQLNodeData extends Record<string, unknown> {
  style?: {
    baseColor?: string
  }

  isForcedOpen?: boolean

  localTable?: {
    databaseName: string
    tableName: string
  }

  serviceTable?: {
    serviceName: string
    databaseName: string
    tableName: string
  }
}
