import { Edge, Node } from '@xyflow/react'
import { arrayNonNullable } from 'daily-code'
import { DataSource } from '../react-flow/data-source'
import { createEdgeMarker } from '../react-flow/edge'
import { DatabaseTableSQLNodeData } from '../react-flow/node/sql-node'
import {
  DEFAULT_NODE_WIDTH,
  DEFAULT_NODE_X_OFFSET,
  DEFAULT_NODE_X_SPACING,
  DEFAULT_NODE_Y_OFFSET,
  DEFAULT_NODE_Y_SPACING,
} from './constants'
import {
  computeLayeredLayout,
  type TableEdge,
  type TableNode,
} from './layered-graph-layout'
import {
  ColumnAST,
  ForeignKeyConstraintAST,
  SchemaAST,
  TableAST,
} from './types'
import { generateTableNodeId } from './utils'
/**
 * Convert AST to UI representation (ReactFlow nodes and edges)
 */
export class AstToUiConverter {
  /**
   * Convert schema AST to ReactFlow nodes and edges
   */
  static updateReactFlow({
    nodes,
    edges,
    schema,
    sourceName,
    oldDataSources,
  }: {
    nodes: Node[]
    edges: Edge[]
    sourceName: string
    schema: SchemaAST
    oldDataSources: DataSource[]
  }): {
    nodes: Node[]
    edges: Edge[]
  } {
    console.log('UPDATE:', {
      nodes,
      edges,
      schema,
      sourceName,
      oldDataSources,
    })

    const oldSource = oldDataSources.find((s) => s.name === sourceName)
    const sourceNodePrefix = `${sourceName}-table-`
    const positions = this.calculateSmartLayout(schema)
    const nodeTableMap = new Map(
      nodes.map((node) => [
        oldSource?.schemaAst.tables.find(
          (t) =>
            t.name ===
            (node.data as unknown as DatabaseTableSQLNodeData).localTable
              ?.tableName
        )?.name,
        node,
      ])
    )

    console.log('Old node table map:', nodeTableMap)

    const tableNames = new Set(schema.tables.map((table) => table.name))

    const sourceNodesUnfiltered = schema.tables.map((table, index) => {
      const prevNode = nodeTableMap.get(table.name)

      const position = prevNode?.position ??
        table.position ??
        positions[table.name] ?? {
          x: 100,
          y: 100 + index * 210,
        }

      const baseNode = this.tableAstToNode(
        sourceName,
        table,
        position,
        tableNames
      )

      if (!prevNode) {
        return baseNode
      }

      const mergedNode: Node = {
        ...prevNode,
        ...baseNode,
        data: {
          ...(prevNode.data ?? {}),
          ...baseNode.data,
          style: prevNode.data?.style ?? baseNode.data?.style,
        },
      }

      if (prevNode.style) {
        mergedNode.style = prevNode.style
      }

      if (prevNode.width !== undefined) {
        mergedNode.width = prevNode.width
      }

      if (prevNode.height !== undefined) {
        mergedNode.height = prevNode.height
      }

      return mergedNode
    })

    const sourceNodes = sourceNodesUnfiltered.filter((node) =>
      nodeTableMap.has(
        schema.tables.find(
          (t) =>
            t.name ===
            (node.data as DatabaseTableSQLNodeData).localTable?.tableName
        )?.name
      )
    )

    const validNodeIds = new Set(sourceNodes.map((node) => node.id))
    const sourceEdges = schema.tables.flatMap((table) =>
      this.createEdgesFromTable(sourceName, table, schema.tables).filter(
        (edge) => validNodeIds.has(edge.source) && validNodeIds.has(edge.target)
      )
    )

    const preservedNodes = nodes.filter(
      (node) => !node.id.startsWith(sourceNodePrefix)
    )
    const preservedEdges = edges.filter(
      (edge) => !edge.id.startsWith(sourceNodePrefix)
    )

    return {
      nodes: [...preservedNodes, ...sourceNodes],
      edges: [...preservedEdges, ...sourceEdges],
    }
  }

  static toReactFlow(
    schema: SchemaAST,
    sourceName: string
  ): {
    nodes: Node<DatabaseTableSQLNodeData>[]
    edges: Edge[]
  } {
    const nodes: Node<DatabaseTableSQLNodeData>[] = []
    const edges: Edge[] = []
    const tableNames = new Set(schema.tables.map((table) => table.name))

    // Use smart layout that groups related tables
    const positions = this.calculateSmartLayout(schema)

    schema.tables.forEach((table, index) => {
      const position = table.position ||
        positions[table.name] || {
          x: 100,
          y: 100 + index * 210,
        }

      const node = this.tableAstToNode(sourceName, table, position, tableNames)
      nodes.push(node)

      // Create edges from foreign keys
      const tableEdges = this.createEdgesFromTable(
        sourceName,
        table,
        schema.tables
      )
      edges.push(...tableEdges)
    })

    return { nodes, edges }
  }

