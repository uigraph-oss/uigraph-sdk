import { Edge, Node } from '@xyflow/react'
import { describe, expect, it } from 'vitest'
import { generateComponentFieldNameInput } from '../components/component-field'
import { convertMermaidToReactFlow } from './mermaid-to-react-flow'
import {
  convertReactFlowToSequenceMermaid,
  isSequenceDiagram,
} from './react-flow-to-sequence'

/**
 * Unit-level coverage of the individual rules the exporter applies — how it
 * reads a label, mints a mermaid id, picks an arrow token, resolves a note's
 * participants, and what it does when a piece of that data is missing.
 * Whole-diagram behaviour lives in the `.e2e` file next to this one.
 */

function participant(
  name: string,
  x: number,
  overrides: { id?: string; data?: Record<string, unknown> } = {}
): Node {
  return {
    id: overrides.id ?? `participant-${name}`,
    type: 'sequenceParticipant',
    position: { x, y: 0 },
    data: {
      componentFields: [generateComponentFieldNameInput(name)],
      ...overrides.data,
    },
  }
}

function message(
  id: string,
  label: string,
  y: number,
  data: Record<string, unknown> = {}
): Node {
  return {
    id,
    type: 'shape',
    position: { x: 100, y },
    data: {
      shape: 'rectangle',
      componentFields: [generateComponentFieldNameInput(label)],
      ...data,
    },
  }
}

/** The pair of edges a message always has: participant -> box -> participant. */
function messageEdges(
  messageId: string,
  fromId: string,
  toId: string,
  data: { from?: Partial<Edge>; to?: Partial<Edge> } = {}
): Edge[] {
  return [
    {
      id: `${messageId}-a`,
      source: fromId,
      target: messageId,
      sourceHandle: 'row-0-right-source',
      targetHandle: 'target-left',
      ...data.from,
    },
    {
      id: `${messageId}-b`,
      source: messageId,
      target: toId,
      sourceHandle: 'source-right',
      targetHandle: 'row-0-left-target',
      ...data.to,
    },
  ]
}

function exportOf(nodes: Node[], edges: Edge[] = []): string[] {
  return convertReactFlowToSequenceMermaid(nodes, edges).split('\n')
}

/**
 * This guard decides which of two exporters the toolbar runs, so a wrong
 * answer silently produces the wrong file format. The cases below therefore
 * cover both real importer output and the hand-edited canvases that output
 * turns into.
 */
