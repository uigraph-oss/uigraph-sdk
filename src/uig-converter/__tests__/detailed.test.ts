import { MarkerType } from '@xyflow/react'
import { describe, expect, it } from 'vitest'
import { ComponentInputType } from '../../components/component-type'
import { convertUiGraphToMermaid } from '../index'

describe('convertUiGraphToMermaid detailed labels', () => {
  it('adds cloud-specific details and excludes unrelated field noise', () => {
    const result = convertUiGraphToMermaid(
      {
        nodes: [
          {
            id: 'A',
            type: 'cloud',
            position: { x: 0, y: 0 },
            data: {
              cloud: 'AWS',
              service: 'Amazon API Gateway',
              componentFields: [
                {
                  label: 'Name',
                  type: ComponentInputType.TextInput,
                  data: [{ value: 'API Gateway' }],
                },
                {
                  label: 'Runtime',
                  type: ComponentInputType.DropdownSelect,
                  data: [{ value: 'Node.js 20' }],
                  options: ['Node.js 20', 'Python 3.12', 'Go 1.x', 'Java 21'],
                },
                {
                  label: 'Owner',
                  type: ComponentInputType.TextInput,
                  data: [{ value: 'Platform Team' }],
                },
              ],
            },
          },
        ],
        edges: [],
      },
      { detailedContext: true }
    )

    expect(result.mermaid).toBe(
      'flowchart LR\nA["API Gateway | cloud:AWS | service:Amazon API Gateway | Runtime:Node.js 20 [Node.js 20/Python 3.12/Go 1.x/Java 21]"]'
    )
    expect(result.mermaid).not.toContain('Owner:')
  })

  it('uses dbConfig fields for data-source labels and excludes unrelated data fields', () => {
    const result = convertUiGraphToMermaid(
      {
        nodes: [
          {
            id: 'orders',
            type: 'data-source',
            position: { x: 0, y: 0 },
            data: {
              serviceTable: {
                serviceId: 'UIGraph Adapter',
                serviceDbId: 'ecommerce',
                tableName: 'orders',
              },
              componentFields: [
                {
                  label: 'Name',
                  type: ComponentInputType.TextInput,
                  data: [{ value: 'Orders' }],
                },
                {
                  label: 'Owner',
                  type: ComponentInputType.TextInput,
                  data: [{ value: 'Commerce Team' }],
                },
              ],
            },
          },
        ],
        edges: [],
      },
      { detailedContext: true }
    )

    expect(result.mermaid).toBe(
      'flowchart LR\norders["Orders | db:ecommerce.orders | service:UIGraph Adapter"]'
    )
    expect(result.mermaid).not.toContain('Owner:')
  })

  it('adds table dimensions for table nodes in detailed labels', () => {
    const result = convertUiGraphToMermaid(
      {
        nodes: [
          {
            id: 'T',
            type: 'table',
            position: { x: 0, y: 0 },
            data: {
              componentFields: [
                {
                  label: 'Name',
                  type: ComponentInputType.TextInput,
                  data: [{ value: 'Orders Table' }],
                },
              ],
              columns: ['ID', 'Name', 'Status'],
              rows: [
                ['1', 'A', 'Done'],
                ['2', 'B', 'Pending'],
              ],
            },
          },
        ],
        edges: [],
      },
      { detailedContext: true }
    )

    expect(result.mermaid).toBe('flowchart LR\nT["Orders Table | table:3c/2r"]')
  })

  it('adds compact edge details to labels when detailedContext is true', () => {
    const result = convertUiGraphToMermaid(
      {
        nodes: [
          {
            id: 'A',
            type: 'shape',
            position: { x: 0, y: 0 },
            data: { shape: 'rectangle' },
          },
          {
            id: 'B',
            type: 'shape',
            position: { x: 120, y: 0 },
            data: { shape: 'rectangle' },
          },
        ],
        edges: [
          {
            id: 'edge-A-B',
            source: 'A',
            target: 'B',
            label: 'invoke',
            style: {
              strokeDasharray: '4 2',
            },
            markerEnd: { type: MarkerType.Arrow, color: '#1976D2' },
            animated: true,
          },
        ],
      },
      { detailedContext: true }
    )

    expect(result.mermaid).toBe(
      'flowchart LR\nA["shape:rectangle"]\nB["shape:rectangle"]\nA -->|invoke / dashed / animated / end:arrow@#1976D2| B'
    )
  })

  it('keeps full text node labels in detailed mode', () => {
    const result = convertUiGraphToMermaid(
      {
        nodes: [
          {
            id: 'A',
            type: 'text',
            position: { x: 0, y: 0 },
            data: {
              componentFields: [
                {
                  label: 'Text',
                  type: ComponentInputType.TextBox,
                  data: [
                    {
                      value:
                        'abcdefghijklmnopqrstuvwxyz0123456789LONG and extra text',
                    },
                  ],
                },
              ],
            },
          },
        ],
        edges: [],
      },
      { detailedContext: true }
    )

    expect(result.mermaid).toBe(
      'flowchart LR\nA["abcdefghijklmnopqrstuvwxyz0123456789LONG and extra text"]'
    )
  })

  it('uses dbConfig fallback in data-source labels', () => {
    const result = convertUiGraphToMermaid(
      {
        nodes: [
          {
            id: 'orders-db',
            type: 'data-source',
            position: { x: 0, y: 0 },
            data: {
              name: 'Orders',
              dbConfig: {
                service: 'UIGraph Adapter',
                database: 'ecommerce',
                tableName: 'orders',
              },
            },
          },
        ],
        edges: [],
      },
      { detailedContext: true }
    )

    expect(result.mermaid).toBe(
      'flowchart LR\nA["Orders | db:ecommerce.orders | service:UIGraph Adapter"]'
    )
  })

  it('includes operational cloud fields in labels', () => {
    const result = convertUiGraphToMermaid(
      {
        nodes: [
          {
            id: 'cloud-a',
            type: 'cloud',
            position: { x: 0, y: 0 },
            data: {
              cloud: 'AWS',
              service: 'Amazon Lambda',
              componentFields: [
                {
                  label: 'Name',
                  type: ComponentInputType.TextInput,
                  data: [{ value: 'Lambda' }],
                },
                {
                  label: 'Tier',
                  type: ComponentInputType.TextInput,
                  data: [{ value: 'Basic' }],
                },
                {
                  label: 'Region',
                  type: ComponentInputType.TextInput,
                  data: [{ value: 'us-east-1' }],
                },
              ],
            },
          },
        ],
        edges: [],
      },
      { detailedContext: true }
    )

    expect(result.mermaid).toBe(
      'flowchart LR\nA["Lambda | cloud:AWS | service:Amazon Lambda | Tier:Basic | Region:us-east-1"]'
    )
  })

  it('normalizes multiline labels into a single mermaid-safe line', () => {
    const result = convertUiGraphToMermaid(
      {
        nodes: [
          {
            id: 'text-1',
            type: 'text',
            position: { x: 0, y: 0 },
            data: {
              componentFields: [
                {
                  label: 'Text',
                  type: ComponentInputType.TextBox,
                  data: [{ value: 'Line one\nLine two\r\nLine three' }],
                },
              ],
            },
          },
        ],
        edges: [],
      },
      { detailedContext: true }
    )

    expect(result.mermaid).toBe(
      'flowchart LR\nA["Line one Line two Line three"]'
    )
  })
})
