import { describe, expect, it } from 'vitest'
import {
  convertReactFlowToSequenceMermaid,
  isSequenceDiagram,
} from './react-flow-to-sequence'
import { parseSequenceDiagram } from './sequence-parser'
import { convertSequenceDiagramToReactFlow } from './sequence-to-react-flow'

function roundTrip(source: string) {
  const { nodes, edges } = convertSequenceDiagramToReactFlow(source)
  return convertReactFlowToSequenceMermaid(nodes, edges)
}

describe('isSequenceDiagram', () => {
  it('is true only when the canvas holds participants', () => {
    const { nodes } = convertSequenceDiagramToReactFlow(
      ['sequenceDiagram', '  Alice->>John: Hi'].join('\n')
    )
    expect(isSequenceDiagram(nodes)).toBe(true)
    expect(isSequenceDiagram([])).toBe(false)
  })
})

describe('round trip', () => {
  it('keeps participants, order and messages', () => {
    const exported = roundTrip(
      [
        'sequenceDiagram',
        '  participant Alice',
        '  participant John',
        '  Alice->>John: Hello John, how are you?',
        '  John-->>Alice: Great!',
      ].join('\n')
    )

    const data = parseSequenceDiagram(exported)
    expect(data.participants.map((p) => p.id)).toEqual(['Alice', 'John'])
    expect(data.messages).toMatchObject([
      {
        from: 'Alice',
        to: 'John',
        label: 'Hello John, how are you?',
        lineStyle: 'solid',
        arrowType: 'filled',
      },
      {
        from: 'John',
        to: 'Alice',
        label: 'Great!',
        lineStyle: 'dashed',
        arrowType: 'filled',
      },
    ])
  })

  it('re-encodes line breaks as <br/>', () => {
    const exported = roundTrip(
      ['sequenceDiagram', '  Alice->>John: Hello John,<br/>how are you?'].join(
        '\n'
      )
    )

    expect(exported).toContain('Hello John,<br/>how are you?')
    expect(parseSequenceDiagram(exported).messages[0].label).toBe(
      'Hello John,\nhow are you?'
    )
  })

  it('aliases participants whose display name is not a valid id', () => {
    const exported = roundTrip(
      [
        'sequenceDiagram',
        '  participant A as Alice Smith',
        '  A->>A: Think it over',
      ].join('\n')
    )

    const data = parseSequenceDiagram(exported)
    expect(data.participants[0].name).toBe('Alice Smith')
    expect(data.messages[0]).toMatchObject({
      from: data.participants[0].id,
      to: data.participants[0].id,
    })
  })

  it('keeps actors, notes, loops and activations', () => {
    const exported = roundTrip(
      [
        'sequenceDiagram',
        '  actor Alice',
        '  participant John',
        '  Note right of Alice: A note that<br/>breaks lines.',
        '  loop Every minute',
        '    Alice->>+John: Ping',
        '    John-->>-Alice: Pong',
        '  end',
      ].join('\n')
    )

    const data = parseSequenceDiagram(exported)
    expect(data.participants[0].type).toBe('actor')
    expect(data.notes).toMatchObject([
      {
        placement: 'right of',
        participants: ['Alice'],
        text: 'A note that\nbreaks lines.',
      },
    ])
    expect(data.blocks).toMatchObject([{ type: 'loop', label: 'Every minute' }])
    expect(data.activations).toMatchObject([{ participant: 'John' }])
    expect(data.messages.map((m) => m.label)).toEqual(['Ping', 'Pong'])
  })

  it('keeps alt branches, boxes and autonumber', () => {
    const exported = roundTrip(
      [
        'sequenceDiagram',
        '  autonumber 1 1',
        '  box Team',
        '    participant Alice',
        '    participant John',
        '  end',
        '  alt is sick',
        '    Alice->>John: Get well',
        '  else is well',
        '    Alice->>John: Nice to hear',
        '  end',
      ].join('\n')
    )

    const data = parseSequenceDiagram(exported)
    expect(data.boxes).toMatchObject([
      { label: 'Team', participants: ['Alice', 'John'] },
    ])
    expect(data.blocks[0].sections.map((s) => s.label)).toEqual([
      'is sick',
      'is well',
    ])
    expect(data.messages.map((m) => m.sequenceNumber)).toEqual([1, 2])
  })

  it('keeps arrow variants', () => {
    const exported = roundTrip(
      [
        'sequenceDiagram',
        '  Alice->John: solid no arrow',
        '  Alice-->John: dotted no arrow',
        '  Alice-)John: async',
        '  Alice--xJohn: dotted cross',
        '  Alice<<->>John: bidirectional',
      ].join('\n')
    )

    const data = parseSequenceDiagram(exported)
    expect(data.messages.map((m) => `${m.lineStyle}:${m.arrowType}`)).toEqual([
      'solid:none',
      'dashed:none',
      'solid:open',
      'dashed:cross',
      'solid:bidirectional',
    ])
  })

  it('keeps title, create and destroy', () => {
    const exported = roundTrip(
      [
        'sequenceDiagram',
        '  title Order flow',
        '  participant Alice',
        '  Alice->>Bob: Hello',
        '  create participant Carl',
        '  Alice->>Carl: Hi Carl',
        '  destroy Carl',
        '  Carl-->>Alice: Bye',
      ].join('\n')
    )

    const data = parseSequenceDiagram(exported)
    expect(data.title).toBe('Order flow')
    const carl = data.participants.find((p) => p.name === 'Carl')
    expect(carl?.createdAtRow).toBe(1)
    expect(carl?.destroyedAtRow).toBe(2)
  })
})
