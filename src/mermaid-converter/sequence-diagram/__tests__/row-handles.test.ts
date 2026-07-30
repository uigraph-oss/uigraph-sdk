import { describe, expect, it } from 'vitest'
import {
  convertSequenceDiagramToReactFlow,
  rowHandleId,
} from '../to-react-flow'

type ParticipantData = { rowCount?: number; rowYs?: number[] }

function render(...lines: string[]) {
  return convertSequenceDiagramToReactFlow(
    ['sequenceDiagram', ...lines].join('\n')
  )
}

describe('rowHandleId', () => {
  it('names a different handle for every row, side and end it is asked about', () => {
    const ids = [
      rowHandleId(0, 'left', 'source'),
      rowHandleId(0, 'left', 'target'),
      rowHandleId(0, 'right', 'source'),
      rowHandleId(0, 'right', 'target'),
      rowHandleId(1, 'left', 'source'),
    ]

    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('the renderer and the handle ids agree', () => {
  it('routes every edge to a row handle the participant it lands on advertises', () => {
    const { nodes, edges } = render(
      '  Alice->>Bob: Ask',
      '  Note over Bob: thinking it over',
      '  loop until answered',
      '    Bob->>Bob: Check again',
      '  end',
      '  Bob-->>Alice: Answer'
    )

    function advertised(
      participantId: string,
      handleType: 'source' | 'target'
    ): string[] {
      const data = nodes.find((node) => node.id === participantId)!
        .data as ParticipantData
      const ids: string[] = []
      for (let row = 0; row < data.rowCount!; row++) {
        ids.push(
          rowHandleId(row, 'left', handleType),
          rowHandleId(row, 'right', handleType)
        )
      }
      return ids
    }

    const outgoing = edges.filter((edge) =>
      edge.source.startsWith('participant-')
    )
    const incoming = edges.filter((edge) =>
      edge.target.startsWith('participant-')
    )

    expect(outgoing).not.toHaveLength(0)
    expect(incoming).not.toHaveLength(0)

    for (const edge of outgoing) {
      expect(advertised(edge.source, 'source')).toContain(edge.sourceHandle)
    }
    for (const edge of incoming) {
      expect(advertised(edge.target, 'target')).toContain(edge.targetHandle)
    }
  })

  it('advertises a row position for every row a handle can name', () => {
    const { nodes } = render(
      '  Alice->>Alice: Think',
      '  Note left of Alice: still thinking',
      '  Alice->>Bob: Speak'
    )

    const participants = nodes.filter(
      (node) => node.type === 'sequenceParticipant'
    )

    expect(participants).not.toHaveLength(0)
    for (const participant of participants) {
      const data = participant.data as ParticipantData
      expect(data.rowYs).toHaveLength(data.rowCount!)
    }
  })

  it('moves a message onto a later handle row when a note claims one before it', () => {
    const plain = render('  Alice->>Bob: one', '  Alice->>Bob: two')
    const noted = render(
      '  Alice->>Bob: one',
      '  Note over Alice: pause',
      '  Alice->>Bob: two'
    )

    expect(
      plain.edges.find((edge) => edge.id === 'edge-1-a')!.sourceHandle
    ).toBe(rowHandleId(1, 'right', 'source'))
    expect(
      noted.edges.find((edge) => edge.id === 'edge-2-a')!.sourceHandle
    ).toBe(rowHandleId(2, 'right', 'source'))
  })
})