  /**
   * Calculate smart layout that groups related tables and separates unrelated ones
   */
  private static calculateSmartLayout(
    schema: SchemaAST
  ): Record<string, { x: number; y: number }> {
    const positions: Record<string, { x: number; y: number }> = {}
    const tableNames = new Set(schema.tables.map((table) => table.name))

    // Build adjacency list for relationships
    const relationships = new Map<string, Set<string>>()
    schema.tables.forEach((table) => {
      if (!relationships.has(table.name)) {
        relationships.set(table.name, new Set())
      }

      const foreignKeys = this.extractForeignKeys(table)
      foreignKeys.forEach((fk) => {
        if (!tableNames.has(fk.referencedTable)) {
          return
        }
        relationships.get(table.name)!.add(fk.referencedTable)
        if (!relationships.has(fk.referencedTable)) {
          relationships.set(fk.referencedTable, new Set())
        }
        relationships.get(fk.referencedTable)!.add(table.name)
      })
    })

    // Find connected components (groups of related tables)
    const visited = new Set<string>()
    const components: string[][] = []

    function dfs(tableName: string, component: string[]) {
      visited.add(tableName)
      component.push(tableName)

      const neighbors = relationships.get(tableName) || new Set()
      neighbors.forEach((neighbor) => {
        if (!visited.has(neighbor)) {
          dfs(neighbor, component)
        }
      })
    }

    schema.tables.forEach((table) => {
      if (!visited.has(table.name)) {
        const component: string[] = []
        dfs(table.name, component)
        components.push(component)
      }
    })

    // Layout each component separately
    let componentOffsetX = DEFAULT_NODE_X_OFFSET

    components.forEach((component) => {
      if (component.length === 1) {
        // Single table with no relationships
        positions[component[0]] = {
          x: componentOffsetX,
          y: DEFAULT_NODE_Y_OFFSET,
        }

        componentOffsetX += DEFAULT_NODE_X_SPACING
      } else {
        // Multiple related tables - use Sugiyama layered layout
        const componentPositions = this.layoutComponentHierarchical(
          component,
          relationships,
          componentOffsetX,
          schema
        )

        Object.assign(positions, componentPositions)

        // Calculate component width for next offset (including table width)
        const maxX = Math.max(
          ...Object.values(componentPositions).map((p) => p.x)
        )

        componentOffsetX = maxX + DEFAULT_NODE_WIDTH + DEFAULT_NODE_X_SPACING
      }
    })

    return positions
  }

  /**
   * Layout a component of related tables using Sugiyama layered approach
   */
  private static layoutComponentHierarchical(
    tables: string[],
    relationships: Map<string, Set<string>>,
    startX: number,
    schema: SchemaAST
  ): Record<string, { x: number; y: number }> {
    // Convert to format expected by layered layout algorithm
    const tableMap = new Map(
      schema.tables
        .filter((t) => tables.includes(t.name))
        .map((t) => [t.name, t])
    )

    const nodes: TableNode[] = arrayNonNullable(
      tables.map((tableName) => {
        const table = tableMap.get(tableName)
        if (!table) return null

        return {
          id: tableName,
          width: 350,
          height: Math.max(200, table.columns.length * 30 + 80),
          columns: table.columns.map((col) => {
            const primaryKeys = this.extractPrimaryKeys(table)
            const foreignKeys = this.extractForeignKeys(table)
            return {
              name: col.name,
              isPrimaryKey: primaryKeys.includes(col.name),
              isForeignKey: foreignKeys.some((fk) =>
                fk.columns.includes(col.name)
              ),
            }
          }),
        }
      })
    )

    const edges: TableEdge[] = []
    const componentSet = new Set(tables)

    schema.tables.forEach((table) => {
      if (!componentSet.has(table.name)) return

      const foreignKeys = this.extractForeignKeys(table)
      foreignKeys.forEach((fk) => {
        if (
          componentSet.has(fk.referencedTable) &&
          tableMap.has(fk.referencedTable)
        ) {
          // FK points from child to parent
          const primaryKeys = this.extractPrimaryKeys(table)
          const isPrimaryFK = fk.columns.some((col) =>
            primaryKeys.includes(col)
          )
          edges.push({
            source: table.name,
            target: fk.referencedTable,
            sourceColumn: fk.columns[0],
            targetColumn: fk.referencedColumns[0],
            weight: isPrimaryFK ? 2.0 : 1.0, // Higher weight for PK→FK
          })
        }
      })
    })

    // Use Sugiyama layered layout
    const result = computeLayeredLayout(nodes, edges, {
      horizontalSpacing: DEFAULT_NODE_X_SPACING,
      verticalSpacing: DEFAULT_NODE_Y_SPACING,
      startY: DEFAULT_NODE_Y_OFFSET,
      startX,
    })

    return result.positions
  }

