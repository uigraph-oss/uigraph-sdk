import { describe, expect, it } from 'vitest'
import { SEQUENCE_LAYOUT } from '../../constants/layout'
import { parseSequenceDiagram } from '../parser'
import { convertSequenceDiagramToReactFlow } from '../to-react-flow'

type NodeData = {
  componentFields?: Array<{ data?: Array<{ value?: string }> }>
}
type ParticipantData = NodeData & {
  rowYs?: number[]
  rowHeight?: number
  lifelineHeight?: number
  lifelineStartRow?: number
  lifelineEndRow?: number
  activations?: Array<{ startRow: number; endRow: number }>
}
type MessageData = NodeData & { sequenceNumber?: number }
type BlockData = NodeData & {
  sequenceBlock?: {
    type: string
    label?: string
    sections?: Array<{ label?: string; startRow: number; endRow: number }>
  }
}

/**
 * Coverage of https://mermaid.js.org/syntax/sequenceDiagram.html, section by
 * section. Examples are taken from the documentation itself so a mermaid
 * upstream change shows up here as a failure rather than as a silently
 * mis-imported diagram.
 */

function parse(...lines: string[]) {
  return parseSequenceDiagram(['sequenceDiagram', ...lines].join('\n'))
}

describe('participants', () => {
  it('renders participants in declaration order, not first-message order', () => {
    const { participants } = parse(
      '  participant Alice',
      '  participant Bob',
      '  Bob->>Alice: Hi Alice',
      '  Alice->>Bob: Hi Bob'
    )

    expect(participants.map((p) => p.id)).toEqual(['Alice', 'Bob'])
  })

  it('creates participants implicitly in order of appearance', () => {
    const { participants } = parse('  Bob->>Alice: Hi Alice')

    expect(participants.map((p) => p.id)).toEqual(['Bob', 'Alice'])
    expect(participants.map((p) => p.index)).toEqual([0, 1])
  })

  it('marks actors declared with the actor keyword', () => {
    const { participants } = parse('  actor Alice', '  participant Bob')

    expect(participants[0].type).toBe('actor')
    expect(participants[1].type).toBe('participant')
  })

  it.each([
    'boundary',
    'control',
    'entity',
    'database',
    'collections',
    'queue',
  ])('reads the %s stereotype from the @{} config', (type) => {
    const { participants } = parse(`  participant Alice@{ "type" : "${type}" }`)

    expect(participants[0]).toMatchObject({ id: 'Alice', type })
  })
})

describe('aliases', () => {
  it('uses the external `as` alias as the display name', () => {
    const { participants } = parse(
      '  participant A as Alice',
      '  participant J as John'
    )

    expect(participants.map((p) => [p.id, p.name])).toEqual([
      ['A', 'Alice'],
      ['J', 'John'],
    ])
  })

  it('combines a stereotype with an external alias', () => {
    const { participants } = parse(
      '  participant API@{ "type": "boundary" } as Public API',
      '  actor DB@{ "type": "database" } as User Database'
    )

    expect(participants).toMatchObject([
      { id: 'API', type: 'boundary', name: 'Public API' },
      { id: 'DB', type: 'database', name: 'User Database' },
    ])
  })

  it('supports the inline alias field', () => {
    const { participants } = parse(
      '  participant API@{ "type": "boundary", "alias": "Public API" }'
    )

    expect(participants[0]).toMatchObject({ id: 'API', name: 'Public API' })
  })

  it('lets the external alias win over the inline one', () => {
    const { participants } = parse(
      '  participant API@{ "type": "boundary", "alias": "Internal Name" } as External Name'
    )

    expect(participants[0].name).toBe('External Name')
  })

  it('keeps line breaks in aliased actor names', () => {
    const { participants } = parse('  participant Alice as Alice<br/>Johnson')

    expect(participants[0].name).toBe('Alice\nJohnson')
  })
})

