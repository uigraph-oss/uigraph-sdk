import { describe, expect, it, vi } from 'vitest'
import { ComponentInputType } from '../../components/component-type'
import type { ReactFlowData, RFComponentField } from '../../types'
import { convertMermaidToReactFlow } from '../mermaid-to-react-flow'
import { convertMermaidToReactFlowWithContext } from './convert-with-context'

vi.mock('../mermaid-to-react-flow', () => ({
  convertMermaidToReactFlow: vi.fn(),
}))

const baseData: ReactFlowData = {
  nodes: [
    {
      id: 'A',
      type: 'shape',
      position: { x: 0, y: 0 },
      data: {
        componentFields: [
          {
            componentFieldId: 'cpu',
            type: ComponentInputType.TextInput,
            label: 'CPU',
            data: [{ value: 'old' }],
          } as RFComponentField,
        ],
      },
      style: { width: 100, height: 80 },
    },
    {
      id: 'B',
      type: 'shape',
      position: { x: 50, y: 40 },
      data: {},
      style: { width: 90, height: 50 },
    },
  ],
  edges: [
    {
      id: 'e1',
      source: 'A',
      target: 'B',
      data: {},
      style: { stroke: '#000000', strokeWidth: 1 },
      animated: false,
    },
  ],
}

describe('convertMermaidToReactFlowWithContext', () => {
  it('applies node, edge, and group context overrides', async () => {
    const mockConvert = vi.mocked(convertMermaidToReactFlow)
    mockConvert.mockResolvedValue(baseData)

    const result = await convertMermaidToReactFlowWithContext(
      'flowchart LR\nA --> B',
      {
        nodes: {
          A: {
            type: 'cloud',
            cloud: 'aws',
            service: 'Amazon Athena',
            name: 'Primary',
            ___position: { x: 120, y: 240 },
            data: {
              CPU: {
                type: ComponentInputType.NumberInput,
                value: 8,
              },
            },
            style: {
              stroke: '#112233',
              strokeWidth: 2,
              strokeStyle: 'dashed',
              borderAnimationEnabled: true,
            },
          },
          B: {
            type: 'text',
            value: 'Hello',
          },
        },
        edges: {
          'A-B': {
            type: 'smoothstep',
            sourceHandle: 'source-right',
            targetHandle: 'target-left',
            label: 'links',
            style: {
              stroke: '#111111',
              strokeWidth: 3,
              strokeStyle: 'dotted',
              borderAnimationEnabled: true,
            },
            markerStart: { type: 'arrow' },
            markerEnd: { type: 'arrow' },
          },
        },
        groups: {
          group1: { name: 'Group 1', nodes: ['A', 'B'] },
        },
      },
      {
        resolveCloudIcon: async () => '/aws-icons/mock.svg',
      }
    )

    const groupNode = result.nodes.find((node) => node.id === 'group1')
    expect(groupNode?.data.childNodes).toEqual(['A', 'B'])

    const nodeA = result.nodes.find((node) => node.id === 'A')
    expect(nodeA?.type).toBe('cloud')
    expect(nodeA?.style).toBeUndefined()
    expect(nodeA?.height).toBe(150)
    expect(nodeA?.width).toBe(150)
    expect(nodeA?.position).toEqual({ x: 120, y: 240 })
    expect(nodeA?.parentId).toBe('group1')
    expect(nodeA?.data.iconSrc).toBe('/aws-icons/mock.svg')
    expect((nodeA?.data as Record<string, unknown>).stroke).toBe('#112233')

    const nodeAFields = nodeA?.data.componentFields ?? []
    const cpuField = nodeAFields.find((field) => field.label === 'CPU')
    expect(cpuField?.type).toBe(ComponentInputType.NumberInput)
    expect(cpuField?.data).toEqual([{ value: 8 }])
    const nameField = nodeAFields.find((field) => field.label === 'Name')
    expect(nameField?.data).toEqual([{ value: 'Primary' }])

    const nodeB = result.nodes.find((node) => node.id === 'B')
    expect(nodeB?.type).toBe('text')
    expect(nodeB?.position).toEqual({ x: 50, y: 40 })
    expect(nodeB?.parentId).toBe('group1')
    const textField = nodeB?.data.componentFields?.[0]
    expect(textField?.label).toBe('Text')
    expect(textField?.data).toEqual([{ value: 'Hello' }])

    const edge = result.edges[0]
    expect(edge.label).toBe('links')
    expect(edge.animated).toBe(true)
    expect(edge.style?.stroke).toBe('#111111')
    expect(edge.style?.strokeWidth).toBe(3)
    expect(edge.style?.strokeDasharray).toBe('1 2')
    expect(edge.type).toBe('smoothstep')
    expect(edge.sourceHandle).toBe('source-right')
    expect(edge.targetHandle).toBe('target-left')
    expect(edge.markerStart).toEqual({ type: 'arrow' })
    expect(edge.markerEnd).toEqual({ type: 'arrow' })
  })

  it('copies dbConfig names straight into serviceTable', async () => {
    const mockConvert = vi.mocked(convertMermaidToReactFlow)
    mockConvert.mockResolvedValue(baseData)

    const result = await convertMermaidToReactFlowWithContext(
      'flowchart LR\nA --> B',
      {
        nodes: {
          A: {
            type: 'db-table',
            dbConfig: {
              serviceName: 'UIGraph Adapter',
              databaseName: 'ecommerce',
              tableName: 'orders',
            },
          },
        },
      }
    )

    const nodeA = result.nodes.find((node) => node.id === 'A')
    expect(nodeA?.data.serviceTable).toEqual({
      serviceName: 'UIGraph Adapter',
      databaseName: 'ecommerce',
      tableName: 'orders',
    })
  })

  it('throws on invalid context payload', async () => {
    const mockConvert = vi.mocked(convertMermaidToReactFlow)
    mockConvert.mockResolvedValue(baseData)

    const badContext = {
      nodes: {
        A: {
          data: {
            Bad: { value: 'missing type' },
          },
        },
      },
    }

    await expect(
      convertMermaidToReactFlowWithContext(
        'flowchart LR\nA --> B',
        badContext as unknown as Parameters<
          typeof convertMermaidToReactFlowWithContext
        >[1]
      )
    ).rejects.toBeDefined()
  })
})
