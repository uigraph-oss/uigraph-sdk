import { Edge, Node } from '@xyflow/react'
import { describe, expect, it } from 'vitest'
import { generateComponentFieldNameInput } from '../../components/component-field'
import { ReactFlowData } from '../../types'
import { convertMermaidToReactFlowWithContext } from '../context/convert-with-context'
import {
  convertReactFlowToSequenceMermaid,
  convertReactFlowToSequenceUiGraph,
} from '../sequence-diagram/from-react-flow'
import { convertSequenceDiagramToReactFlow } from '../sequence-diagram/to-react-flow'

type NamedData = {
  componentFields?: Array<{ data?: Array<{ value?: string }> }>
}
type NoteData = {
  sequenceNote?: { placement: string; participants: string[] }
}
type BlockData = { sequenceBlock?: { type: string; label?: string } }

const SOURCE = [
  'sequenceDiagram',
  '  participant Alice',
  '  participant Bob',
  '  Alice->>Bob: Ping',
  '  loop Retry',
  '    Bob->>Bob: Check',
  '  end',
  '  Note right of Bob: Give up after 3',
  '  Bob-->>Alice: Pong',
].join('\n')

const BOXED_SOURCE = [
  'sequenceDiagram',
  '  box Payments',
  '    participant Alice',
  '    participant Bob',
  '  end',
  '  Alice->>Bob: Ping',
  '  loop Retry',
  '    Bob->>Bob: Check',
  '  end',
  '  Note right of Bob: Give up after 3',
  '  Bob-->>Alice: Pong',
].join('\n')

async function tripThroughCanvas(
  exported: ReturnType<typeof convertReactFlowToSequenceUiGraph>
) {
  const canvas = await convertMermaidToReactFlowWithContext(
    exported.mermaid,
    exported.context
  )

  return {
    canvas,
    exported: convertReactFlowToSequenceUiGraph(canvas.nodes, canvas.edges),
  }
}

function restyle(canvas: ReactFlowData): ReactFlowData {
  const styleByNodeId: Record<string, Record<string, unknown>> = {
    'participant-Alice': { color: '#FF0088', textColor: '#00FFCC' },
    'message-0': {
      fill: '#123456',
      stroke: '#654321',
      strokeWidth: 4,
      textFontSize: 19,
    },
    'note-2': { fill: '#ABCDEF', textColor: '#101010' },
    'sequence-block-block-0': {
      backgroundColor: 'rgba(1, 2, 3, 0.5)',
      borderColor: '#0F0F0F',
    },
  }

  return {
    nodes: canvas.nodes.map((node) => {
      const style = styleByNodeId[node.id]
      if (!style) return node
      return { ...node, data: { ...node.data, ...style } }
    }),
    edges: canvas.edges.map((edge) => {
      if (edge.id !== 'edge-0-a') return edge
      return {
        ...edge,
        animated: true,
        style: { ...edge.style, stroke: '#00FF00', strokeWidth: 6 },
      }
    }),
  }
}

describe('a sequence diagram that has been round the loop', () => {
  it('rebuilds the same canvas when its export is imported again', () => {
    const first = convertSequenceDiagramToReactFlow(SOURCE)
    const second = convertSequenceDiagramToReactFlow(
      convertReactFlowToSequenceMermaid(first.nodes, first.edges)
    )

    expect(second.nodes).toEqual(first.nodes)
    expect(second.edges).toEqual(first.edges)
  })

  it('keeps the note and the block that wrap the messages', () => {
    const first = convertSequenceDiagramToReactFlow(SOURCE)
    const second = convertSequenceDiagramToReactFlow(
      convertReactFlowToSequenceMermaid(first.nodes, first.edges)
    )
    const note = second.nodes.find(
      (node) => (node.data as NoteData).sequenceNote
    )
    const block = second.nodes.find(
      (node) => (node.data as BlockData).sequenceBlock
    )

    expect((note?.data as NoteData).sequenceNote).toMatchObject({
      placement: 'right of',
      participants: ['Bob'],
    })
    expect((block?.data as BlockData).sequenceBlock).toMatchObject({
      type: 'loop',
      label: 'Retry',
    })
  })
})

