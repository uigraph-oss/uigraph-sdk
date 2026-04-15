/* eslint-disable @typescript-eslint/no-explicit-any */

import { MarkerType, Node } from '@xyflow/react'
import { describe, expect, it } from 'vitest'
import { ComponentInputType } from '../components/component-type'
import { convertMermaidToReactFlowWithContext } from '../mermaid-converter/context/convert-with-context'
import { convertUiGraphToMermaid } from './index'

const builderComponentFields = [
  {
    __typename: 'FlowDiagramComponentField',
    flowDiagramComponentFieldId: 'component_field_es_0001',
    componentFieldId: 'component_field_es_0001',
    label: 'Name',
    type: 'Text Input',
    required: true,
    readonly: null,
    data: [{ value: 'Service' }],
    options: [],
    order: 1,
  },
  {
    __typename: 'FlowDiagramComponentField',
    flowDiagramComponentFieldId: 'component_field_es_0002',
    componentFieldId: 'component_field_es_0002',
    label: 'Service Type',
    type: 'Dropdown',
    required: false,
    readonly: null,
    data: [{ value: 'Internal Service' }],
    options: ['SaaS', 'Internal Service', 'Third-party API', 'Webhook'],
    order: 2,
  },
  {
    __typename: 'FlowDiagramComponentField',
    flowDiagramComponentFieldId: 'component_field_es_0005',
    componentFieldId: 'component_field_es_0005',
    label: 'API Version',
    type: 'Text Input',
    required: false,
    readonly: null,
    data: [{ value: '' }],
    options: [],
    order: 5,
  },
  {
    __typename: 'FlowDiagramComponentField',
    flowDiagramComponentFieldId: 'component_field_es_0006',
    componentFieldId: 'component_field_es_0006',
    label: 'Timeout (ms)',
    type: 'Number Input',
    required: false,
    readonly: null,
    data: [{ value: null }],
    options: [],
    order: 6,
  },
  {
    __typename: 'FlowDiagramComponentField',
    flowDiagramComponentFieldId: 'component_field_es_0007',
    componentFieldId: 'component_field_es_0007',
    label: 'Retry Attempts',
    type: 'Number Input',
    required: false,
    readonly: null,
    data: [{ value: null }],
    options: [],
    order: 7,
  },
]