describe('actor creation and destruction', () => {
  it('records the row a participant is created and destroyed at', () => {
    const { participants, messages } = parse(
      '  Alice->>Bob: Hello Bob, how are you ?',
      '  Bob->>Alice: Fine, thank you. And you?',
      '  create participant Carl',
      '  Alice->>Carl: Hi Carl!',
      '  create actor D as Donald',
      '  Carl->>D: Hi!',
      '  destroy Carl',
      '  Alice-xCarl: We are too many',
      '  destroy Bob',
      '  Bob->>Alice: I agree'
    )

    const carl = participants.find((p) => p.id === 'Carl')!
    const donald = participants.find((p) => p.id === 'D')!
    const bob = participants.find((p) => p.id === 'Bob')!

    expect(carl.createdAtRow).toBe(2)
    expect(carl.destroyedAtRow).toBe(4)
    expect(donald).toMatchObject({ type: 'actor', name: 'Donald' })
    expect(donald.createdAtRow).toBe(3)
    expect(bob.destroyedAtRow).toBe(5)
    expect(messages).toHaveLength(6)
  })
})

describe('grouping / box', () => {
  it('groups participants into boxes with colors and labels', () => {
    const { boxes, participants } = parse(
      '  box Purple Alice & John',
      '  participant A',
      '  participant J',
      '  end',
      '  box Another Group',
      '  participant B',
      '  participant C',
      '  end',
      '  A->>J: Hello John, how are you?'
    )

    expect(boxes).toMatchObject([
      { label: 'Alice & John', color: 'Purple', participants: ['A', 'J'] },
      { label: 'Another Group', color: undefined, participants: ['B', 'C'] },
    ])
    expect(participants.find((p) => p.id === 'A')!.boxId).toBe(boxes[0].id)
  })

  it.each([
    ['box rgb(33,66,99)', 'rgb(33,66,99)', ''],
    ['box rgba(33,66,99,0.5)', 'rgba(33,66,99,0.5)', ''],
    ['box hsl(10, 40%, 90%)', 'hsl(10, 40%, 90%)', ''],
    ['box hsla(10, 40%, 90%, 0.5)', 'hsla(10, 40%, 90%, 0.5)', ''],
    ['box transparent Aqua', 'transparent', 'Aqua'],
    ['box Group without description', undefined, 'Group without description'],
  ])('parses `%s`', (line, color, label) => {
    const { boxes } = parse(`  ${line}`, '  participant A', '  end')

    expect(boxes[0]).toMatchObject({ color, label })
  })
})

describe('messages', () => {
  it.each([
    ['->', 'solid', 'none'],
    ['-->', 'dashed', 'none'],
    ['->>', 'solid', 'filled'],
    ['-->>', 'dashed', 'filled'],
    ['<<->>', 'solid', 'bidirectional'],
    ['<<-->>', 'dashed', 'bidirectional'],
    ['-x', 'solid', 'cross'],
    ['--x', 'dashed', 'cross'],
    ['-)', 'solid', 'open'],
    ['--)', 'dashed', 'open'],
  ])('parses the `%s` arrow', (arrow, lineStyle, arrowType) => {
    const { messages } = parse(`  A${arrow}B: Hello`)

    expect(messages[0]).toMatchObject({
      from: 'A',
      to: 'B',
      label: 'Hello',
      lineStyle,
      arrowType,
    })
  })

  it.each([
    ['-|\\', 'solid', 'half', 'top', false],
    ['--|\\', 'dashed', 'half', 'top', false],
    ['-|/', 'solid', 'half', 'bottom', false],
    ['--|/', 'dashed', 'half', 'bottom', false],
    ['/|-', 'solid', 'half', 'top', true],
    ['/|--', 'dashed', 'half', 'top', true],
    ['\\-', 'solid', 'half', 'bottom', true],
    ['\\--', 'dashed', 'half', 'bottom', true],
    ['-\\', 'solid', 'stick', 'top', false],
    ['--\\', 'dashed', 'stick', 'top', false],
    ['-//', 'solid', 'stick', 'bottom', false],
    ['--//', 'dashed', 'stick', 'bottom', false],
    ['//-', 'solid', 'stick', 'top', true],
    ['//--', 'dashed', 'stick', 'top', true],
  ])(
    'parses the `%s` half arrow',
    (arrow, lineStyle, arrowType, half, reversed) => {
      const { messages } = parse(`  A${arrow}B: Hello`)

      expect(messages[0]).toMatchObject({ lineStyle, arrowType, half })
      expect(messages[0].reversed ?? false).toBe(reversed)
    }
  )

  it('keeps arrow-like text inside the label out of the arrow match', () => {
    const { messages } = parse('  A->>B: use the -> operator')

    expect(messages[0]).toMatchObject({
      from: 'A',
      to: 'B',
      label: 'use the -> operator',
      arrowType: 'filled',
    })
  })
})