describe('isSequenceDiagram', () => {
  it('is true as soon as one participant is on the canvas', () => {
    expect(isSequenceDiagram([participant('Alice', 0)])).toBe(true)
  })

  it('is false for an empty canvas', () => {
    expect(isSequenceDiagram([])).toBe(false)
  })

  it('is false for shapes and groups that are not participants', () => {
    expect(
      isSequenceDiagram([
        message('message-01', 'Hello', 100),
        {
          id: 'group-01',
          type: 'group',
          position: { x: 0, y: 0 },
          data: {},
        },
      ])
    ).toBe(false)
  })

  it('is true for anything the sequence importer produces', async () => {
    const withMessages = await convertMermaidToReactFlow(
      ['sequenceDiagram', '  Alice->>John: Hi', '  John-->>Alice: Hey'].join(
        '\n'
      )
    )
    const declarationsOnly = await convertMermaidToReactFlow(
      ['sequenceDiagram', '  participant Alice', '  participant John'].join(
        '\n'
      )
    )
    const framesAndNotes = await convertMermaidToReactFlow(
      [
        'sequenceDiagram',
        '  box Team',
        '    participant Alice',
        '  end',
        '  Note over Alice: Alone',
        '  loop Forever',
        '    Alice->>Alice: Think',
        '  end',
      ].join('\n')
    )

    expect(isSequenceDiagram(withMessages.nodes)).toBe(true)
    expect(isSequenceDiagram(declarationsOnly.nodes)).toBe(true)
    expect(isSequenceDiagram(framesAndNotes.nodes)).toBe(true)
  })

  it('is false for anything the flowchart importer produces', async () => {
    const flowchart = await convertMermaidToReactFlow(
      ['flowchart LR', '  A[Start] --> B{Choice}', '  B --> C[End]'].join('\n')
    )
    const subgraphs = await convertMermaidToReactFlow(
      [
        'flowchart TB',
        '  subgraph Services',
        '    API --> Worker',
        '  end',
        '  Services --> DB',
      ].join('\n')
    )

    expect(flowchart.nodes.length).toBeGreaterThan(0)
    expect(isSequenceDiagram(flowchart.nodes)).toBe(false)
    expect(isSequenceDiagram(subgraphs.nodes)).toBe(false)
  })

  it('is false for unparseable input that imports to nothing', async () => {
    const nothing = await convertMermaidToReactFlow('not a diagram at all')

    expect(isSequenceDiagram(nothing.nodes)).toBe(false)
  })

  it('is false for other canvas node types', () => {
    const nodes: Node[] = [
      {
        id: 'table-01',
        type: 'databaseTableSQL',
        position: { x: 0, y: 0 },
        data: {},
      },
      { id: 'text-01', type: 'text', position: { x: 0, y: 0 }, data: {} },
      { id: 'image-01', type: 'image', position: { x: 0, y: 0 }, data: {} },
      { id: 'comment-01', type: 'comment', position: { x: 0, y: 0 }, data: {} },
    ]

    expect(isSequenceDiagram(nodes)).toBe(false)
  })

  it('matches the node type exactly, not by shape of the name', () => {
    const lookalikes: Node[] = [
      {
        id: '1',
        type: 'SequenceParticipant',
        position: { x: 0, y: 0 },
        data: {},
      },
      {
        id: '2',
        type: 'sequenceparticipant',
        position: { x: 0, y: 0 },
        data: {},
      },
      {
        id: '3',
        type: 'sequence-participant',
        position: { x: 0, y: 0 },
        data: {},
      },
      {
        id: '4',
        type: 'sequenceParticipantNode',
        position: { x: 0, y: 0 },
        data: {},
      },
    ]

    for (const node of lookalikes) {
      expect(isSequenceDiagram([node])).toBe(false)
    }
  })

  it('is not fooled by a participant-shaped id, label or payload', () => {
    const nodes: Node[] = [
      {
        id: 'participant-Alice',
        type: 'shape',
        position: { x: 0, y: 0 },
        data: {
          label: 'sequenceParticipant',
          componentFields: [generateComponentFieldNameInput('Alice')],
        },
      },
      {
        id: 'note-01',
        type: 'shape',
        position: { x: 0, y: 100 },
        data: { sequenceNote: { placement: 'over', participants: ['Alice'] } },
      },
      {
        id: 'sequence-block-01',
        type: 'group',
        position: { x: 0, y: 0 },
        data: { sequenceBlock: { type: 'loop', startRow: 0, endRow: 1 } },
      },
      {
        id: 'sequence-box-01',
        type: 'group',
        position: { x: 0, y: 0 },
        data: { sequenceBox: { label: 'Team', participants: ['Alice'] } },
      },
    ]

    expect(isSequenceDiagram(nodes)).toBe(false)
  })

  it('ignores a node without a type', () => {
    const untyped: Node = { id: 'anything', position: { x: 0, y: 0 }, data: {} }

    expect(isSequenceDiagram([untyped])).toBe(false)
    expect(isSequenceDiagram([untyped, participant('Alice', 0)])).toBe(true)
  })

  it('finds a participant anywhere in the canvas', () => {
    const filler: Node[] = Array.from({ length: 200 }, (_, index) => ({
      id: `shape-${index}`,
      type: 'shape',
      position: { x: index, y: index },
      data: {},
    }))

    expect(isSequenceDiagram([participant('Alice', 0), ...filler])).toBe(true)
    expect(isSequenceDiagram([...filler, participant('Alice', 0)])).toBe(true)
    expect(
      isSequenceDiagram([
        ...filler.slice(0, 100),
        participant('Alice', 0),
        ...filler.slice(100),
      ])
    ).toBe(true)
  })

  it('is true for a canvas that mixes a sequence diagram with other shapes', () => {
    expect(
      isSequenceDiagram([
        { id: 'A', type: 'shape', position: { x: 0, y: 0 }, data: {} },
        { id: 'B', type: 'text', position: { x: 0, y: 200 }, data: {} },
        participant('Alice', 400),
      ])
    ).toBe(true)
  })

  it('is true for a participant nested inside a box group', () => {
    expect(
      isSequenceDiagram([
        {
          id: 'sequence-box-box-0',
          type: 'group',
          position: { x: 0, y: 0 },
          data: { sequenceBox: { label: 'Team', participants: ['Alice'] } },
        },
        {
          ...participant('Alice', 0),
          parentId: 'sequence-box-box-0',
          extent: 'parent',
        },
      ])
    ).toBe(true)
  })

  it('turns false once the last participant is deleted', () => {
    const nodes = [
      participant('Alice', 0, { id: 'participant-01' }),
      participant('Bob', 360, { id: 'participant-02' }),
      message('message-01', 'Hello', 100),
    ]

    expect(isSequenceDiagram(nodes)).toBe(true)
    expect(
      isSequenceDiagram(nodes.filter((node) => node.id !== 'participant-01'))
    ).toBe(true)
    expect(
      isSequenceDiagram(
        nodes.filter((node) => node.type !== 'sequenceParticipant')
      )
    ).toBe(false)
  })

  it('leaves the canvas untouched', () => {
    const nodes = [participant('Alice', 0), message('message-01', 'Hi', 100)]
    const snapshot = JSON.parse(JSON.stringify(nodes))

    isSequenceDiagram(nodes)

    expect(nodes).toEqual(snapshot)
  })

  it('agrees with what the sequence exporter can actually produce', async () => {
    const { nodes, edges } = await convertMermaidToReactFlow(
      ['sequenceDiagram', '  Alice->>John: Hi'].join('\n')
    )

    expect(isSequenceDiagram(nodes)).toBe(true)
    expect(convertReactFlowToSequenceMermaid(nodes, edges)).toContain(
      'participant Alice'
    )
  })
})

