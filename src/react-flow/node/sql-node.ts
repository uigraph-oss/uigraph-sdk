export interface DatabaseTableSQLNodeData extends Record<string, unknown> {
  style?: {
    baseColor?: string
  }

  isForcedOpen?: boolean

  localTable?: {
    baseId: string
    tableId: string
  }

  serviceTable?: {
    serviceName: string
    databaseName: string
    tableName: string
  }
}