describe('central connections', () => {
  it('parses `()` on either end of the arrow', () => {
    const { messages } = parse(
      '  participant Alice',
      '  participant John',
      '  Alice->>()John: Hello John',
      '  Alice()->>John: How are you?',
      '  John()->>()Alice: Great!'
    )

    expect(messages[0]).toMatchObject({
      from: 'Alice',
      to: 'John',
      centralTarget: true,
    })
    expect(messages[0].centralSource).toBeUndefined()
    expect(messages[1]).toMatchObject({ centralSource: true })
    expect(messages[2]).toMatchObject({
      centralSource: true,
      centralTarget: true,
    })
  })
})

describe('activations', () => {
  it('pairs dedicated activate/deactivate declarations', () => {
    const { activations } = parse(
      '  Alice->>John: Hello John, how are you?',
      '  activate John',
      '  John-->>Alice: Great!',
      '  deactivate John'
    )

    expect(activations).toEqual([
      { participant: 'John', startRow: 1, endRow: 1 },
    ])
  })

  it('supports the +/- shorthand', () => {
    const { messages, activations } = parse(
      '  Alice->>+John: Hello John, how are you?',
      '  John-->>-Alice: Great!'
    )

    expect(messages[0]).toMatchObject({ to: 'John', activates: true })
    expect(messages[1]).toMatchObject({ from: 'John', deactivates: true })
    expect(activations).toEqual([
      { participant: 'John', startRow: 0, endRow: 1 },
    ])
  })

  it('stacks activations for the same actor', () => {
    const { activations } = parse(
      '  Alice->>+John: Hello John, how are you?',
      '  Alice->>+John: John, can you hear me?',
      '  John-->>-Alice: Hi Alice, I can hear you!',
      '  John-->>-Alice: I feel great!'
    )

    expect(activations).toEqual([
      { participant: 'John', startRow: 0, endRow: 3 },
      { participant: 'John', startRow: 1, endRow: 2 },
    ])
  })
})

describe('notes', () => {
  it.each(['right of', 'left of', 'over'])(
    'parses a note %s a participant',
    (placement) => {
      const { notes } = parse(
        '  participant John',
        `  Note ${placement} John: Text in note`
      )

      expect(notes[0]).toMatchObject({
        placement,
        participants: ['John'],
        text: 'Text in note',
      })
    }
  )

  it('parses a note spanning two participants', () => {
    const { notes } = parse(
      '  Alice->John: Hello John, how are you?',
      '  Note over Alice,John: A typical interaction'
    )

    expect(notes[0]).toMatchObject({
      placement: 'over',
      participants: ['Alice', 'John'],
      rowIndex: 1,
    })
  })

  it('gives notes their own row so they never share one with a message', () => {
    const { messages, notes } = parse(
      '  Alice->>John: Hello',
      '  Note right of John: Rational thoughts!',
      '  John-->>Alice: Great!'
    )

    expect(messages.map((m) => m.rowIndex)).toEqual([0, 2])
    expect(notes[0].rowIndex).toBe(1)
  })
})

describe('line breaks', () => {
  it('turns <br/> into a real line break in messages and notes', () => {
    const { messages, notes } = parse(
      '  Alice->John: Hello John,<br/>how are you?',
      '  Note over Alice,John: A typical interaction<br/>But now in two lines'
    )

    expect(messages[0].label).toBe('Hello John,\nhow are you?')
    expect(notes[0].text).toBe('A typical interaction\nBut now in two lines')
  })
})

