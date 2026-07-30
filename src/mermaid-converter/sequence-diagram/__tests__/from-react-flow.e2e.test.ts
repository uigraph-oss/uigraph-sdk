import { Edge, Node } from '@xyflow/react'
import { describe, expect, it } from 'vitest'
import { generateComponentFieldNameInput } from '../../../components/component-field'
import {
  convertReactFlowToSequenceMermaid,
  isSequenceDiagram,
} from '../from-react-flow'
import { parseSequenceDiagram } from '../parser'
import { convertSequenceDiagramToReactFlow } from '../to-react-flow'

/**
 * End-to-end coverage of the export button: mermaid source -> canvas nodes and
 * edges -> mermaid source again.
 *
 * Every case asserts three things, because each catches a different class of
 * bug: the exact emitted text (formatting, indentation, ordering), semantic
 * equivalence with the input once both are re-parsed (nothing lost or
 * invented), and idempotence over a second round trip (the export is a fixed
 * point, so re-importing an export never drifts).
 */

function importDiagram(source: string) {
  return convertSequenceDiagramToReactFlow(source)
}

function exportDiagram(source: string): string {
  const { nodes, edges } = importDiagram(source)
  return convertReactFlowToSequenceMermaid(nodes, edges)
}

/**
 * Parsed shape with mermaid's internal ids resolved to display names — the
 * exporter regenerates ids (`A` -> `AliceSmith`), so ids are the one thing a
 * round trip is not expected to preserve.
 */
function semantics(source: string) {
  const data = parseSequenceDiagram(source)
  const nameById = new Map(data.participants.map((p) => [p.id, p.name]))

  return {
    participants: data.participants.map((participant) => ({
      name: participant.name,
      type: participant.type,
      created: participant.createdAtRow !== undefined,
      destroyed: participant.destroyedAtRow !== undefined,
    })),
    messages: data.messages.map((message) => ({
      from: nameById.get(message.from),
      to: nameById.get(message.to),
      label: message.label,
      lineStyle: message.lineStyle,
      arrowType: message.arrowType,
      sequenceNumber: message.sequenceNumber,
    })),
    notes: data.notes.map((note) => ({
      placement: note.placement,
      participants: note.participants.map((id) => nameById.get(id)),
      text: note.text,
    })),
    blocks: data.blocks.map((block) => ({
      type: block.type,
      label: block.label,
      color: block.color,
      sections: block.sections.map((section) => section.label),
    })),
    boxes: data.boxes.map((box) => ({
      label: box.label,
      participants: box.participants.map((id) => nameById.get(id)),
    })),
    activations: data.activations
      .map((activation) => nameById.get(activation.participant))
      .sort(),
    title: data.title,
  }
}

function expectRoundTrip(source: string, expected: string) {
  const exported = exportDiagram(source)

  expect(exported).toBe(expected)
  expect(semantics(exported)).toEqual(semantics(source))
  expect(exportDiagram(exported)).toBe(exported)
}

describe('isSequenceDiagram', () => {
  it('is true for an imported sequence diagram', () => {
    const { nodes } = importDiagram(
      ['sequenceDiagram', '  Alice->>John: Hi'].join('\n')
    )
    expect(isSequenceDiagram(nodes)).toBe(true)
  })

  it('is false for a flowchart and for an empty canvas', () => {
    const flowchartNodes: Node[] = [
      {
        id: 'A',
        type: 'shape',
        position: { x: 0, y: 0 },
        data: { componentFields: [generateComponentFieldNameInput('Start')] },
      },
    ]

    expect(isSequenceDiagram(flowchartNodes)).toBe(false)
    expect(isSequenceDiagram([])).toBe(false)
  })
})

