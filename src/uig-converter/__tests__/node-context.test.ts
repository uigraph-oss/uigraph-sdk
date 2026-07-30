import { Node } from '@xyflow/react'
import { describe, expect, it } from 'vitest'
import { ComponentInputType } from '../../components/component-type'
import { buildContextNodes } from '../context/node-context'

const ID_MAP = new Map([['n', 'A']])

function shapeNode(node: Partial<Node>): Node {
  return {
    id: 'n',
    type: 'shape',
    position: { x: 0, y: 0 },
    data: {},
    ...node,
  }
}

describe('what reaches the node context', () => {
  it('ignores a node the id map has never heard of', () => {
    const contextNodes = buildContextNodes([shapeNode({})], new Map())

    expect(contextNodes).toEqual({})
  })

  it('keeps a shape only when it is one the context knows how to name', () => {
    const contextNodes = buildContextNodes(
      [shapeNode({ data: { shape: 'starburst' } })],
      ID_MAP
    )

    expect(contextNodes.A.shape).toBeUndefined()
  })

  it('does not read a Text field on a node that is not a text node', () => {
    const contextNodes = buildContextNodes(
      [
        shapeNode({
          data: {
            componentFields: [
              {
                label: 'Text',
                type: ComponentInputType.TextBox,
                data: [{ value: 'not a text node' }],
              },
            ],
          },
        }),
      ],
      ID_MAP
    )

    expect(contextNodes.A.value).toBeUndefined()
  })
})

describe('node style in the context', () => {
  it('prefers the width the node was measured at over the styled one', () => {
    const contextNodes = buildContextNodes(
      [shapeNode({ width: 220, style: { width: 100 } })],
      ID_MAP
    )

    expect(contextNodes.A.style?.width).toBe(220)
  })

  it('falls back to the styled height when the node was never measured', () => {
    const contextNodes = buildContextNodes(
      [shapeNode({ style: { height: 64 } })],
      ID_MAP
    )

    expect(contextNodes.A.style?.height).toBe(64)
  })

  it('reads an animated border out of the stroke animation flag', () => {
    const contextNodes = buildContextNodes(
      [shapeNode({ data: { strokeAnimation: 'dash' } })],
      ID_MAP
    )

    expect(contextNodes.A.style?.borderAnimationEnabled).toBe(true)
  })

  it('lets a declared stroke style win over the dash pattern', () => {
    const contextNodes = buildContextNodes(
      [
        shapeNode({
          data: { strokeStyle: 'dotted' },
          style: { strokeDasharray: '4 2' },
        }),
      ],
      ID_MAP
    )

    expect(contextNodes.A.style?.strokeStyle).toBe('dotted')
  })
})

describe('tables and databases in the context', () => {
  it('keeps only the string columns and the rows that are lists', () => {
    const contextNodes = buildContextNodes(
      [
        shapeNode({
          type: 'table',
          data: { columns: ['id', 7], rows: [['1'], 'not a row'] },
        }),
      ],
      ID_MAP
    )

    expect(contextNodes.A.table).toEqual({ columns: ['id'], rows: [['1']] })
  })

  it('gives a table that declares only rows an empty column list', () => {
    const contextNodes = buildContextNodes(
      [shapeNode({ type: 'table', data: { rows: [['1']] } })],
      ID_MAP
    )

    expect(contextNodes.A.table?.columns).toEqual([])
  })

  it('writes a db config only when service, database and table are all named', () => {
    const contextNodes = buildContextNodes(
      [
        shapeNode({
          type: 'data-source',
          data: {
            serviceTable: { serviceName: 'Adapter', databaseName: 'analytics' },
          },
        }),
      ],
      ID_MAP
    )

    expect(contextNodes.A.dbConfig).toBeUndefined()
  })
})