describe('loops', () => {
  it('captures the loop label and the rows it spans', () => {
    const { blocks } = parse(
      '  Alice->John: Hello John, how are you?',
      '  loop Every minute',
      '    John-->Alice: Great!',
      '  end'
    )

    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toMatchObject({
      type: 'loop',
      label: 'Every minute',
      startRow: 1,
      endRow: 1,
      depth: 0,
    })
  })
})

describe('alt / else / opt', () => {
  it('splits alt into its branches', () => {
    const { blocks } = parse(
      '  Alice->>Bob: Hello Bob, how are you?',
      '  alt is sick',
      '    Bob->>Alice: Not so good :(',
      '  else is well',
      '    Bob->>Alice: Feeling fresh like a daisy',
      '  end',
      '  opt Extra response',
      '    Bob->>Alice: Thanks for asking',
      '  end'
    )

    expect(blocks[0]).toMatchObject({ type: 'alt', label: 'is sick' })
    expect(blocks[0].sections).toEqual([
      { label: 'is sick', startRow: 1, endRow: 1 },
      { label: 'is well', startRow: 2, endRow: 2 },
    ])
    expect(blocks[1]).toMatchObject({
      type: 'opt',
      label: 'Extra response',
      startRow: 3,
      endRow: 3,
    })
  })
})

describe('parallel', () => {
  it('splits par into its and-branches, including nested par', () => {
    const { blocks } = parse(
      '  par Alice to Bob',
      '    Alice->>Bob: Hello guys!',
      '  and Alice to John',
      '    Alice->>John: Hello guys!',
      '  end',
      '  par Alice to Bob',
      '    Alice->>Bob: Go help John',
      '  and Bob to John',
      '    par Bob to John',
      '      Bob->>John: I want this done today',
      '    and Bob to Alice',
      '      Bob->>Alice: I want this done today',
      '    end',
      '  end'
    )

    expect(blocks[0].sections).toEqual([
      { label: 'Alice to Bob', startRow: 0, endRow: 0 },
      { label: 'Alice to John', startRow: 1, endRow: 1 },
    ])
    expect(blocks[2]).toMatchObject({
      type: 'par',
      depth: 1,
      parentId: blocks[1].id,
    })
  })
})

describe('critical region', () => {
  it('parses critical with its option branches', () => {
    const { blocks } = parse(
      '  critical Establish a connection to the DB',
      '    Service-->DB: connect',
      '  option Network timeout',
      '    Service-->Service: Log error',
      '  option Credentials rejected',
      '    Service-->Service: Log different error',
      '  end'
    )

    expect(blocks[0]).toMatchObject({
      type: 'critical',
      label: 'Establish a connection to the DB',
    })
    expect(blocks[0].sections.map((s) => s.label)).toEqual([
      'Establish a connection to the DB',
      'Network timeout',
      'Credentials rejected',
    ])
  })
})

describe('break', () => {
  it('parses a break block', () => {
    const { blocks } = parse(
      '  Consumer-->API: Book something',
      '  break when the booking process fails',
      '    API-->Consumer: show failure',
      '  end'
    )

    expect(blocks[0]).toMatchObject({
      type: 'break',
      label: 'when the booking process fails',
      startRow: 1,
      endRow: 1,
    })
  })
})

describe('background highlighting', () => {
  it.each([
    ['rect rgb(0, 255, 0)', 'rgb(0, 255, 0)'],
    ['rect rgba(0, 0, 255, .1)', 'rgba(0, 0, 255, .1)'],
  ])('parses `%s`', (line, color) => {
    const { blocks } = parse(
      '  Alice->>John: Hello John, how are you?',
      `  ${line}`,
      '    John->>Alice: Great!',
      '  end'
    )

    expect(blocks[0]).toMatchObject({ type: 'rect', color, startRow: 1 })
  })

  it('nests rect inside other blocks', () => {
    const { blocks } = parse(
      '  rect rgb(191, 223, 255)',
      '    loop Healthcheck',
      '      John->>John: Fight against hypochondria',
      '    end',
      '  end'
    )

    expect(blocks[0]).toMatchObject({ type: 'rect', depth: 0 })
    expect(blocks[1]).toMatchObject({
      type: 'loop',
      depth: 1,
      parentId: blocks[0].id,
    })
  })
})