describe('sequence diagram export e2e', () => {
  it('exports participants, a self-message loop and a note', () => {
    expectRoundTrip(
      [
        'sequenceDiagram',
        '    participant Alice',
        '    participant Bob',
        '    Alice->>John: Hello John, how are you?',
        '    loop HealthCheck',
        '        John->>John: Fight against hypochondria',
        '    end',
        '    Note right of John: Rational thoughts<br/>prevail!',
        '    John-->>Alice: Great!',
        '    John->>Bob: How about you?',
        '    Bob-->>John: Jolly good!',
      ].join('\n'),
      [
        'sequenceDiagram',
        '  participant Alice',
        '  participant Bob',
        '  participant John',
        '  Alice->>John: Hello John, how are you?',
        '  loop HealthCheck',
        '    John->>John: Fight against hypochondria',
        '  end',
        '  Note right of John: Rational thoughts<br/>prevail!',
        '  John-->>Alice: Great!',
        '  John->>Bob: How about you?',
        '  Bob-->>John: Jolly good!',
      ].join('\n')
    )
  })

  it('exports actors, aliases and stacked activations', () => {
    expectRoundTrip(
      [
        'sequenceDiagram',
        '    actor A as Alice Smith',
        '    participant J as John Doe',
        '    A->>+J: Hello John, how are you?',
        '    A->>+J: John, can you hear me?',
        '    J-->>-A: Hi Alice, I can hear you!',
        '    J-->>-A: I feel great!',
      ].join('\n'),
      [
        'sequenceDiagram',
        '  actor AliceSmith as Alice Smith',
        '  participant JohnDoe as John Doe',
        '  activate JohnDoe',
        '  AliceSmith->>JohnDoe: Hello John, how are you?',
        '  activate JohnDoe',
        '  AliceSmith->>JohnDoe: John, can you hear me?',
        '  JohnDoe-->>AliceSmith: Hi Alice, I can hear you!',
        '  deactivate JohnDoe',
        '  JohnDoe-->>AliceSmith: I feel great!',
        '  deactivate JohnDoe',
      ].join('\n')
    )
  })

  it('exports boxes, autonumber and every block flavour', () => {
    expectRoundTrip(
      [
        'sequenceDiagram',
        '    autonumber 3 2',
        '    box Purple Alice & John',
        '    participant Alice',
        '    participant John',
        '    end',
        '    participant Bob',
        '    Alice->>John: Hello John, how are you?',
        '    alt is sick',
        '        John->>Alice: Not so good :(',
        '    else is well',
        '        John->>Alice: Feeling fresh like a daisy',
        '    end',
        '    opt Extra response',
        '        John->>Alice: Thanks for asking',
        '    end',
        '    par Alice to Bob',
        '        Alice->>Bob: Hello Bob',
        '    and Alice to John',
        '        Alice->>John: Hello John',
        '    end',
        '    rect rgb(191, 223, 255)',
        '    Bob->>Alice: Hi',
        '    end',
      ].join('\n'),
      [
        'sequenceDiagram',
        '  box Purple Alice & John',
        '  participant Alice',
        '  participant John',
        '  end',
        '  participant Bob',
        '  autonumber 3 2',
        '  Alice->>John: Hello John, how are you?',
        '  alt is sick',
        '    John->>Alice: Not so good :(',
        '  else is well',
        '    John->>Alice: Feeling fresh like a daisy',
        '  end',
        '  opt Extra response',
        '    John->>Alice: Thanks for asking',
        '  end',
        '  par Alice to Bob',
        '    Alice->>Bob: Hello Bob',
        '  and Alice to John',
        '    Alice->>John: Hello John',
        '  end',
        '  rect rgb(191, 223, 255)',
        '    Bob->>Alice: Hi',
        '  end',
      ].join('\n')
    )
  })

  it('exports nested blocks at their own depth', () => {
    expectRoundTrip(
      [
        'sequenceDiagram',
        '    participant Alice',
        '    participant Bob',
        '    loop Retry',
        '        alt success',
        '            Alice->>Bob: Done',
        '        else failure',
        '            Alice->>Bob: Retry',
        '        end',
        '    end',
        '    critical Establish connection',
        '        Alice->>Bob: connect',
        '    option Network timeout',
        '        Alice->>Bob: Log error',
        '    end',
      ].join('\n'),
      [
        'sequenceDiagram',
        '  participant Alice',
        '  participant Bob',
        '  loop Retry',
        '    alt success',
        '      Alice->>Bob: Done',
        '    else failure',
        '      Alice->>Bob: Retry',
        '    end',
        '  end',
        '  critical Establish connection',
        '    Alice->>Bob: connect',
        '  option Network timeout',
        '    Alice->>Bob: Log error',
        '  end',
      ].join('\n')
    )
  })

  it('exports title, create and destroy', () => {
    expectRoundTrip(
      [
        'sequenceDiagram',
        '    title Order flow',
        '    Alice->>Bob: Hello Bob, how are you ?',
        '    create participant Carl',
        '    Alice->>Carl: Hi Carl!',
        '    create actor D as Donald',
        '    Carl->>D: Hi!',
        '    destroy Carl',
        '    Alice-xCarl: We are too many',
        '    destroy Bob',
        '    Bob->>Alice: I agree',
      ].join('\n'),
      [
        'sequenceDiagram',
        '  title Order flow',
        '  participant Alice',
        '  participant Bob',
        '  Alice->>Bob: Hello Bob, how are you ?',
        '  create participant Carl',
        '  Alice->>Carl: Hi Carl!',
        '  create actor Donald',
        '  Carl->>Donald: Hi!',
        '  destroy Carl',
        '  Alice-xCarl: We are too many',
        '  destroy Bob',
        '  Bob->>Alice: I agree',
      ].join('\n')
    )
  })

  it('exports every arrow variant with its own token', () => {
    expectRoundTrip(
      [
        'sequenceDiagram',
        '    Alice->John: solid line no arrow',
        '    Alice-->John: dotted line no arrow',
        '    Alice->>John: solid line arrowhead',
        '    Alice-->>John: dotted line arrowhead',
        '    Alice<<->>John: solid line bidirectional',
        '    Alice-xJohn: solid line cross',
        '    Alice--)John: dotted line async',
      ].join('\n'),
      [
        'sequenceDiagram',
        '  participant Alice',
        '  participant John',
        '  Alice->John: solid line no arrow',
        '  Alice-->John: dotted line no arrow',
        '  Alice->>John: solid line arrowhead',
        '  Alice-->>John: dotted line arrowhead',
        '  Alice<<->>John: solid line bidirectional',
        '  Alice-xJohn: solid line cross',
        '  Alice--)John: dotted line async',
      ].join('\n')
    )
  })

  it('exports notes in every placement', () => {
    expectRoundTrip(
      [
        'sequenceDiagram',
        '    participant John',
        '    participant Alice',
        '    Note right of John: Text in note',
        '    Note left of John: Also a note',
        '    Note over Alice,John: A typical interaction',
        '    Alice->>John: Hi',
      ].join('\n'),
      [
        'sequenceDiagram',
        '  participant John',
        '  participant Alice',
        '  Note right of John: Text in note',
        '  Note left of John: Also a note',
        '  Note over Alice,John: A typical interaction',
        '  Alice->>John: Hi',
      ].join('\n')
    )
  })

  it('escapes characters mermaid cannot take literally', () => {
    expectRoundTrip(
      [
        'sequenceDiagram',
        '    Alice->>John: Issue &#35;42<br/>needs review',
      ].join('\n'),
      [
        'sequenceDiagram',
        '  participant Alice',
        '  participant John',
        '  Alice->>John: Issue &#35;42<br/>needs review',
      ].join('\n')
    )
  })
})

