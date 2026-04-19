import { MarkerType } from '@xyflow/react'
import { describe, expect, it } from 'vitest'
import { ComponentInputType } from '../../components/component-type'
import { convertUiGraphToMermaid } from '../index'

describe('convertUiGraphToMermaid detailed labels', () => {
  it('formats cloud labels with core data and component fields', () => {
    const result = convertUiGraphToMermaid(
      {
        nodes: [
          {
            id: 'A',
            type: 'cloud',
            position: { x: 0, y: 0 },
            data: {
              cloud: 'AWS',
              service: 'apigw',
              componentFields: [
                {
                  label: 'Name',
                  type: ComponentInputType.TextInput,
                  data: [{ value: 'API Gateway' }],
                },
                {
                  label: 'Owner',
                  type: ComponentInputType.TextInput,
                  data: [{ value: 'Platform Team' }],
                },
                {
                  label: 'Rate limit (req/s)',
                  type: ComponentInputType.NumberInput,
                  data: [{ value: 500 }],
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
      'flowchart LR\nA["Cloud: API Gateway\nprovider: AWS\nservice: apigw\nOwner: Platform Team\nRate limit (req/s): 500"]'
    )
  })

  it('formats data-source labels with db details and component fields', () => {
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
                  label: 'RPO (minutes)',
                  type: ComponentInputType.NumberInput,
                  data: [{ value: 15 }],
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
      'flowchart LR\norders["DataSource: Orders\ndb: ecommerce.orders\nservice: UIGraph Adapter\nRPO (minutes): 15\nOwner: Commerce Team"]'
    )
  })

  it('formats code labels with first line and metadata fields', () => {
    const result = convertUiGraphToMermaid(
      {
        nodes: [
          {
            id: 'code-1',
            type: 'code',
            position: { x: 0, y: 0 },
            data: {
              componentFields: [
                {
                  label: 'Code',
                  type: ComponentInputType.CodeEditor,
                  data: [{ value: 'const x = 1\nconsole.log(x)' }],
                },
                {
                  label: 'Language',
                  type: ComponentInputType.DropdownSelect,
                  data: [{ value: 'TypeScript' }],
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
      'flowchart LR\nA["Code: const x = 1\nLanguage: TypeScript"]'
    )
  })

  it('formats text labels and keeps line breaks for detailed lines', () => {
    const result = convertUiGraphToMermaid(
      {
        nodes: [
          {
            id: 'txt-1',
            type: 'text',
            position: { x: 0, y: 0 },
            data: {
              componentFields: [
                {
                  label: 'Text',
                  type: ComponentInputType.TextBox,
                  data: [{ value: 'User submits login form' }],
                },
                {
                  label: 'Region',
                  type: ComponentInputType.TextInput,
                  data: [{ value: 'US' }],
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
      'flowchart LR\nA["Text: User submits login form\nRegion: US"]'
    )
  })

  it('formats shape, table, image and gif labels with typed headers', () => {
    const result = convertUiGraphToMermaid(
      {
        nodes: [
          {
            id: 's',
            type: 'shape',
            position: { x: 0, y: 0 },
            data: {
              shape: 'diamond',
              componentFields: [
                {
                  label: 'Name',
                  type: ComponentInputType.TextInput,
                  data: [{ value: 'Validate Credentials' }],
                },
              ],
            },
          },
          {
            id: 't',
            type: 'table',
            position: { x: 150, y: 0 },
            data: {
              columns: ['id', 'name'],
              rows: [['1', 'A']],
              componentFields: [
                {
                  label: 'Name',
                  type: ComponentInputType.TextInput,
                  data: [{ value: 'Session Metrics' }],
                },
              ],
            },
          },
          {
            id: 'img',
            type: 'image',
            position: { x: 300, y: 0 },
            data: {
              src: 'https://cdn.example.com/arch.png',
            },
          },
          {
            id: 'gif',
            type: 'gif',
            position: { x: 450, y: 0 },
            data: {
              src: 'https://cdn.example.com/loading.gif',
            },
          },
        ],
        edges: [],
      },
      { detailedContext: true }
    )

    expect(result.mermaid).toContain('Name: Validate Credentials')
    expect(result.mermaid).toContain('Table: Session Metrics')
    expect(result.mermaid).toContain('columns: 2')
    expect(result.mermaid).toContain('rows: 1')
    expect(result.mermaid).toContain('Image: https://cdn.example.com/arch.png')
    expect(result.mermaid).toContain('Gif: https://cdn.example.com/loading.gif')
  })

  it('formats sequence and comment labels with typed headers', () => {
    const result = convertUiGraphToMermaid(
      {
        nodes: [
          {
            id: 'seq',
            type: 'sequenceParticipant',
            position: { x: 0, y: 0 },
            data: {
              label: 'Payment Service',
              rowCount: 8,
              color: '#f59e0b',
              componentFields: [
                {
                  label: 'Owner',
                  type: ComponentInputType.TextInput,
                  data: [{ value: 'Payments Team' }],
                },
              ],
            },
          },
          {
            id: 'cmt',
            type: 'comment',
            position: { x: 120, y: 0 },
            data: {
              isResolved: false,
            },
          },
        ],
        edges: [],
      },
      { detailedContext: true }
    )

    expect(result.mermaid).toContain('SequenceParticipant: Payment Service')
    expect(result.mermaid).toContain('rows: 8')
    expect(result.mermaid).toContain('color: #f59e0b')
    expect(result.mermaid).toContain('Owner: Payments Team')
    expect(result.mermaid).toContain('Comment: Open')
  })

  it('formats builder labels and includes componentId with fields', () => {
    const result = convertUiGraphToMermaid(
      {
        nodes: [
          {
            id: 'builder-1',
            type: 'builder',
            position: { x: 0, y: 0 },
            data: {
              componentId: 'flow_diagram_component_service',
              componentFields: [
                {
                  label: 'Name',
                  type: ComponentInputType.TextInput,
                  componentFieldId: 'name',
                  data: [{ value: 'Auth Service' }],
                },
                {
                  label: 'Runtime',
                  type: ComponentInputType.DropdownSelect,
                  componentFieldId: 'runtime',
                  data: [{ value: 'Node.js 20' }],
                },
              ],
            },
          },
        ],
        edges: [],
      },
      { detailedContext: true }
    )

    expect(result.mermaid).toContain('Builder: Auth Service')
    expect(result.mermaid).toContain(
      'componentId: flow_diagram_component_service'
    )
    expect(result.mermaid).toContain('Runtime: Node.js 20')
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
      'flowchart LR\nA\nB\nA -->|invoke / dashed / animated / end:arrow@#1976D2| B'
    )
  })
})