describe('comments', () => {
  it('ignores %% comment lines and trailing comments', () => {
    const { messages } = parse(
      '  %% this is a comment',
      '  Alice->>John: Hello John %% trailing',
      '  %%{init: {"theme": "dark"} }%%'
    )

    expect(messages).toHaveLength(1)
    expect(messages[0].label).toBe('Hello John')
  })
})

describe('entity codes', () => {
  it('decodes numeric and named entity codes', () => {
    const { messages } = parse(
      '  A->>B: I am &#35; and &#59; and &amp; and &#9731;'
    )

    expect(messages[0].label).toBe('I am # and ; and & and ☃')
  })
})

describe('sequence numbers', () => {
  it('numbers every arrow after `autonumber`', () => {
    const { messages, autonumber } = parse(
      '  autonumber',
      '  Alice->>John: Hello John, how are you?',
      '  loop HealthCheck',
      '    John->>John: Fight against hypochondria',
      '  end',
      '  Note right of John: Rational thoughts!',
      '  John-->>Alice: Great!',
      '  John->>Bob: How about you?',
      '  Bob-->>John: Jolly good!'
    )

    expect(autonumber).toEqual({ start: 1, step: 1 })
    expect(messages.map((m) => m.sequenceNumber)).toEqual([1, 2, 3, 4, 5])
  })

  it('honours a start and increment value', () => {
    const { messages, autonumber } = parse(
      '  autonumber 10 5',
      '  A->>B: one',
      '  B->>A: two',
      '  A->>B: three'
    )

    expect(autonumber).toEqual({ start: 10, step: 5 })
    expect(messages.map((m) => m.sequenceNumber)).toEqual([10, 15, 20])
  })

  it('supports decimal start and increment values', () => {
    const { messages } = parse(
      '  autonumber 1.5 0.25',
      '  A->>B: one',
      '  B->>A: two'
    )

    expect(messages.map((m) => m.sequenceNumber)).toEqual([1.5, 1.75])
  })

  it('stops numbering after `autonumber off`', () => {
    const { messages, autonumber } = parse(
      '  autonumber',
      '  A->>B: numbered',
      '  autonumber off',
      '  B->>A: not numbered'
    )

    expect(messages[0].sequenceNumber).toBe(1)
    expect(messages[1].sequenceNumber).toBeUndefined()
    expect(autonumber).toBeUndefined()
  })
})

describe('actor menus', () => {
  it('parses `link <actor>: <label> @ <url>`', () => {
    const { participants } = parse(
      '  participant Alice',
      '  link Alice: Dashboard @ https://dashboard.contoso.com/alice',
      '  link Alice: Wiki @ https://wiki.contoso.com/alice'
    )

    expect(participants[0].links).toEqual([
      { label: 'Dashboard', url: 'https://dashboard.contoso.com/alice' },
      { label: 'Wiki', url: 'https://wiki.contoso.com/alice' },
    ])
  })

  it('parses the JSON `links` form', () => {
    const { participants } = parse(
      '  participant Alice',
      '  links Alice: {"Dashboard": "https://dashboard.contoso.com/alice", "Wiki": "https://wiki.contoso.com/alice"}'
    )

    expect(participants[0].links).toEqual([
      { label: 'Dashboard', url: 'https://dashboard.contoso.com/alice' },
      { label: 'Wiki', url: 'https://wiki.contoso.com/alice' },
    ])
  })
})

describe('title and accessibility', () => {
  it('parses a title', () => {
    expect(parse('  title: My title', '  A->>B: hi').title).toBe('My title')
    expect(parse('  title My title', '  A->>B: hi').title).toBe('My title')
  })

  it('parses accTitle and single-line accDescr', () => {
    const result = parse(
      '  accTitle: My accessible title',
      '  accDescr: My accessible description',
      '  A->>B: hi'
    )

    expect(result.accTitle).toBe('My accessible title')
    expect(result.accDescr).toBe('My accessible description')
  })

  it('parses a multi-line accDescr block', () => {
    const result = parse(
      '  accDescr {',
      '    My accessible description',
      '    over two lines',
      '  }',
      '  A->>B: hi'
    )

    expect(result.accDescr).toBe('My accessible description\nover two lines')
    expect(result.messages).toHaveLength(1)
  })
})