function buildBuilderNode(
  id: string,
  componentFields: Record<string, unknown>[]
): Node<any> {
  return {
    id,
    type: 'builder',
    data: {
      componentId: 'flow_diagram_component_service',
      componentName: 'Service',
      componentFields,
      label: 'DEV',
      hide: {},
    },
    position: { x: 10, y: 20 },
  }
}

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

    expect(result.mermaid).toBe('flowchart LR\nsingle')
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

    expect(result.mermaid).toBe('flowchart LR\nA_B\nA_B_2')
    expect(result.context.nodes?.A_B).toBeDefined()
    expect(result.context.nodes?.A_B_2).toBeDefined()
  })

  it('does not promote label into name when Name field is missing', () => {
    const result = convertUiGraphToMermaid({
      nodes: [
        {
          id: 'cloud-1',
          type: 'cloud',
          position: { x: 0, y: 0 },
          data: {
            cloud: 'AWS',
            label: 'DEV',
            componentFields: [],
          },
        },
      ],
      edges: [],
    })

    expect(result.mermaid).toBe('flowchart LR\ncloud_1')
    expect(result.context.nodes?.cloud_1?.name).toBeUndefined()
    expect(result.context.nodes?.cloud_1?.___internal).toMatchObject({
      label: 'DEV',
    })
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

  it('keeps empty Name field empty after roundtrip', async () => {
    const inputNode: Node<any> = {
      id: 'cloud-empty-name',
      type: 'cloud',
      data: {
        cloud: 'AWS',
        label: 'DEV',
        componentFields: [
          {
            componentFieldId: 'name',
            type: 'Text Input',
            label: 'Name',
            isReadonly: true,
            data: [{ value: '' }],
          },
        ],
      },
      position: { x: 0, y: 0 },
    }

    const convertedMermaid = convertUiGraphToMermaid({
      nodes: [inputNode],
      edges: [],
    })

    expect(convertedMermaid.mermaid).toBe('flowchart LR\ncloud_empty_name')
    expect(
      convertedMermaid.context.nodes?.cloud_empty_name?.name
    ).toBeUndefined()
    expect(
      convertedMermaid.context.nodes?.cloud_empty_name?.data
    ).toMatchObject({
      Name: {
        type: 'Text Input',
        value: '',
      },
    })

    const output = await convertMermaidToReactFlowWithContext(
      convertedMermaid.mermaid,
      convertedMermaid.context
    )

    const outputNode: Node<any> = output.nodes[0]
    const outputNameField = outputNode.data.componentFields?.find(
      (field: any) => field.label === 'Name'
    )

    expect(outputNode.type).toBe('cloud')
    expect(outputNameField?.data).toEqual([{ value: '' }])
  })

  describe('builder roundtrip fidelity', () => {
    it('exports full builder componentFields into ___internal', () => {
      const inputNode = buildBuilderNode(
        'builder1',
        JSON.parse(JSON.stringify(builderComponentFields))
      )

      const result = convertUiGraphToMermaid({
        nodes: [inputNode],
        edges: [],
      })

      expect(result.context.nodes?.builder1?.___internal).toMatchObject({
        componentFields: builderComponentFields,
      })
    })

    it('round-trips builder node without stripping componentFields metadata', async () => {
      const inputNode = buildBuilderNode(
        'builder1',
        JSON.parse(JSON.stringify(builderComponentFields))
      )

      const convertedMermaid = convertUiGraphToMermaid({
        nodes: [inputNode],
        edges: [],
      })

      const output = await convertMermaidToReactFlowWithContext(
        convertedMermaid.mermaid,
        convertedMermaid.context
      )

      const outputNode = output.nodes.find((node) => node.id === 'builder1')

      expect(outputNode?.type).toBe('builder')
      expect(outputNode?.data.componentFields).toEqual(builderComponentFields)
    })

    it('keeps builder empty Name empty and does not inject label or id into Name', async () => {
      const emptyNameFields = JSON.parse(JSON.stringify(builderComponentFields))
      emptyNameFields[0].data = [{ value: '' }]
      const inputNode = buildBuilderNode('builder-empty', emptyNameFields)

      const convertedMermaid = convertUiGraphToMermaid({
        nodes: [inputNode],
        edges: [],
      })

      expect(convertedMermaid.mermaid).toContain('\nbuilder_empty')
      expect(
        convertedMermaid.context.nodes?.builder_empty?.name
      ).toBeUndefined()

      const output = await convertMermaidToReactFlowWithContext(
        convertedMermaid.mermaid,
        convertedMermaid.context
      )

      const outputNode = output.nodes.find(
        (node) => node.id === 'builder_empty'
      )
      const outputNameField = outputNode?.data.componentFields?.find(
        (field: any) => field.label === 'Name'
      )

      expect(outputNameField?.data).toEqual([{ value: '' }])
      expect(outputNameField?.data).not.toEqual([{ value: 'DEV' }])
      expect(outputNameField?.data).not.toEqual([{ value: 'builder-empty' }])
    })

    it('preserves null Number Input values in builder fields', async () => {
      const inputNode = buildBuilderNode(
        'builder1',
        JSON.parse(JSON.stringify(builderComponentFields))
      )

      const convertedMermaid = convertUiGraphToMermaid({
        nodes: [inputNode],
        edges: [],
      })

      expect(convertedMermaid.context.nodes?.builder1?.data).toMatchObject({
        'Timeout (ms)': { type: 'Number Input', value: null },
        'Retry Attempts': { type: 'Number Input', value: null },
      })

      const output = await convertMermaidToReactFlowWithContext(
        convertedMermaid.mermaid,
        convertedMermaid.context
      )

      const outputNode = output.nodes.find((node) => node.id === 'builder1')
      const timeoutField = outputNode?.data.componentFields?.find(
        (field: any) => field.label === 'Timeout (ms)'
      )
      const retryField = outputNode?.data.componentFields?.find(
        (field: any) => field.label === 'Retry Attempts'
      )

      expect(timeoutField?.data).toEqual([{ value: null }])
      expect(retryField?.data).toEqual([{ value: null }])
    })

    it('preserves empty string values in builder fields', async () => {
      const inputNode = buildBuilderNode(
        'builder1',
        JSON.parse(JSON.stringify(builderComponentFields))
      )

      const convertedMermaid = convertUiGraphToMermaid({
        nodes: [inputNode],
        edges: [],
      })

      expect(convertedMermaid.context.nodes?.builder1?.data).toMatchObject({
        'API Version': { type: 'Text Input', value: '' },
      })

      const output = await convertMermaidToReactFlowWithContext(
        convertedMermaid.mermaid,
        convertedMermaid.context
      )

      const outputNode = output.nodes.find((node) => node.id === 'builder1')
      const apiVersionField = outputNode?.data.componentFields?.find(
        (field: any) => field.label === 'API Version'
      )

      expect(apiVersionField?.data).toEqual([{ value: '' }])
    })

    it('preserves dropdown options and selected value for builder fields', async () => {
      const inputNode = buildBuilderNode(
        'builder1',
        JSON.parse(JSON.stringify(builderComponentFields))
      )

      const convertedMermaid = convertUiGraphToMermaid({
        nodes: [inputNode],
        edges: [],
      })

      expect(convertedMermaid.context.nodes?.builder1?.data).toMatchObject({
        'Service Type': {
          type: 'Dropdown',
          value: 'Internal Service',
          options: ['SaaS', 'Internal Service', 'Third-party API', 'Webhook'],
        },
      })

      const output = await convertMermaidToReactFlowWithContext(
        convertedMermaid.mermaid,
        convertedMermaid.context
      )

      const outputNode = output.nodes.find((node) => node.id === 'builder1')
      const serviceTypeField = outputNode?.data.componentFields?.find(
        (field: any) => field.label === 'Service Type'
      )

      expect(serviceTypeField?.data).toEqual([{ value: 'Internal Service' }])
      expect((serviceTypeField as any)?.options).toEqual([
        'SaaS',
        'Internal Service',
        'Third-party API',
        'Webhook',
      ])
    })

    it('does not add ___internal.componentFields for non-builder nodes', () => {
      const result = convertUiGraphToMermaid({
        nodes: [
          {
            id: 'cloud-plain',
            type: 'cloud',
            position: { x: 0, y: 0 },
            data: {
              cloud: 'AWS',
              componentFields: [
                {
                  label: 'Name',
                  type: 'Text Input',
                  data: [{ value: 'Cloud Plain' }],
                },
              ],
            },
          },
        ],
        edges: [],
      })

      expect(
        (
          result.context.nodes?.cloud_plain?.___internal as
            | Record<string, unknown>
            | undefined
        )?.componentFields
      ).toBeUndefined()
    })
  })
})