describe('a sequence diagram that was restyled before it was exported', () => {
  it('keeps every style it was given when the two files are imported back', async () => {
    const styled = restyle(convertSequenceDiagramToReactFlow(BOXED_SOURCE))
    const { canvas } = await tripThroughCanvas(
      convertReactFlowToSequenceUiGraph(styled.nodes, styled.edges)
    )

    const dataById = new Map(
      canvas.nodes.map((node) => [
        node.id,
        node.data as Record<string, unknown>,
      ])
    )

    expect(dataById.get('participant-Alice')).toMatchObject({
      color: '#FF0088',
      textColor: '#00FFCC',
    })
    expect(dataById.get('message-0')).toMatchObject({
      fill: '#123456',
      stroke: '#654321',
      strokeWidth: 4,
      textFontSize: 19,
    })
    expect(dataById.get('note-2')).toMatchObject({
      fill: '#ABCDEF',
      textColor: '#101010',
    })
    expect(dataById.get('sequence-block-block-0')).toMatchObject({
      backgroundColor: 'rgba(1, 2, 3, 0.5)',
      borderColor: '#0F0F0F',
    })

    const edge = canvas.edges.find((candidate) => candidate.id === 'edge-0-a')
    expect(edge?.animated).toBe(true)
    expect(edge?.style).toMatchObject({ stroke: '#00FF00', strokeWidth: 6 })
  })

  it('puts every node back where it stood, at the size it was', async () => {
    const styled = restyle(convertSequenceDiagramToReactFlow(BOXED_SOURCE))
    const { canvas } = await tripThroughCanvas(
      convertReactFlowToSequenceUiGraph(styled.nodes, styled.edges)
    )

    for (const before of styled.nodes) {
      const after = canvas.nodes.find((node) => node.id === before.id)

      expect(after?.position).toEqual(before.position)
      expect(after?.width).toBe(before.width)
      expect(after?.height).toBe(before.height)
    }
  })

  it('settles into a fixed point once it has been through mermaid', async () => {
    const styled = restyle(convertSequenceDiagramToReactFlow(BOXED_SOURCE))
    const first = convertReactFlowToSequenceUiGraph(styled.nodes, styled.edges)
    const second = await tripThroughCanvas(first)
    const third = await tripThroughCanvas(second.exported)

    expect(second.exported.mermaid).toBe(first.mermaid)
    expect(third.exported.mermaid).toBe(second.exported.mermaid)
    expect(third.exported.context).toEqual(second.exported.context)
  })
})

describe('the context a sequence export writes', () => {
  it('keys everything by the id the importer will hand out', () => {
    const canvas = convertSequenceDiagramToReactFlow(BOXED_SOURCE)
    const exported = convertReactFlowToSequenceUiGraph(
      canvas.nodes,
      canvas.edges
    )

    expect(Object.keys(exported.context.nodes ?? {}).sort()).toEqual([
      'message-0',
      'message-1',
      'message-3',
      'note-2',
      'participant-Alice',
      'participant-Bob',
      'sequence-block-block-0',
      'sequence-box-box-0',
    ])
    expect(exported.context.edges).toHaveProperty('participant-Alice-message-0')
    expect(exported.context.edges).toHaveProperty('message-0-participant-Bob')
  })

  it('leaves no key pointing at a node the import will not create', async () => {
    const canvas = convertSequenceDiagramToReactFlow(BOXED_SOURCE)
    const exported = convertReactFlowToSequenceUiGraph(
      canvas.nodes,
      canvas.edges
    )
    const reimported = await convertMermaidToReactFlowWithContext(
      exported.mermaid,
      exported.context
    )

    const nodeIds = new Set(reimported.nodes.map((node) => node.id))
    for (const key of Object.keys(exported.context.nodes ?? {})) {
      expect(nodeIds).toContain(key)
    }
  })

  it('does not synthesise a second frame for the box and the block', async () => {
    const canvas = convertSequenceDiagramToReactFlow(BOXED_SOURCE)
    const exported = convertReactFlowToSequenceUiGraph(
      canvas.nodes,
      canvas.edges
    )
    const reimported = await convertMermaidToReactFlowWithContext(
      exported.mermaid,
      exported.context
    )

    expect(exported.context.groups).toBeUndefined()
    expect(
      reimported.nodes.filter((node) => node.type === 'group')
    ).toHaveLength(2)
  })
})