describe('the documentation overview example', () => {
  it('parses every construct in one diagram', () => {
    const result = parse(
      '  autonumber',
      '  actor Alice',
      '  participant John',
      '  Alice->>John: Hello John, how are you?',
      '  loop HealthCheck',
      '    John->>John: Fight against hypochondria',
      '  end',
      '  Note right of John: Rational thoughts!',
      '  John-->>Alice: Great!',
      '  John->>Bob: How about you?',
      '  Bob-->>John: Jolly good!'
    )

    expect(result.participants.map((p) => p.id)).toEqual([
      'Alice',
      'John',
      'Bob',
    ])
    expect(result.participants[0].type).toBe('actor')
    expect(result.messages.map((m) => m.sequenceNumber)).toEqual([
      1, 2, 3, 4, 5,
    ])
    expect(result.blocks[0]).toMatchObject({
      type: 'loop',
      label: 'HealthCheck',
      startRow: 1,
      endRow: 1,
    })
    expect(result.notes[0]).toMatchObject({
      placement: 'right of',
      participants: ['John'],
      text: 'Rational thoughts!',
      rowIndex: 2,
    })
    expect(result.messages.map((m) => m.rowIndex)).toEqual([0, 1, 3, 4, 5])
  })
})

describe('rendering the parsed diagram', () => {
  function render(...lines: string[]) {
    const { nodes, edges } = convertSequenceDiagramToReactFlow(
      ['sequenceDiagram', ...lines].join('\n')
    )
    return {
      nodes,
      edges,
      node: (id: string) => nodes.find((n) => n.id === id),
      label: (id: string) =>
        (nodes.find((n) => n.id === id)?.data as NodeData | undefined)
          ?.componentFields?.[0]?.data?.[0]?.value,
    }
  }

  it('emits a lifeline node per participant, spaced by the column width', () => {
    const { node } = render('  Alice->>Bob: Hi')

    expect(node('participant-Alice')!.position.x).toBe(
      SEQUENCE_LAYOUT.COLUMN_WIDTH / 2 -
        SEQUENCE_LAYOUT.PARTICIPANT_NODE_WIDTH / 2
    )
    expect(
      node('participant-Bob')!.position.x -
        node('participant-Alice')!.position.x
    ).toBe(SEQUENCE_LAYOUT.COLUMN_WIDTH)
  })

  it('gives every participant the same explicit row geometry', () => {
    const { node } = render(
      '  Alice->>Bob: Hi',
      '  loop every minute',
      '    Bob->>Alice: Still here',
      '  end'
    )

    const alice = node('participant-Alice')!.data as ParticipantData
    const bob = node('participant-Bob')!.data as ParticipantData

    expect(alice.rowYs).toEqual(bob.rowYs)
    expect(alice.rowYs).toHaveLength(2)
    expect(alice.lifelineHeight).toBe(bob.lifelineHeight)
    // The loop's label needs room above its first row, so the rows are no
    // longer a uniform `row * rowHeight` grid.
    expect(alice.rowYs![1] - alice.rowYs![0]).toBeGreaterThan(alice.rowHeight!)
  })

  it('renders a note as its own node on its own row', () => {
    const { node, label } = render(
      '  Alice->>Bob: Hi',
      '  Note right of Bob: he waves back'
    )

    expect(label('note-1')).toBe('he waves back')
    expect(node('note-1')!.position.y).toBeGreaterThan(
      node('message-0')!.position.y
    )
    expect(node('note-1')!.position.x).toBeGreaterThan(
      node('participant-Bob')!.position.x
    )
  })

  it('spans a note over two participants', () => {
    const { node } = render('  Note over Alice,Bob: shared context')

    const note = node('note-0')!
    const alice = node('participant-Alice')!.position.x
    const bob = node('participant-Bob')!.position.x

    expect(note.position.x).toBeLessThan(alice)
    expect(note.position.x + note.width!).toBeGreaterThan(bob)
  })

  it('frames a block around the rows and boxes it contains', () => {
    const { node } = render(
      '  Alice->>Bob: Hi',
      '  loop HealthCheck',
      '    Bob->>Bob: Fight against hypochondria',
      '  end',
      '  Bob->>Alice: Bye'
    )

    const frame = node('sequence-block-block-0')!
    const inside = node('message-1')!
    const before = node('message-0')!
    const after = node('message-2')!

    expect(frame.type).toBe('group')
    expect((frame.data as BlockData).sequenceBlock).toMatchObject({
      type: 'loop',
      label: 'HealthCheck',
    })
    // The self-message box hangs beside its own lifeline; the frame still has
    // to contain it horizontally as well as vertically.
    expect(frame.position.x).toBeLessThan(inside.position.x)
    expect(frame.position.x + frame.width!).toBeGreaterThan(
      inside.position.x + inside.width!
    )
    expect(frame.position.y).toBeLessThan(inside.position.y)
    expect(frame.position.y + frame.height!).toBeGreaterThan(
      inside.position.y + inside.height!
    )
    expect(frame.position.y).toBeGreaterThan(before.position.y + before.height!)
    expect(frame.position.y + frame.height!).toBeLessThan(after.position.y)
  })

  it('nests an inner block frame above its parent', () => {
    const { node } = render(
      '  loop outer',
      '    par inner',
      '      Alice->>Bob: Hi',
      '    end',
      '  end'
    )

    const outer = node('sequence-block-block-0')!
    const inner = node('sequence-block-block-1')!

    expect(outer.zIndex!).toBeLessThan(inner.zIndex!)
    expect(outer.position.y).toBeLessThan(inner.position.y)
    expect(outer.position.x).toBeLessThan(inner.position.x)
    expect(outer.position.x + outer.width!).toBeGreaterThan(
      inner.position.x + inner.width!
    )
    expect(outer.position.y + outer.height!).toBeGreaterThan(
      inner.position.y + inner.height!
    )
  })

  it('records alt sections on the frame so else branches can be drawn', () => {
    const { node } = render(
      '  alt is sick',
      '    Bob->>Alice: Not so good',
      '  else is well',
      '    Bob->>Alice: Feeling fresh',
      '  end'
    )

    expect(
      (node('sequence-block-block-0')!.data as BlockData).sequenceBlock
    ).toMatchObject({
      type: 'alt',
      sections: [
        { label: 'is sick', startRow: 0, endRow: 0 },
        { label: 'is well', startRow: 1, endRow: 1 },
      ],
    })
  })

  it('renders a box as a group behind its participants', () => {
    const { node, label } = render(
      '  box Purple Alice & John',
      '    participant Alice',
      '    participant John',
      '  end',
      '  Alice->>John: Hi',
      '  participant Bob'
    )

    const box = node('sequence-box-box-0')!

    expect(label('sequence-box-box-0')).toBe('Alice & John')
    expect(box.zIndex!).toBeLessThan(
      node('sequence-block-block-0')?.zIndex ?? 0
    )
    expect(box.position.x).toBeLessThan(node('participant-Alice')!.position.x)
    expect(box.position.x + box.width!).toBeGreaterThan(
      node('participant-John')!.position.x
    )
    expect(box.position.x + box.width!).toBeLessThan(
      node('participant-Bob')!.position.x
    )
  })

  it('hands activation bars to the lifeline as layout rows', () => {
    const { node } = render('  Alice->>+John: Hello', '  John-->>-Alice: Hi')

    expect(
      (node('participant-John')!.data as ParticipantData).activations
    ).toEqual([{ startRow: 0, endRow: 1 }])
    expect(
      (node('participant-Alice')!.data as ParticipantData).activations
    ).toEqual([])
  })

  it('clips a created and destroyed lifeline to the rows it exists for', () => {
    const { node } = render(
      '  Alice->>Bob: Hello',
      '  create participant Carl',
      '  Alice->>Carl: Hi Carl',
      '  destroy Carl',
      '  Carl->>Alice: Bye'
    )

    const carl = node('participant-Carl')!.data as ParticipantData

    expect(carl.lifelineStartRow).toBe(1)
    expect(carl.lifelineEndRow).toBe(2)
    expect(
      (node('participant-Alice')!.data as ParticipantData).lifelineStartRow
    ).toBeUndefined()
  })

  it('puts the autonumber on the message node', () => {
    const { nodes, node } = render(
      '  autonumber 10 5',
      '  Alice->>Bob: One',
      '  Bob->>Alice: Two'
    )

    expect((node('message-0')!.data as MessageData).sequenceNumber).toBe(10)
    expect((node('message-1')!.data as MessageData).sequenceNumber).toBe(15)
    expect(
      nodes.every(
        (n) =>
          !n.id.startsWith('note-') ||
          (n.data as MessageData).sequenceNumber === undefined
      )
    ).toBe(true)
  })

  it('leaves messages unnumbered without autonumber', () => {
    const { node } = render('  Alice->>Bob: One')

    expect((node('message-0')!.data as MessageData).sequenceNumber).toBe(
      undefined
    )
  })

  it('renders a title as a text node', () => {
    const { node, label } = render('  title Checkout', '  Alice->>Bob: Hi')

    expect(node('sequence-title')!.type).toBe('text')
    expect(label('sequence-title')).toBe('Checkout')
  })

  it('routes a self-message through two rows', () => {
    const { edges } = render('  Alice->>Alice: Think', '  Alice->>Bob: Speak')

    expect(edges.find((e) => e.id === 'edge-0-a')!.sourceHandle).toBe(
      'row-0-right-source'
    )
    expect(edges.find((e) => e.id === 'edge-0-b')!.targetHandle).toBe(
      'row-1-right-target'
    )
    expect(edges.find((e) => e.id === 'edge-1-a')!.sourceHandle).toBe(
      'row-2-right-source'
    )
  })

  it('draws dotted lines and arrow heads from the message token', () => {
    const { edges } = render(
      '  Alice-->>Bob: dotted',
      '  Alice-)Bob: async',
      '  Alice<<->>Bob: both ways',
      '  Alice->Bob: no head'
    )

    function edge(id: string) {
      return edges.find((e) => e.id === id)!
    }

    expect(edge('edge-0-b').style!.strokeDasharray).toBe('4 4')
    expect(edge('edge-1-b').style!.strokeDasharray).toBe(undefined)
    expect(edge('edge-1-b').markerEnd).toMatchObject({ type: 'arrow' })
    expect(edge('edge-0-b').markerEnd).toMatchObject({ type: 'arrowclosed' })
    expect(edge('edge-2-b').markerStart).toMatchObject({ type: 'arrowclosed' })
    expect(edge('edge-2-b').markerEnd).toMatchObject({ type: 'arrowclosed' })
    expect(edge('edge-3-b').markerEnd).toBe(undefined)
  })

  it('routes a right-to-left message from the left side of its sender', () => {
    const { edges } = render(
      '  participant Alice',
      '  participant Bob',
      '  Bob->>Alice: back'
    )

    expect(edges.find((e) => e.id === 'edge-0-a')!.sourceHandle).toBe(
      'row-0-left-source'
    )
    expect(edges.find((e) => e.id === 'edge-0-b')!.targetHandle).toBe(
      'row-0-right-target'
    )
  })

  it('sizes rows from the tallest box on any of them', () => {
    const short = render('  Alice->>Bob: Hi')
    const long = render(
      '  Alice->>Bob: Hi',
      '  Bob->>Alice: A considerably longer reply that has to wrap onto several lines'
    )

    const shortRow = (short.node('participant-Alice')!.data as ParticipantData)
      .rowHeight!
    const longRow = (long.node('participant-Alice')!.data as ParticipantData)
      .rowHeight!

    expect(longRow).toBeGreaterThan(shortRow)
    expect(long.node('message-1')!.height!).toBeGreaterThan(
      long.node('message-0')!.height!
    )
  })
})