describe('canvas-authored sequence diagram export e2e', () => {
  function participantNode(id: string, name: string, x: number): Node {
    return {
      id,
      type: 'sequenceParticipant',
      position: { x, y: 0 },
      data: { componentFields: [generateComponentFieldNameInput(name)] },
    }
  }

  function messageNode(id: string, label: string, y: number): Node {
    return {
      id,
      type: 'shape',
      position: { x: 100, y },
      data: {
        shape: 'rectangle',
        componentFields: [generateComponentFieldNameInput(label)],
      },
    }
  }

  /**
   * A diagram built with the canvas's own authoring tools rather than
   * imported: its edges carry no arrow metadata and its ids are uuid-shaped,
   * so the export has to fall back to the default solid arrow and derive
   * everything else from the graph.
   */
  it('exports messages authored on the canvas', () => {
    const nodes: Node[] = [
      participantNode('participant-01', 'Web App', 0),
      participantNode('participant-02', 'API', 360),
      messageNode('message-01', 'GET /orders', 100),
      messageNode('message-02', 'validate token', 200),
      messageNode('message-03', '200 OK', 300),
    ]

    const edges: Edge[] = [
      {
        id: 'edge-1',
        source: 'participant-01',
        target: 'message-01',
        sourceHandle: 'row-0-right-source',
        targetHandle: 'target-left',
        type: 'smoothstep',
      },
      {
        id: 'edge-2',
        source: 'message-01',
        target: 'participant-02',
        sourceHandle: 'source-right',
        targetHandle: 'row-0-left-target',
        type: 'smoothstep',
      },
      {
        id: 'edge-3',
        source: 'participant-02',
        target: 'message-02',
        sourceHandle: 'row-1-right-source',
        targetHandle: 'target-top',
        type: 'smoothstep',
      },
      {
        id: 'edge-4',
        source: 'message-02',
        target: 'participant-02',
        sourceHandle: 'source-bottom',
        targetHandle: 'row-2-right-target',
        type: 'smoothstep',
      },
      {
        id: 'edge-5',
        source: 'participant-02',
        target: 'message-03',
        sourceHandle: 'row-3-left-source',
        targetHandle: 'target-right',
        type: 'smoothstep',
      },
      {
        id: 'edge-6',
        source: 'message-03',
        target: 'participant-01',
        sourceHandle: 'source-left',
        targetHandle: 'row-3-right-target',
        type: 'smoothstep',
      },
    ]

    const exported = convertReactFlowToSequenceMermaid(nodes, edges)

    expect(exported).toBe(
      [
        'sequenceDiagram',
        '  participant WebApp as Web App',
        '  participant API',
        '  WebApp->>API: GET /orders',
        '  API->>API: validate token',
        '  API->>WebApp: 200 OK',
      ].join('\n')
    )
    expect(exportDiagram(exported)).toBe(exported)
  })

  it('keeps message order from the canvas, not from node order', () => {
    const nodes: Node[] = [
      participantNode('participant-01', 'Alice', 0),
      participantNode('participant-02', 'Bob', 360),
      messageNode('message-second', 'Second', 300),
      messageNode('message-first', 'First', 100),
    ]

    const edges: Edge[] = [
      {
        id: 'edge-1',
        source: 'participant-01',
        target: 'message-second',
        sourceHandle: 'row-1-right-source',
        targetHandle: 'target-left',
      },
      {
        id: 'edge-2',
        source: 'message-second',
        target: 'participant-02',
        sourceHandle: 'source-right',
        targetHandle: 'row-1-left-target',
      },
      {
        id: 'edge-3',
        source: 'participant-01',
        target: 'message-first',
        sourceHandle: 'row-0-right-source',
        targetHandle: 'target-left',
      },
      {
        id: 'edge-4',
        source: 'message-first',
        target: 'participant-02',
        sourceHandle: 'source-right',
        targetHandle: 'row-0-left-target',
      },
    ]

    expect(convertReactFlowToSequenceMermaid(nodes, edges)).toBe(
      [
        'sequenceDiagram',
        '  participant Alice',
        '  participant Bob',
        '  Alice->>Bob: First',
        '  Alice->>Bob: Second',
      ].join('\n')
    )
  })

  it('ignores non-sequence nodes left on the canvas', () => {
    const nodes: Node[] = [
      participantNode('participant-01', 'Alice', 0),
      participantNode('participant-02', 'Bob', 360),
      messageNode('message-01', 'Hello', 100),
      {
        id: 'sticky-note',
        type: 'shape',
        position: { x: 900, y: 150 },
        data: {
          shape: 'rectangle',
          componentFields: [generateComponentFieldNameInput('TODO: rewrite')],
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
    ]

    expect(convertReactFlowToSequenceMermaid(nodes, edges)).toBe(
      [
        'sequenceDiagram',
        '  participant Alice',
        '  participant Bob',
        '  Alice->>Bob: Hello',
      ].join('\n')
    )
  })
})