describe('participants', () => {
  it('declares participants left to right, whatever the node order', () => {
    expect(
      exportOf([
        participant('Charlie', 720),
        participant('Alice', 0),
        participant('Bob', 360),
      ])
    ).toEqual([
      'sequenceDiagram',
      '  participant Alice',
      '  participant Bob',
      '  participant Charlie',
    ])
  })

  it('reads a name from data.label when there are no component fields', () => {
    const node: Node = {
      id: 'participant-01',
      type: 'sequenceParticipant',
      position: { x: 0, y: 0 },
      data: { label: 'Alice' },
    }

    expect(exportOf([node])).toEqual(['sequenceDiagram', '  participant Alice'])
  })

  it('names an unlabelled participant after its column', () => {
    const node: Node = {
      id: 'participant-01',
      type: 'sequenceParticipant',
      position: { x: 0, y: 0 },
      data: {},
    }

    expect(exportOf([node])).toEqual([
      'sequenceDiagram',
      '  participant Participant1 as Participant 1',
    ])
  })

  it('aliases a name that is not a legal mermaid id', () => {
    expect(exportOf([participant('Web App', 0)])).toEqual([
      'sequenceDiagram',
      '  participant WebApp as Web App',
    ])
  })

  it('falls back to a positional id when nothing of the name survives', () => {
    expect(exportOf([participant('***', 0)])).toEqual([
      'sequenceDiagram',
      '  participant P0 as ***',
    ])
  })

  it('keeps duplicate names apart with distinct ids', () => {
    expect(
      exportOf([
        participant('API', 0, { id: 'participant-01' }),
        participant('API', 360, { id: 'participant-02' }),
      ])
    ).toEqual([
      'sequenceDiagram',
      '  participant API',
      '  participant API_2 as API',
    ])
  })

  it('declares an actor with the actor keyword', () => {
    expect(
      exportOf([
        participant('Alice', 0, { data: { participantType: 'actor' } }),
      ])
    ).toEqual(['sequenceDiagram', '  actor Alice'])
  })

  it('writes other participant types as a stereotype', () => {
    expect(
      exportOf([
        participant('Store', 0, { data: { participantType: 'database' } }),
      ])
    ).toEqual(['sequenceDiagram', '  participant Store@{ "type": "database" }'])
  })

  it('emits an actor menu for each link', () => {
    expect(
      exportOf([
        participant('Alice', 0, {
          data: {
            links: [
              {
                label: 'Dashboard',
                url: 'https://dashboard.contoso.com/alice',
              },
              { label: 'Wiki', url: 'https://wiki.contoso.com/alice' },
            ],
          },
        }),
      ])
    ).toEqual([
      'sequenceDiagram',
      '  participant Alice',
      '  link Alice: Dashboard @ https://dashboard.contoso.com/alice',
      '  link Alice: Wiki @ https://wiki.contoso.com/alice',
    ])
  })
})

