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
    serviceId: string
    serviceDbId: string
    tableName: string
  }
}
