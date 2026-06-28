import { describe, expect, it } from 'vitest'
import { DataSource } from '../react-flow/data-source'
import { AstToUiConverter } from './ast-converter'
import { SchemaAST, TableAST } from './types'
import { generateTableNodeId } from './utils'

function makeTable(name: string, extraColumn?: string): TableAST {
  const columns: TableAST['columns'] = [
    {
      type: 'column',
      name: 'id',
      dataType: { name: 'INT' },
      nullable: false,
      autoIncrement: true,
    },
    {
      type: 'column',
      name: 'email',
      dataType: { name: 'VARCHAR', parameters: [255] },
      nullable: false,
    },
  ]

  if (extraColumn) {
    columns.push({
      type: 'column',
      name: extraColumn,
      dataType: { name: 'TEXT' },
      nullable: true,
    })
  }

  return {
    type: 'table',
    id: `id-${Math.random()}`,
    name,
    columns,
    constraints: [{ type: 'primary_key', columns: ['id'] }],
    indexes: [],
  }
}

function makeSchema(tables: TableAST[]): SchemaAST {
  return { dialect: 'mysql', tables }
}

function makeDataSource(sourceName: string, schema: SchemaAST): DataSource {
  return {
    id: 'src-1',
    name: sourceName,
    sourceType: 'manual',
    dialect: 'mysql',
    schemaAst: schema,
    createdAt: 0,
    modifiedAt: null,
  }
}

const SOURCE = 'MySQL Source'

describe('AstToUiConverter.updateReactFlow', () => {
  it('reuses the existing node (position/size/style) when a table is renamed', () => {
    const oldSchema = makeSchema([makeTable('users')])
    const { nodes, edges } = AstToUiConverter.toReactFlow(oldSchema, SOURCE)

    const movedNodes = nodes.map((n) => ({
      ...n,
      position: { x: 999, y: 888 },
      width: 512,
      height: 321,
      style: { background: 'red' },
    }))

    const newSchema = makeSchema([makeTable('customers')])

    const result = AstToUiConverter.updateReactFlow({
      nodes: movedNodes,
      edges,
      schema: newSchema,
      sourceName: SOURCE,
      oldDataSources: [makeDataSource(SOURCE, oldSchema)],
    })

    expect(result.nodes).toHaveLength(1)
    const node = result.nodes[0]
    expect(node.position).toEqual({ x: 999, y: 888 })
    expect(node.width).toBe(512)
    expect(node.height).toBe(321)
    expect(node.style).toEqual({ background: 'red' })
    expect(node.id).toBe(generateTableNodeId(SOURCE, 'customers'))
    expect(
      (node.data as { localTable?: { tableName?: string } }).localTable
        ?.tableName
    ).toBe('customers')
  })

  it('keeps position when a table name is unchanged', () => {
    const oldSchema = makeSchema([makeTable('users')])
    const { nodes, edges } = AstToUiConverter.toReactFlow(oldSchema, SOURCE)
    const movedNodes = nodes.map((n) => ({ ...n, position: { x: 10, y: 20 } }))

    const result = AstToUiConverter.updateReactFlow({
      nodes: movedNodes,
      edges,
      schema: makeSchema([makeTable('users')]),
      sourceName: SOURCE,
      oldDataSources: [makeDataSource(SOURCE, oldSchema)],
    })

    expect(result.nodes).toHaveLength(1)
    expect(result.nodes[0].position).toEqual({ x: 10, y: 20 })
  })

  it('removes the node when a table is deleted', () => {
    const oldSchema = makeSchema([makeTable('users'), makeTable('orders')])
    const { nodes, edges } = AstToUiConverter.toReactFlow(oldSchema, SOURCE)

    const result = AstToUiConverter.updateReactFlow({
      nodes,
      edges,
      schema: makeSchema([makeTable('users')]),
      sourceName: SOURCE,
      oldDataSources: [makeDataSource(SOURCE, oldSchema)],
    })

    expect(result.nodes).toHaveLength(1)
    expect(result.nodes[0].id).toBe(generateTableNodeId(SOURCE, 'users'))
  })

  it('adds a node when a new table is introduced', () => {
    const oldSchema = makeSchema([makeTable('users')])
    const { nodes, edges } = AstToUiConverter.toReactFlow(oldSchema, SOURCE)

    const result = AstToUiConverter.updateReactFlow({
      nodes,
      edges,
      schema: makeSchema([makeTable('users'), makeTable('orders')]),
      sourceName: SOURCE,
      oldDataSources: [makeDataSource(SOURCE, oldSchema)],
    })

    expect(result.nodes).toHaveLength(2)
    expect(result.nodes.map((n) => n.id)).toContain(
      generateTableNodeId(SOURCE, 'orders')
    )
  })

  it('does not treat a rename-with-structure-change as a reuse', () => {
    const oldSchema = makeSchema([makeTable('users')])
    const { nodes, edges } = AstToUiConverter.toReactFlow(oldSchema, SOURCE)
    const movedNodes = nodes.map((n) => ({ ...n, position: { x: 7, y: 7 } }))

    const result = AstToUiConverter.updateReactFlow({
      nodes: movedNodes,
      edges,
      schema: makeSchema([makeTable('customers', 'bio')]),
      sourceName: SOURCE,
      oldDataSources: [makeDataSource(SOURCE, oldSchema)],
    })

    expect(result.nodes).toHaveLength(1)
    expect(result.nodes[0].position).not.toEqual({ x: 7, y: 7 })
  })
})