describe('messages', () => {
  const alice = participant('Alice', 0, { id: 'participant-01' })
  const bob = participant('Bob', 360, { id: 'participant-02' })

  it('defaults to a solid filled arrow when the edges carry no metadata', () => {
    expect(
      exportOf(
        [alice, bob, message('message-01', 'Hello', 100)],
        messageEdges('message-01', 'participant-01', 'participant-02')
      )
    ).toEqual([
      'sequenceDiagram',
      '  participant Alice',
      '  participant Bob',
      '  Alice->>Bob: Hello',
    ])
  })

  it('reads the arrow head from the edge data', () => {
    const [line] = exportOf(
      [alice, bob, message('message-01', 'Ping', 100)],
      messageEdges('message-01', 'participant-01', 'participant-02', {
        to: { data: { arrowType: 'open' } },
      })
    ).slice(-1)

    expect(line).toBe('  Alice-)Bob: Ping')
  })

  it('reads a dashed line from the edge stroke', () => {
    const [line] = exportOf(
      [alice, bob, message('message-01', 'Pong', 100)],
      messageEdges('message-01', 'participant-01', 'participant-02', {
        to: { data: { arrowType: 'cross' }, style: { strokeDasharray: '4 4' } },
      })
    ).slice(-1)

    expect(line).toBe('  Alice--xBob: Pong')
  })

  it('keeps the barb on the source end of a reversed half arrow', () => {
    const [line] = exportOf(
      [alice, bob, message('message-01', 'Half', 100)],
      messageEdges('message-01', 'participant-01', 'participant-02', {
        from: { data: { arrowType: 'half', half: 'top', reversed: true } },
        to: { data: { arrowType: 'half', half: 'top' } },
      })
    ).slice(-1)

    expect(line).toBe('  Alice/|-Bob: Half')
  })

  it('marks central connections on either end', () => {
    const [line] = exportOf(
      [alice, bob, message('message-01', 'Central', 100)],
      messageEdges('message-01', 'participant-01', 'participant-02', {
        from: { data: { centralSource: true } },
        to: { data: { centralTarget: true } },
      })
    ).slice(-1)

    expect(line).toBe('  Alice()->>()Bob: Central')
  })

  it('re-encodes line breaks and hashes in a label', () => {
    const [line] = exportOf(
      [alice, bob, message('message-01', 'Issue #42\nneeds review', 100)],
      messageEdges('message-01', 'participant-01', 'participant-02')
    ).slice(-1)

    expect(line).toBe('  Alice->>Bob: Issue &#35;42<br/>needs review')
  })

  it('skips a message box that is not wired to two participants', () => {
    expect(
      exportOf(
        [alice, bob, message('message-01', 'Dangling', 100)],
        [
          {
            id: 'edge-1',
            source: 'participant-01',
            target: 'message-01',
            sourceHandle: 'row-0-right-source',
            targetHandle: 'target-left',
          },
        ]
      )
    ).toEqual(['sequenceDiagram', '  participant Alice', '  participant Bob'])
  })

  it('derives autonumber from the numbers the messages carry', () => {
    const lines = exportOf(
      [
        alice,
        bob,
        message('message-01', 'First', 100, { sequenceNumber: 5 }),
        message('message-02', 'Second', 200, { sequenceNumber: 7 }),
      ],
      [
        ...messageEdges('message-01', 'participant-01', 'participant-02'),
        ...messageEdges('message-02', 'participant-01', 'participant-02'),
      ]
    )

    expect(lines).toContain('  autonumber 5 2')
  })

  it('assumes a step of one when a single message is numbered', () => {
    const lines = exportOf(
      [alice, bob, message('message-01', 'Only', 100, { sequenceNumber: 4 })],
      messageEdges('message-01', 'participant-01', 'participant-02')
    )

    expect(lines).toContain('  autonumber 4 1')
  })

  it('leaves autonumber out when no message is numbered', () => {
    const lines = exportOf(
      [alice, bob, message('message-01', 'Only', 100)],
      messageEdges('message-01', 'participant-01', 'participant-02')
    )

    expect(lines.some((line) => line.includes('autonumber'))).toBe(false)
  })
})

