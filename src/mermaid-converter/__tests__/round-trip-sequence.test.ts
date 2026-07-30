import { Edge, Node } from '@xyflow/react'
import { describe, expect, it } from 'vitest'
import { generateComponentFieldNameInput } from '../../components/component-field'
import { convertReactFlowToSequenceMermaid } from '../sequence-diagram/from-react-flow'
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