  /**
   * Convert table AST to ReactFlow node
   */
  private static tableAstToNode(
    sourceName: string,
    table: TableAST,
    position: { x: number; y: number },
    _validTableNames: Set<string>
  ): Node<DatabaseTableSQLNodeData> {
    /* const primaryKeys = this.extractPrimaryKeys(table)

    const foreignKeys = this.extractForeignKeys(table).filter((fk) =>
      validTableNames.has(fk.referencedTable)
    )

    const columns = table.columns.map((col) => ({
      name: col.name,
      type: this.formatDataType(col),
      isPrimaryKey: primaryKeys.includes(col.name),
      isForeignKey: foreignKeys.some((fk) => fk.columns.includes(col.name)),
      nullable: col.nullable,
    })) */

    return {
      id: generateTableNodeId(sourceName, table.name),
      type: 'databaseTableSQL',
      width: DEFAULT_NODE_WIDTH,
      position,
      data: {
        localTable: {
          databaseName: sourceName,
          tableName: table.name,
        },
      },
    }
  }

  /**
   * Extract primary keys from table
   */
  public static extractPrimaryKeys(table: TableAST): string[] {
    const pkConstraint = table.constraints.find((c) => c.type === 'primary_key')

    if (pkConstraint) {
      return pkConstraint.columns
    }

    // Check for inline PRIMARY KEY in columns
    const inlinePks = table.columns
      .filter((col) => col.autoIncrement) // Auto increment implies PK
      .map((col) => col.name)

    return inlinePks
  }

  /**
   * Extract foreign keys from table
   */
  public static extractForeignKeys(table: TableAST): ForeignKeyConstraintAST[] {
    return table.constraints.filter(
      (c) => c.type === 'foreign_key'
    ) as ForeignKeyConstraintAST[]
  }

  /**
   * Format data type for display
   */
  public static formatDataType(column: ColumnAST): string {
    const { dataType } = column
    let formatted = dataType.name

    if (dataType.parameters && dataType.parameters.length > 0) {
      formatted += `(${dataType.parameters.join(', ')})`
    }

    if (dataType.unsigned) {
      formatted += ' UNSIGNED'
    }

    if (dataType.timezone) {
      formatted += ' WITH TIME ZONE'
    }

    return formatted
  }

  /**
   * Create edges from foreign key relationships
   */
  private static createEdgesFromTable(
    sourceName: string,
    sourceTable: TableAST,
    validTables: TableAST[]
  ): Edge[] {
    const edges: Edge[] = []
    const foreignKeys = this.extractForeignKeys(sourceTable)

    foreignKeys.forEach((fk, index) => {
      const targetTable = validTables.find(
        (t) => t.id === fk.referencedTable || t.name === fk.referencedTable
      )
      if (!targetTable) return

      const sourceNodeId = generateTableNodeId(sourceName, sourceTable.name)
      const targetNodeId = generateTableNodeId(sourceName, targetTable.name)
      const edgeId = `${sourceNodeId}-fk-${index}`

      const fkCols = fk.columns
      const allNotNull = fkCols.every((cn) => {
        const col = sourceTable.columns.find((c) => c.name === cn)
        return col ? col.nullable === false : false
      })
      const hasUniqueConstraint = sourceTable.constraints.some(
        (c) =>
          c.type === 'unique' &&
          (c as { columns: string[] }).columns.length === fkCols.length &&
          fkCols.every((cn) =>
            (c as { columns: string[] }).columns.includes(cn)
          )
      )
      const hasUniqueIndex = sourceTable.indexes.some(
        (idx) =>
          idx.unique &&
          idx.columns.length === fkCols.length &&
          fkCols.every((cn) => idx.columns.some((ic) => ic.name === cn))
      )
      const isUnique = hasUniqueConstraint || hasUniqueIndex
      const startMarkerType = allNotNull ? 'erdOnlyOne' : 'erdZeroOrOne'
      const endMarkerType = isUnique ? 'erdZeroOrOne' : 'erdZeroOrMany'

      edges.push({
        id: edgeId,
        source: sourceNodeId,
        target: targetNodeId,
        type: 'smoothstep',
        animated: false,
        markerEnd: createEdgeMarker({ type: endMarkerType }),
        markerStart: createEdgeMarker({ type: startMarkerType }),
        label: `${fk.columns.join(', ')} → ${fk.referencedColumns.join(', ')}`,
        style: {
          stroke: '#3b82f6',
          strokeWidth: 2.5,
        },
        labelStyle: {
          fontSize: 11,
          fill: '#475569',
          fontWeight: 500,
        },
        labelBgStyle: {
          fill: '#ffffff',
          fillOpacity: 0.85,
        },
      })
    })

    return edges
  }
}