describe('notes', () => {
  const alice = participant('Alice', 0, { id: 'participant-Alice' })
  const bob = participant('Bob', 360, { id: 'participant-Bob' })

  function note(placement: string | undefined, participants: string[]): Node {
    return {
      id: 'note-01',
      type: 'shape',
      position: { x: 24, y: 100 },
      width: 200,
      data: {
        sequenceNote: { placement, participants },
        componentFields: [generateComponentFieldNameInput('Remember this')],
      },
    }
  }

  it('writes the placement and participants it was imported with', () => {
    expect(exportOf([alice, bob, note('over', ['Alice', 'Bob'])])).toEqual([
      'sequenceDiagram',
      '  participant Alice',
      '  participant Bob',
      '  Note over Alice,Bob: Remember this',
    ])
  })

  it('defaults to `over` when the placement is missing', () => {
    const [line] = exportOf([alice, bob, note(undefined, ['Alice'])]).slice(-1)

    expect(line).toBe('  Note over Alice: Remember this')
  })

  it('falls back to the nearest column when the participants no longer match', () => {
    const [line] = exportOf([alice, bob, note('right of', ['Gone'])]).slice(-1)

    expect(line).toBe('  Note right of Alice: Remember this')
  })

  it('drops a note when there is no participant to hang it on', () => {
    expect(exportOf([note('over', ['Alice'])])).toEqual(['sequenceDiagram'])
  })
})

describe('frames', () => {
  const alice = participant('Alice', 0, { id: 'participant-01' })
  const bob = participant('Bob', 360, { id: 'participant-02' })
  const messages = [
    message('message-01', 'First', 100),
    message('message-02', 'Second', 200),
  ]
  const edges = [
    ...messageEdges('message-01', 'participant-01', 'participant-02'),
    ...messageEdges('message-02', 'participant-01', 'participant-02'),
  ]

  function block(data: Record<string, unknown>): Node {
    return {
      id: 'sequence-block-01',
      type: 'group',
      position: { x: -40, y: 60 },
      width: 500,
      height: 200,
      data: { sequenceBlock: data },
    }
  }

  it('wraps only the rows the frame covers', () => {
    expect(
      exportOf(
        [
          alice,
          bob,
          ...messages,
          block({ type: 'loop', label: 'Retry', startRow: 0, endRow: 0 }),
        ],
        edges
      )
    ).toEqual([
      'sequenceDiagram',
      '  participant Alice',
      '  participant Bob',
      '  loop Retry',
      '    Alice->>Bob: First',
      '  end',
      '  Alice->>Bob: Second',
    ])
  })

  it('omits the label of an unlabelled frame', () => {
    const lines = exportOf(
      [
        alice,
        bob,
        ...messages,
        block({ type: 'opt', label: '', startRow: 0, endRow: 1 }),
      ],
      edges
    )

    expect(lines).toContain('  opt')
  })

  it('keeps a rect background color', () => {
    const lines = exportOf(
      [
        alice,
        bob,
        ...messages,
        block({
          type: 'rect',
          label: '',
          color: 'rgb(191, 223, 255)',
          startRow: 0,
          endRow: 1,
        }),
      ],
      edges
    )

    expect(lines).toContain('  rect rgb(191, 223, 255)')
  })

  it('ignores a frame with no row range', () => {
    const lines = exportOf(
      [alice, bob, ...messages, block({ type: 'loop', label: 'Broken' })],
      edges
    )

    expect(lines.some((line) => line.includes('loop'))).toBe(false)
  })

  it('groups participants inside a box by the columns it spans', () => {
    const box: Node = {
      id: 'sequence-box-01',
      type: 'group',
      position: { x: -40, y: -26 },
      width: 500,
      data: {
        sequenceBox: { label: 'Team', participants: ['stale-id'] },
        backgroundColor: 'Aqua',
      },
    }

    expect(exportOf([alice, bob, participant('Carl', 900), box])).toEqual([
      'sequenceDiagram',
      '  box Aqua Team',
      '  participant Alice',
      '  participant Bob',
      '  end',
      '  participant Carl',
    ])
  })
})