describe('a hand-authored sequence diagram, whose ids are uuids', () => {
  const nodes: Node[] = [
    {
      id: 'participant-5f2c9e10-0d6b-4a71-9d34-2b8e1c7a5f00',
      type: 'sequenceParticipant',
      position: { x: 0, y: 0 },
      data: {
        color: '#FF0088',
        componentFields: [generateComponentFieldNameInput('Payment Service')],
      },
    },
    {
      id: 'participant-8a41d3c2-6e9f-4b05-91ad-7c3f6e2b4d11',
      type: 'sequenceParticipant',
      position: { x: 360, y: 0 },
      data: { componentFields: [generateComponentFieldNameInput('Ledger')] },
    },
    {
      id: 'message-c07b1e94-32af-4d68-8b52-9e0a4f1d6c22',
      type: 'shape',
      position: { x: 100, y: 100 },
      data: {
        shape: 'rectangle',
        fill: '#123456',
        textColor: '#FEFEFE',
        componentFields: [generateComponentFieldNameInput('Settle')],
      },
    },
  ]

  const edges: Edge[] = [
    {
      id: 'edge-1',
      source: 'participant-5f2c9e10-0d6b-4a71-9d34-2b8e1c7a5f00',
      target: 'message-c07b1e94-32af-4d68-8b52-9e0a4f1d6c22',
      sourceHandle: 'row-0-right-source',
      targetHandle: 'target-left',
      style: { stroke: '#00FF00' },
    },
    {
      id: 'edge-2',
      source: 'message-c07b1e94-32af-4d68-8b52-9e0a4f1d6c22',
      target: 'participant-8a41d3c2-6e9f-4b05-91ad-7c3f6e2b4d11',
      sourceHandle: 'source-right',
      targetHandle: 'row-0-left-target',
    },
  ]

  it('rewrites its uuid keys to the ids the import will use', () => {
    const exported = convertReactFlowToSequenceUiGraph(nodes, edges)

    expect(Object.keys(exported.context.nodes ?? {}).sort()).toEqual([
      'message-0',
      'participant-Ledger',
      'participant-PaymentService',
    ])
  })

  it('carries its styles across, which a canvas-keyed context could not', async () => {
    const { canvas } = await tripThroughCanvas(
      convertReactFlowToSequenceUiGraph(nodes, edges)
    )
    const dataById = new Map(
      canvas.nodes.map((node) => [
        node.id,
        node.data as Record<string, unknown>,
      ])
    )

    expect(dataById.get('participant-PaymentService')).toMatchObject({
      color: '#FF0088',
    })
    expect(dataById.get('message-0')).toMatchObject({
      fill: '#123456',
      textColor: '#FEFEFE',
    })
    expect(
      canvas.edges.find((edge) => edge.id === 'edge-0-a')?.style
    ).toMatchObject({ stroke: '#00FF00' })
  })
})

describe('a sequence diagram drawn on the canvas', () => {
  const nodes: Node[] = [
    {
      id: 'participant-01',
      type: 'sequenceParticipant',
      position: { x: 0, y: 0 },
      data: { componentFields: [generateComponentFieldNameInput('Shopper')] },
    },
    {
      id: 'participant-02',
      type: 'sequenceParticipant',
      position: { x: 360, y: 0 },
      data: { componentFields: [generateComponentFieldNameInput('Checkout')] },
    },
    {
      id: 'message-01',
      type: 'shape',
      position: { x: 100, y: 100 },
      data: {
        shape: 'rectangle',
        componentFields: [generateComponentFieldNameInput('Place order')],
      },
    },
    {
      id: 'message-02',
      type: 'shape',
      position: { x: 100, y: 200 },
      data: {
        shape: 'rectangle',
        componentFields: [generateComponentFieldNameInput('Order placed')],
      },
    },
  ]

  const edges: Edge[] = [
    {
      id: 'edge-1',
      source: 'participant-01',
      target: 'message-01',
      sourceHandle: 'row-0-right-source',
      targetHandle: 'target-left',
    },
    {
      id: 'edge-2',
      source: 'message-01',
      target: 'participant-02',
      sourceHandle: 'source-right',
      targetHandle: 'row-0-left-target',
    },
    {
      id: 'edge-3',
      source: 'participant-02',
      target: 'message-02',
      sourceHandle: 'row-1-left-source',
      targetHandle: 'target-right',
    },
    {
      id: 'edge-4',
      source: 'message-02',
      target: 'participant-01',
      sourceHandle: 'source-left',
      targetHandle: 'row-1-right-target',
    },
  ]

  it('comes back as the same participants and messages it was drawn with', () => {
    const canvas = convertSequenceDiagramToReactFlow(
      convertReactFlowToSequenceMermaid(nodes, edges)
    )
    const names = canvas.nodes.map(
      (node) => (node.data as NamedData).componentFields?.[0].data?.[0].value
    )

    expect(names).toEqual([
      'Shopper',
      'Checkout',
      'Place order',
      'Order placed',
    ])
  })

  it('keeps every message pointing the way it was drawn', () => {
    const canvas = convertSequenceDiagramToReactFlow(
      convertReactFlowToSequenceMermaid(nodes, edges)
    )
    const nameById = new Map(
      canvas.nodes.map((node) => [
        node.id,
        (node.data as NamedData).componentFields?.[0].data?.[0].value,
      ])
    )

    expect(
      canvas.edges.map((edge) => [
        nameById.get(edge.source),
        nameById.get(edge.target),
      ])
    ).toEqual([
      ['Shopper', 'Place order'],
      ['Place order', 'Checkout'],
      ['Checkout', 'Order placed'],
      ['Order placed', 'Shopper'],
    ])
  })
})
