/* eslint-disable @typescript-eslint/no-explicit-any */

import { MarkerType, Node } from '@xyflow/react'
import { describe, expect, it } from 'vitest'
import { ComponentInputType } from '../components/component-type'
import { convertMermaidToReactFlowWithContext } from '../mermaid-converter/context/convert-with-context'
import { convertUiGraphToMermaid } from './index'

describe('convertUiGraphToMermaid', () => {
  it('converts nodes and edges to readable mermaid with context', () => {
    const result = convertUiGraphToMermaid({
      nodes: [
        {
          id: 'node-1',
          type: 'text',
          position: { x: 10, y: 10 },
          data: {
            componentFields: [
              {
                label: 'Text',
                type: ComponentInputType.TextBox,
                data: [{ value: 'Auth Service' }],
              },
            ],
          },
        },
        {
          id: 'db node',
          type: 'cloud',
          position: { x: 280, y: 20 },
          data: {
            cloud: 'aws',
            service: 'Amazon RDS',
            componentFields: [
              {
                label: 'Name',
                type: ComponentInputType.TextInput,
                data: [{ value: 'Main DB' }],
              },
            ],
          },
        },
      ],
      edges: [
        {
          id: 'e1',
          source: 'node-1',
          target: 'db node',
          label: 'reads/writes',
        },
      ],
    })

    expect(result.mermaid).toBe(
      'flowchart LR\nnode_1["Auth Service"]\ndb_node["Main DB"]\nnode_1 -->|reads/writes| db_node'
    )

    expect(result.context.nodes?.node_1).toMatchObject({
      type: 'text',
      value: 'Auth Service',
    })
    expect(result.context.nodes?.db_node).toMatchObject({
      type: 'cloud',
      name: 'Main DB',
      cloud: 'aws',
      service: 'Amazon RDS',
    })
  })

  it('preserves isolated nodes in mermaid output', () => {
    const result = convertUiGraphToMermaid({
      nodes: [
        {
          id: 'single',
          type: 'shape',
          position: { x: 0, y: 0 },
          data: { label: 'Single Node', shape: 'rectangle' },
        },
      ],
      edges: [],
    })

    expect(result.mermaid).toBe('flowchart LR\nsingle["single"]')
  })

  it('sanitizes node ids and resolves collisions', () => {
    const result = convertUiGraphToMermaid({
      nodes: [
        {
          id: 'A-B',
          type: 'shape',
          position: { x: 0, y: 0 },
          data: { label: 'One', shape: 'rectangle' },
        },
        {
          id: 'A_B',
          type: 'shape',
          position: { x: 100, y: 0 },
          data: { label: 'Two', shape: 'rectangle' },
        },
      ],
      edges: [],
    })

    expect(result.mermaid).toContain('A_B["A-B"]')
    expect(result.mermaid).toContain('A_B_2["A_B"]')
    expect(result.context.nodes?.A_B).toBeDefined()
    expect(result.context.nodes?.A_B_2).toBeDefined()
  })

  it('extracts group context with mapped child ids', () => {
    const result = convertUiGraphToMermaid({
      nodes: [
        {
          id: 'n-1',
          type: 'shape',
          position: { x: 10, y: 10 },
          data: { label: 'N1', shape: 'rectangle' },
        },
        {
          id: 'n 2',
          type: 'shape',
          position: { x: 200, y: 10 },
          data: { label: 'N2', shape: 'rectangle' },
        },
        {
          id: 'grp-1',
          type: 'group',
          position: { x: 0, y: 0 },
          data: {
            childNodes: ['n-1', 'n 2'],
            componentFields: [
              {
                label: 'Name',
                type: ComponentInputType.TextInput,
                data: [{ value: 'Core Group' }],
              },
            ],
          },
        },
      ],
      edges: [],
    })

    expect(result.context.groups?.['grp-1']).toEqual({
      name: 'Core Group',
      nodes: ['n_1', 'n_2'],
    })
  })

  it('extracts edge style and markers into context', () => {
    const result = convertUiGraphToMermaid({
      nodes: [
        {
          id: 'A',
          type: 'shape',
          position: { x: 0, y: 0 },
          data: { label: 'A', shape: 'rectangle' },
        },
        {
          id: 'B',
          type: 'shape',
          position: { x: 120, y: 0 },
          data: { label: 'B', shape: 'rectangle' },
        },
      ],
      edges: [
        {
          id: 'edge-A-B',
          source: 'A',
          target: 'B',
          style: {
            stroke: '#112233',
            strokeWidth: 3,
            strokeDasharray: '4 2',
          },
          markerStart: { type: MarkerType.Arrow, color: '#111111' },
          markerEnd: MarkerType.ArrowClosed,
          animated: true,
          data: {
            relationId: 'r-1',
          },
        },
      ],
    })

    expect(result.mermaid).toContain('A --> B')
    expect(result.context.edges?.['A-B']).toEqual({
      style: {
        stroke: '#112233',
        strokeWidth: 3,
        strokeStyle: 'dashed',
        borderAnimationEnabled: true,
      },
      markerStart: { type: MarkerType.Arrow, color: '#111111' },
      markerEnd: { type: MarkerType.ArrowClosed },
      ___internal: {
        relationId: 'r-1',
      },
    })
  })

  it('round-trips cloud node metadata through context', async () => {
    const inputNode: Node<any> = {
      id: '3a3b454c-b5d6-4eb1-8de6-a1a7a2066016',
      type: 'cloud',
      data: {
        cloud: 'AWS',
        iconSrc:
          '/aws-icons/Resource-Icons_07312025/Res_Application-Integration/Res_Amazon-EventBridge-Event_48.svg',
        category: 'Application-Integration',
        componentFields: [
          {
            componentFieldId: 'name',
            type: 'Text Input',
            label: 'Name',
            isReadonly: true,
            data: [
              {
                value: 'EventBridge Event',
              },
            ],
          },
        ],
        label: 'DEV',
      },
      position: { x: 0, y: 0 },
    }

    const convertedMermaid = convertUiGraphToMermaid({
      nodes: [inputNode],
      edges: [],
    })

    const output = await convertMermaidToReactFlowWithContext(
      convertedMermaid.mermaid,
      convertedMermaid.context
    )

    const outputNode: Node<any> = output.nodes[0]

    expect(outputNode.type).toBe('cloud')
    expect(outputNode.data.cloud).toBe('AWS')
    expect(outputNode.data.iconSrc).toBe(
      '/aws-icons/Resource-Icons_07312025/Res_Application-Integration/Res_Amazon-EventBridge-Event_48.svg'
    )
    expect((outputNode.data as Record<string, unknown>).category).toBe(
      'Application-Integration'
    )
    expect(outputNode.data.label).toBe('DEV')
  })
})