describe('lifelines', () => {
  const alice = participant('Alice', 0, { id: 'participant-01' })

  it('opens and closes an activation around the rows it covers', () => {
    const bob = participant('Bob', 360, {
      id: 'participant-02',
      data: { activations: [{ startRow: 0, endRow: 1 }] },
    })

    expect(
      exportOf(
        [
          alice,
          bob,
          message('message-01', 'Ping', 100),
          message('message-02', 'Pong', 200),
        ],
        [
          ...messageEdges('message-01', 'participant-01', 'participant-02'),
          ...messageEdges('message-02', 'participant-02', 'participant-01'),
        ]
      )
    ).toEqual([
      'sequenceDiagram',
      '  participant Alice',
      '  participant Bob',
      '  activate Bob',
      '  Alice->>Bob: Ping',
      '  Bob->>Alice: Pong',
      '  deactivate Bob',
    ])
  })

  it('creates a late participant at its row instead of declaring it upfront', () => {
    const carl = participant('Carl', 360, {
      id: 'participant-02',
      data: { lifelineStartRow: 0 },
    })

    expect(
      exportOf(
        [alice, carl, message('message-01', 'Hi Carl', 100)],
        messageEdges('message-01', 'participant-01', 'participant-02')
      )
    ).toEqual([
      'sequenceDiagram',
      '  participant Alice',
      '  create participant Carl',
      '  Alice->>Carl: Hi Carl',
    ])
  })

  it('destroys a participant on the row its lifeline ends', () => {
    const carl = participant('Carl', 360, {
      id: 'participant-02',
      data: { lifelineEndRow: 0 },
    })

    expect(
      exportOf(
        [alice, carl, message('message-01', 'Bye Carl', 100)],
        messageEdges('message-01', 'participant-01', 'participant-02')
      )
    ).toEqual([
      'sequenceDiagram',
      '  participant Alice',
      '  participant Carl',
      '  destroy Carl',
      '  Alice->>Carl: Bye Carl',
    ])
  })
})

describe('title', () => {
  it('writes the title node above the participants', () => {
    const title: Node = {
      id: 'sequence-title',
      type: 'text',
      position: { x: 0, y: -80 },
      data: {
        componentFields: [
          {
            componentFieldId: 'text',
            label: 'Text',
            type: 'text-box',
            data: [{ value: 'Order flow' }],
          },
        ],
      },
    }

    expect(exportOf([title, participant('Alice', 0)])).toEqual([
      'sequenceDiagram',
      '  title Order flow',
      '  participant Alice',
    ])
  })
})

describe('empty input', () => {
  it('still produces a valid, empty sequence diagram', () => {
    expect(exportOf([])).toEqual(['sequenceDiagram'])
  })
})
