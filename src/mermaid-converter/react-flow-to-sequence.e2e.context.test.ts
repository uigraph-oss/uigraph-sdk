import { describe, expect, test } from 'vitest'
import { ComponentInputType } from '../components/component-type'
import { contextSchema } from './context/context-schema'
import { convertMermaidToReactFlowWithContext } from './context/convert-with-context'
import { convertMermaidToReactFlow } from './mermaid-to-react-flow'
import { isSequenceDiagram } from './react-flow-to-sequence'

describe('generated node ids', () => {
  test('a participant node is keyed by its mermaid identifier', async () => {
    const { nodes } = await convertMermaidToReactFlowWithContext(
      `sequenceDiagram
  participant U as User
  U->>U: ping`,
      {},
      { repositionNodes: true }
    )

    expect(nodes.some((node) => node.id === 'participant-U')).toBe(true)
    expect(nodes.some((node) => node.id === 'participant-User')).toBe(false)
  })

  test('an @{ alias } participant is still keyed by its identifier', async () => {
    const { nodes } = await convertMermaidToReactFlowWithContext(
      `sequenceDiagram
  participant DB@{ "type": "database", "alias": "Orders DB" }
  DB->>DB: ping`,
      {},
      { repositionNodes: true }
    )

    expect(nodes.some((node) => node.id === 'participant-DB')).toBe(true)
    expect(nodes.some((node) => node.id === 'participant-Orders DB')).toBe(
      false
    )
  })

  test('an actor gets the same participant- prefix as a participant', async () => {
    const { nodes } = await convertMermaidToReactFlowWithContext(
      `sequenceDiagram
  actor Ops
  Ops->>Ops: ping`,
      {},
      { repositionNodes: true }
    )

    const ops = nodes.find((node) => node.id === 'participant-Ops')

    expect(ops?.type).toBe('sequenceParticipant')
  })

  test('a message box is keyed by its row index', async () => {
    const { nodes } = await convertMermaidToReactFlowWithContext(
      `sequenceDiagram
  participant A
  participant B
  A->>B: first
  B->>A: second`,
      {},
      { repositionNodes: true }
    )

    expect(nodes.some((node) => node.id === 'message-0')).toBe(true)
    expect(nodes.some((node) => node.id === 'message-1')).toBe(true)
    expect(nodes.find((node) => node.id === 'message-0')?.type).toBe('shape')
  })

  test('a note box is keyed by its row index', async () => {
    const { nodes } = await convertMermaidToReactFlowWithContext(
      `sequenceDiagram
  participant A
  Note right of A: hello`,
      {},
      { repositionNodes: true }
    )

    expect(nodes.some((node) => node.id === 'note-0')).toBe(true)
    expect(nodes.find((node) => node.id === 'note-0')?.type).toBe('shape')
  })

  test('a note between two messages consumes a row number', async () => {
    const { nodes } = await convertMermaidToReactFlowWithContext(
      `sequenceDiagram
  participant A
  participant B
  A->>B: first
  Note right of A: middle
  B->>A: second`,
      {},
      { repositionNodes: true }
    )

    expect(nodes.some((node) => node.id === 'message-0')).toBe(true)
    expect(nodes.some((node) => node.id === 'note-1')).toBe(true)
    expect(nodes.some((node) => node.id === 'message-2')).toBe(true)
    expect(nodes.some((node) => node.id === 'message-1')).toBe(false)
  })

  test('a loop frame becomes a sequence-block group', async () => {
    const { nodes } = await convertMermaidToReactFlowWithContext(
      `sequenceDiagram
  participant A
  participant B
  loop retry
    A->>B: hi
  end`,
      {},
      { repositionNodes: true }
    )

    const block = nodes.find((node) => node.id === 'sequence-block-block-0')

    expect(block?.type).toBe('group')
  })

  test('an alt frame becomes a sequence-block group', async () => {
    const { nodes } = await convertMermaidToReactFlowWithContext(
      `sequenceDiagram
  participant A
  participant B
  alt happy
    A->>B: yes
  else sad
    A->>B: no
  end`,
      {},
      { repositionNodes: true }
    )

    const block = nodes.find((node) => node.id === 'sequence-block-block-0')

    expect(block?.type).toBe('group')
  })

  test('a box band becomes a sequence-box group', async () => {
    const { nodes } = await convertMermaidToReactFlowWithContext(
      `sequenceDiagram
  box transparent Frontend
    participant A
    participant B
  end
  A->>B: hi`,
      {},
      { repositionNodes: true }
    )

    const band = nodes.find((node) => node.id === 'sequence-box-box-0')

    expect(band?.type).toBe('group')
  })

  test('a title becomes the sequence-title text node', async () => {
    const { nodes } = await convertMermaidToReactFlowWithContext(
      `sequenceDiagram
  title: My Flow
  participant A
  A->>A: ping`,
      {},
      { repositionNodes: true }
    )

    const title = nodes.find((node) => node.id === 'sequence-title')

    expect(title?.type).toBe('text')
  })

  test('undeclared participants are created in first-use order', async () => {
    const { nodes } = await convertMermaidToReactFlowWithContext(
      `sequenceDiagram
  Zeta->>Alpha: first
  Alpha->>Mid: second`,
      {},
      { repositionNodes: true }
    )

    expect(
      nodes
        .filter((node) => node.type === 'sequenceParticipant')
        .sort((a, b) => a.position.x - b.position.x)
        .map((node) => node.id)
    ).toStrictEqual([
      'participant-Zeta',
      'participant-Alpha',
      'participant-Mid',
    ])
  })

  test('declared participants keep their declaration order', async () => {
    const { nodes } = await convertMermaidToReactFlowWithContext(
      `sequenceDiagram
  participant Mid
  participant Alpha
  participant Zeta
  Zeta->>Alpha: first`,
      {},
      { repositionNodes: true }
    )

    expect(
      nodes
        .filter((node) => node.type === 'sequenceParticipant')
        .sort((a, b) => a.position.x - b.position.x)
        .map((node) => node.id)
    ).toStrictEqual([
      'participant-Mid',
      'participant-Alpha',
      'participant-Zeta',
    ])
  })
})

describe('generated edges', () => {
  test('one message produces an a edge and a b edge through its box', async () => {
    const { edges } = await convertMermaidToReactFlowWithContext(
      `sequenceDiagram
  participant A
  participant B
  A->>B: hi`,
      {},
      { repositionNodes: true }
    )

    expect(
      edges.map((edge) => [edge.id, edge.source, edge.target])
    ).toStrictEqual([
      ['edge-0-a', 'participant-A', 'message-0'],
      ['edge-0-b', 'message-0', 'participant-B'],
    ])
  })

  test('a left-to-right message leaves the right side and arrives on the left', async () => {
    const { edges } = await convertMermaidToReactFlowWithContext(
      `sequenceDiagram
  participant A
  participant B
  A->>B: hi`,
      {},
      { repositionNodes: true }
    )

    expect(edges.find((edge) => edge.id === 'edge-0-a')?.sourceHandle).toBe(
      'row-0-right-source'
    )
    expect(edges.find((edge) => edge.id === 'edge-0-a')?.targetHandle).toBe(
      'target-left'
    )
    expect(edges.find((edge) => edge.id === 'edge-0-b')?.sourceHandle).toBe(
      'source-right'
    )
    expect(edges.find((edge) => edge.id === 'edge-0-b')?.targetHandle).toBe(
      'row-0-left-target'
    )
  })

  test('a right-to-left message flips both sides', async () => {
    const { edges } = await convertMermaidToReactFlowWithContext(
      `sequenceDiagram
  participant A
  participant B
  B->>A: hi`,
      {},
      { repositionNodes: true }
    )

    expect(edges.find((edge) => edge.id === 'edge-0-a')?.sourceHandle).toBe(
      'row-0-left-source'
    )
    expect(edges.find((edge) => edge.id === 'edge-0-a')?.targetHandle).toBe(
      'target-right'
    )
    expect(edges.find((edge) => edge.id === 'edge-0-b')?.sourceHandle).toBe(
      'source-left'
    )
    expect(edges.find((edge) => edge.id === 'edge-0-b')?.targetHandle).toBe(
      'row-0-right-target'
    )
  })

  test('a self message uses the top and bottom box handles', async () => {
    const { edges } = await convertMermaidToReactFlowWithContext(
      `sequenceDiagram
  participant A
  A->>A: think`,
      {},
      { repositionNodes: true }
    )

    expect(edges.find((edge) => edge.id === 'edge-0-a')?.targetHandle).toBe(
      'target-top'
    )
    expect(edges.find((edge) => edge.id === 'edge-0-b')?.sourceHandle).toBe(
      'source-bottom'
    )
  })

  test('a self message returns one row below the row it left', async () => {
    const { edges } = await convertMermaidToReactFlowWithContext(
      `sequenceDiagram
  participant A
  A->>A: think`,
      {},
      { repositionNodes: true }
    )

    expect(edges.find((edge) => edge.id === 'edge-0-a')?.sourceHandle).toBe(
      'row-0-right-source'
    )
    expect(edges.find((edge) => edge.id === 'edge-0-b')?.targetHandle).toBe(
      'row-1-right-target'
    )
  })

  test('a note consumes a row so the next message edge id skips it', async () => {
    const { edges } = await convertMermaidToReactFlowWithContext(
      `sequenceDiagram
  participant A
  participant B
  A->>B: first
  Note right of A: middle
  B->>A: second`,
      {},
      { repositionNodes: true }
    )

    expect(edges.map((edge) => edge.id)).toStrictEqual([
      'edge-0-a',
      'edge-0-b',
      'edge-2-a',
      'edge-2-b',
    ])
  })
})

describe('participant colour from context', () => {
  test('style.color lands on data.color', async () => {
    const { nodes } = await convertMermaidToReactFlowWithContext(
      `sequenceDiagram
  participant U as User
  U->>U: ping`,
      { nodes: { 'participant-U': { style: { color: '#38bdf8' } } } },
      { repositionNodes: true }
    )

    expect(nodes.find((node) => node.id === 'participant-U')?.data.color).toBe(
      '#38bdf8'
    )
  })

  test('no context leaves data.color undefined so the UI default applies', async () => {
    const { nodes } = await convertMermaidToReactFlowWithContext(
      `sequenceDiagram
  participant U as User
  U->>U: ping`,
      {},
      { repositionNodes: true }
    )

    expect(
      nodes.find((node) => node.id === 'participant-U')?.data.color
    ).toBeUndefined()
  })

  test('an empty style block leaves data.color undefined', async () => {
    const { nodes } = await convertMermaidToReactFlowWithContext(
      `sequenceDiagram
  participant U as User
  U->>U: ping`,
      { nodes: { 'participant-U': { style: {} } } },
      { repositionNodes: true }
    )

    expect(
      nodes.find((node) => node.id === 'participant-U')?.data.color
    ).toBeUndefined()
  })

  test('only the named participant is coloured', async () => {
    const { nodes } = await convertMermaidToReactFlowWithContext(
      `sequenceDiagram
  participant Alice
  participant John
  Alice->>John: hi`,
      { nodes: { 'participant-Alice': { style: { color: '#FFF000' } } } },
      { repositionNodes: true }
    )

    expect(
      nodes.find((node) => node.id === 'participant-Alice')?.data.color
    ).toBe('#FFF000')
    expect(
      nodes.find((node) => node.id === 'participant-John')?.data.color
    ).toBeUndefined()
  })

  test('several participants can be coloured at once', async () => {
    const { nodes } = await convertMermaidToReactFlowWithContext(
      `sequenceDiagram
  participant Alice
  participant John
  Alice->>John: hi`,
      {
        nodes: {
          'participant-Alice': { style: { color: '#FFF000' } },
          'participant-John': { style: { color: '#38bdf8' } },
        },
      },
      { repositionNodes: true }
    )

    expect(
      nodes.find((node) => node.id === 'participant-Alice')?.data.color
    ).toBe('#FFF000')
    expect(
      nodes.find((node) => node.id === 'participant-John')?.data.color
    ).toBe('#38bdf8')
  })

  test('a participant created mid-diagram takes colour like any other', async () => {
    const { nodes } = await convertMermaidToReactFlowWithContext(
      `sequenceDiagram
  participant A
  A->>A: warm up
  create participant Carl
  A->>Carl: spawn`,
      { nodes: { 'participant-Carl': { style: { color: '#f59e0b' } } } },
      { repositionNodes: true }
    )

    expect(
      nodes.find((node) => node.id === 'participant-Carl')?.data.color
    ).toBe('#f59e0b')
  })

  test('an actor takes colour like a participant', async () => {
    const { nodes } = await convertMermaidToReactFlowWithContext(
      `sequenceDiagram
  actor Ops
  Ops->>Ops: page`,
      { nodes: { 'participant-Ops': { style: { color: '#22c55e' } } } },
      { repositionNodes: true }
    )

    expect(
      nodes.find((node) => node.id === 'participant-Ops')?.data.color
    ).toBe('#22c55e')
  })

  test('colour is copied verbatim, not normalised', async () => {
    const { nodes } = await convertMermaidToReactFlowWithContext(
      `sequenceDiagram
  participant U
  U->>U: ping`,
      { nodes: { 'participant-U': { style: { color: 'rebeccapurple' } } } },
      { repositionNodes: true }
    )

    expect(nodes.find((node) => node.id === 'participant-U')?.data.color).toBe(
      'rebeccapurple'
    )
  })
})

describe('every other participant style key', () => {
  test('style.fill lands on data.fill', async () => {
    const { nodes } = await convertMermaidToReactFlowWithContext(
      `sequenceDiagram
  participant U
  U->>U: ping`,
      { nodes: { 'participant-U': { style: { fill: '#111827' } } } },
      { repositionNodes: true }
    )

    expect(nodes.find((node) => node.id === 'participant-U')?.data.fill).toBe(
      '#111827'
    )
  })

  test('style.stroke lands on data.stroke', async () => {
    const { nodes } = await convertMermaidToReactFlowWithContext(
      `sequenceDiagram
  participant U
  U->>U: ping`,
      { nodes: { 'participant-U': { style: { stroke: '#475569' } } } },
      { repositionNodes: true }
    )

    expect(nodes.find((node) => node.id === 'participant-U')?.data.stroke).toBe(
      '#475569'
    )
  })

  test('style.strokeWidth lands on data.strokeWidth', async () => {
    const { nodes } = await convertMermaidToReactFlowWithContext(
      `sequenceDiagram
  participant U
  U->>U: ping`,
      { nodes: { 'participant-U': { style: { strokeWidth: 3 } } } },
      { repositionNodes: true }
    )

    expect(
      nodes.find((node) => node.id === 'participant-U')?.data
    ).toMatchObject({ strokeWidth: 3 })
  })

  test('style.borderRadius lands on data.borderRadius', async () => {
    const { nodes } = await convertMermaidToReactFlowWithContext(
      `sequenceDiagram
  participant U
  U->>U: ping`,
      { nodes: { 'participant-U': { style: { borderRadius: 8 } } } },
      { repositionNodes: true }
    )

    expect(
      nodes.find((node) => node.id === 'participant-U')?.data
    ).toMatchObject({ borderRadius: 8 })
  })

  test('style.strokeStyle dashed lands on data.strokeStyle', async () => {
    const { nodes } = await convertMermaidToReactFlowWithContext(
      `sequenceDiagram
  participant U
  U->>U: ping`,
      { nodes: { 'participant-U': { style: { strokeStyle: 'dashed' } } } },
      { repositionNodes: true }
    )

    expect(
      nodes.find((node) => node.id === 'participant-U')?.data
    ).toMatchObject({ strokeStyle: 'dashed' })
  })

  test('style.strokeStyle dotted lands on data.strokeStyle', async () => {
    const { nodes } = await convertMermaidToReactFlowWithContext(
      `sequenceDiagram
  participant U
  U->>U: ping`,
      { nodes: { 'participant-U': { style: { strokeStyle: 'dotted' } } } },
      { repositionNodes: true }
    )

    expect(
      nodes.find((node) => node.id === 'participant-U')?.data
    ).toMatchObject({ strokeStyle: 'dotted' })
  })

  test('style.strokeStyle solid lands on data.strokeStyle', async () => {
    const { nodes } = await convertMermaidToReactFlowWithContext(
      `sequenceDiagram
  participant U
  U->>U: ping`,
      { nodes: { 'participant-U': { style: { strokeStyle: 'solid' } } } },
      { repositionNodes: true }
    )

    expect(
      nodes.find((node) => node.id === 'participant-U')?.data
    ).toMatchObject({ strokeStyle: 'solid' })
  })

  test('borderAnimationEnabled true sets strokeAnimation to dash', async () => {
    const { nodes } = await convertMermaidToReactFlowWithContext(
      `sequenceDiagram
  participant U
  U->>U: ping`,
      {
        nodes: {
          'participant-U': { style: { borderAnimationEnabled: true } },
        },
      },
      { repositionNodes: true }
    )

    expect(
      nodes.find((node) => node.id === 'participant-U')?.data.strokeAnimation
    ).toBe('dash')
  })

  test('borderAnimationEnabled false leaves strokeAnimation undefined', async () => {
    const { nodes } = await convertMermaidToReactFlowWithContext(
      `sequenceDiagram
  participant U
  U->>U: ping`,
      {
        nodes: {
          'participant-U': { style: { borderAnimationEnabled: false } },
        },
      },
      { repositionNodes: true }
    )

    expect(
      nodes.find((node) => node.id === 'participant-U')?.data.strokeAnimation
    ).toBeUndefined()
  })

  test('style.width sets the node width', async () => {
    const { nodes } = await convertMermaidToReactFlowWithContext(
      `sequenceDiagram
  participant U
  U->>U: ping`,
      { nodes: { 'participant-U': { style: { width: 240 } } } },
      { repositionNodes: true }
    )

    expect(nodes.find((node) => node.id === 'participant-U')?.width).toBe(240)
  })

  test('style.height sets the node height', async () => {
    const { nodes } = await convertMermaidToReactFlowWithContext(
      `sequenceDiagram
  participant U
  U->>U: ping`,
      { nodes: { 'participant-U': { style: { height: 120 } } } },
      { repositionNodes: true }
    )

    expect(nodes.find((node) => node.id === 'participant-U')?.height).toBe(120)
  })

  test('style.width does not move the lifeline grid', async () => {
    const { nodes } = await convertMermaidToReactFlowWithContext(
      `sequenceDiagram
  participant Alice
  participant John
  Alice->>John: hi`,
      { nodes: { 'participant-Alice': { style: { width: 240 } } } },
      { repositionNodes: true }
    )

    expect(
      nodes.find((node) => node.id === 'participant-Alice')?.position
    ).toStrictEqual({ x: 175, y: 0 })
    expect(
      nodes.find((node) => node.id === 'participant-John')?.position
    ).toStrictEqual({ x: 535, y: 0 })
  })

  test('all style keys can be set together', async () => {
    const { nodes } = await convertMermaidToReactFlowWithContext(
      `sequenceDiagram
  participant U
  U->>U: ping`,
      {
        nodes: {
          'participant-U': {
            style: {
              color: '#38bdf8',
              fill: '#111827',
              stroke: '#475569',
              strokeWidth: 3,
              borderRadius: 8,
              strokeStyle: 'dashed',
              borderAnimationEnabled: true,
            },
          },
        },
      },
      { repositionNodes: true }
    )

    expect(
      nodes.find((node) => node.id === 'participant-U')?.data
    ).toMatchObject({
      color: '#38bdf8',
      fill: '#111827',
      stroke: '#475569',
      strokeWidth: 3,
      borderRadius: 8,
      strokeStyle: 'dashed',
      borderAnimationEnabled: true,
      strokeAnimation: 'dash',
    })
  })
})

describe('participant name from context', () => {
  test('without context the Name field holds the mermaid identifier', async () => {
    const { nodes } = await convertMermaidToReactFlowWithContext(
      `sequenceDiagram
  participant DB
  DB->>DB: ping`,
      {},
      { repositionNodes: true }
    )

    expect(
      nodes
        .find((node) => node.id === 'participant-DB')
        ?.data.componentFields?.find((field) => field.label === 'Name')?.data
    ).toStrictEqual([{ value: 'DB' }])
  })

  test('without context the Name field holds the as alias', async () => {
    const { nodes } = await convertMermaidToReactFlowWithContext(
      `sequenceDiagram
  participant U as User
  U->>U: ping`,
      {},
      { repositionNodes: true }
    )

    expect(
      nodes
        .find((node) => node.id === 'participant-U')
        ?.data.componentFields?.find((field) => field.label === 'Name')?.data
    ).toStrictEqual([{ value: 'User' }])
  })

  test('without context the Name field holds the @{ alias }', async () => {
    const { nodes } = await convertMermaidToReactFlowWithContext(
      `sequenceDiagram
  participant DB@{ "type": "database", "alias": "Orders DB" }
  DB->>DB: ping`,
      {},
      { repositionNodes: true }
    )

    expect(
      nodes
        .find((node) => node.id === 'participant-DB')
        ?.data.componentFields?.find((field) => field.label === 'Name')?.data
    ).toStrictEqual([{ value: 'Orders DB' }])
  })

  test('context name overrides the mermaid alias', async () => {
    const { nodes } = await convertMermaidToReactFlowWithContext(
      `sequenceDiagram
  participant DB as Database
  DB->>DB: ping`,
      { nodes: { 'participant-DB': { name: 'Orders Database' } } },
      { repositionNodes: true }
    )

    expect(
      nodes
        .find((node) => node.id === 'participant-DB')
        ?.data.componentFields?.find((field) => field.label === 'Name')?.data
    ).toStrictEqual([{ value: 'Orders Database' }])
  })

  test('context name does not add a second Name field', async () => {
    const { nodes } = await convertMermaidToReactFlowWithContext(
      `sequenceDiagram
  participant DB as Database
  DB->>DB: ping`,
      { nodes: { 'participant-DB': { name: 'Orders Database' } } },
      { repositionNodes: true }
    )

    expect(
      nodes
        .find((node) => node.id === 'participant-DB')
        ?.data.componentFields?.filter((field) => field.label === 'Name')
    ).toHaveLength(1)
  })
})

describe('participant data fields from context', () => {
  test('a text input field is added by label', async () => {
    const { nodes } = await convertMermaidToReactFlowWithContext(
      `sequenceDiagram
  participant DB
  DB->>DB: ping`,
      {
        nodes: {
          'participant-DB': {
            data: {
              Owner: { type: ComponentInputType.TextInput, value: 'Data Team' },
            },
          },
        },
      },
      { repositionNodes: true }
    )

    expect(
      nodes
        .find((node) => node.id === 'participant-DB')
        ?.data.componentFields?.find((field) => field.label === 'Owner')
    ).toMatchObject({
      type: ComponentInputType.TextInput,
      label: 'Owner',
      data: [{ value: 'Data Team' }],
    })
  })

  test('a dropdown field keeps its options', async () => {
    const { nodes } = await convertMermaidToReactFlowWithContext(
      `sequenceDiagram
  participant DB
  DB->>DB: ping`,
      {
        nodes: {
          'participant-DB': {
            data: {
              Tier: {
                type: ComponentInputType.DropdownSelect,
                value: 'gold',
                options: ['gold', 'silver'],
              },
            },
          },
        },
      },
      { repositionNodes: true }
    )

    expect(
      nodes
        .find((node) => node.id === 'participant-DB')
        ?.data.componentFields?.find((field) => field.label === 'Tier')
    ).toMatchObject({
      type: ComponentInputType.DropdownSelect,
      label: 'Tier',
      options: ['gold', 'silver'],
      data: [{ value: 'gold' }],
    })
  })

  test('a number input field keeps its numeric value', async () => {
    const { nodes } = await convertMermaidToReactFlowWithContext(
      `sequenceDiagram
  participant DB
  DB->>DB: ping`,
      {
        nodes: {
          'participant-DB': {
            data: {
              Replicas: { type: ComponentInputType.NumberInput, value: 3 },
            },
          },
        },
      },
      { repositionNodes: true }
    )

    expect(
      nodes
        .find((node) => node.id === 'participant-DB')
        ?.data.componentFields?.find((field) => field.label === 'Replicas')
        ?.data
    ).toStrictEqual([{ value: 3 }])
  })

  test('a boolean toggle field keeps its boolean value', async () => {
    const { nodes } = await convertMermaidToReactFlowWithContext(
      `sequenceDiagram
  participant DB
  DB->>DB: ping`,
      {
        nodes: {
          'participant-DB': {
            data: {
              Critical: { type: ComponentInputType.BooleanToggle, value: true },
            },
          },
        },
      },
      { repositionNodes: true }
    )

    expect(
      nodes
        .find((node) => node.id === 'participant-DB')
        ?.data.componentFields?.find((field) => field.label === 'Critical')
        ?.data
    ).toStrictEqual([{ value: true }])
  })

  test('several data fields are added at once', async () => {
    const { nodes } = await convertMermaidToReactFlowWithContext(
      `sequenceDiagram
  participant DB
  DB->>DB: ping`,
      {
        nodes: {
          'participant-DB': {
            data: {
              Owner: { type: ComponentInputType.TextInput, value: 'Data Team' },
              Runbook: {
                type: ComponentInputType.URLInput,
                value: 'https://example.com',
              },
            },
          },
        },
      },
      { repositionNodes: true }
    )

    expect(
      nodes
        .find((node) => node.id === 'participant-DB')
        ?.data.componentFields?.map((field) => field.label)
    ).toStrictEqual(['Name', 'Owner', 'Runbook'])
  })

  test('name, style and data all apply to one participant', async () => {
    const { nodes } = await convertMermaidToReactFlowWithContext(
      `sequenceDiagram
  participant DB
  DB->>DB: ping`,
      {
        nodes: {
          'participant-DB': {
            name: 'Orders Database',
            style: { color: '#2563eb' },
            data: {
              Owner: { type: ComponentInputType.TextInput, value: 'Data Team' },
            },
          },
        },
      },
      { repositionNodes: true }
    )

    expect(nodes.find((node) => node.id === 'participant-DB')?.data.color).toBe(
      '#2563eb'
    )
    expect(
      nodes
        .find((node) => node.id === 'participant-DB')
        ?.data.componentFields?.find((field) => field.label === 'Name')?.data
    ).toStrictEqual([{ value: 'Orders Database' }])
    expect(
      nodes
        .find((node) => node.id === 'participant-DB')
        ?.data.componentFields?.find((field) => field.label === 'Owner')?.data
    ).toStrictEqual([{ value: 'Data Team' }])
  })
})

describe('computed lifeline data survives context', () => {
  test('rowCount is unchanged by a colour', async () => {
    const { nodes } = await convertMermaidToReactFlowWithContext(
      `sequenceDiagram
  participant A
  participant B
  A->>B: first
  B->>A: second`,
      { nodes: { 'participant-A': { style: { color: '#38bdf8' } } } },
      { repositionNodes: true }
    )

    expect(
      (
        nodes.find((node) => node.id === 'participant-A')?.data as {
          rowCount?: number
        }
      ).rowCount
    ).toBe(2)
  })

  test('rowYs is unchanged by a colour', async () => {
    const coloured = await convertMermaidToReactFlowWithContext(
      `sequenceDiagram
  participant A
  participant B
  A->>B: first
  B->>A: second`,
      { nodes: { 'participant-A': { style: { color: '#38bdf8' } } } },
      { repositionNodes: true }
    )
    const plain = await convertMermaidToReactFlowWithContext(
      `sequenceDiagram
  participant A
  participant B
  A->>B: first
  B->>A: second`,
      {},
      { repositionNodes: true }
    )

    expect(
      (
        coloured.nodes.find((node) => node.id === 'participant-A')?.data as {
          rowYs?: number[]
        }
      ).rowYs
    ).toStrictEqual(
      (
        plain.nodes.find((node) => node.id === 'participant-A')?.data as {
          rowYs?: number[]
        }
      ).rowYs
    )
  })

  test('activations survive a colour', async () => {
    const { nodes } = await convertMermaidToReactFlowWithContext(
      `sequenceDiagram
  participant A
  participant B
  A->>+B: hello
  B-->>-A: hi`,
      { nodes: { 'participant-B': { style: { color: '#38bdf8' } } } },
      { repositionNodes: true }
    )

    expect(
      (
        nodes.find((node) => node.id === 'participant-B')?.data as {
          activations?: unknown
        }
      ).activations
    ).toStrictEqual([{ startRow: 0, endRow: 1 }])
  })

  test('create and destroy still bound the lifeline under context', async () => {
    const { nodes } = await convertMermaidToReactFlowWithContext(
      `sequenceDiagram
  participant A
  A->>A: warm up
  create participant Tmp
  A->>Tmp: spawn
  destroy Tmp
  Tmp->>A: bye`,
      { nodes: { 'participant-Tmp': { style: { color: '#38bdf8' } } } },
      { repositionNodes: true }
    )

    expect(
      (
        nodes.find((node) => node.id === 'participant-Tmp')?.data as {
          lifelineStartRow?: number
        }
      ).lifelineStartRow
    ).toBe(2)
    expect(
      (
        nodes.find((node) => node.id === 'participant-Tmp')?.data as {
          lifelineEndRow?: number
        }
      ).lifelineEndRow
    ).toBe(3)
  })

  test('___internal overwrites layout data, which is why it is forbidden', async () => {
    const { nodes } = await convertMermaidToReactFlowWithContext(
      `sequenceDiagram
  participant A
  participant B
  A->>B: hi`,
      { nodes: { 'participant-A': { ___internal: { rowCount: 999 } } } },
      { repositionNodes: true }
    )

    expect(
      (
        nodes.find((node) => node.id === 'participant-A')?.data as {
          rowCount?: number
        }
      ).rowCount
    ).toBe(999)
  })

  test('type in context replaces sequenceParticipant, which is why it is forbidden', async () => {
    const { nodes } = await convertMermaidToReactFlowWithContext(
      `sequenceDiagram
  participant A
  participant B
  A->>B: hi`,
      { nodes: { 'participant-A': { type: 'shape' } } },
      { repositionNodes: true }
    )

    expect(nodes.find((node) => node.id === 'participant-A')?.type).toBe(
      'shape'
    )
  })
})

describe('edge context', () => {
  test('an edge is keyed by source-target, not by edge id', async () => {
    const { edges } = await convertMermaidToReactFlowWithContext(
      `sequenceDiagram
  participant A
  participant B
  A->>B: hi`,
      { edges: { 'participant-A-message-0': { label: 'labelled' } } },
      { repositionNodes: true }
    )

    expect(edges.find((edge) => edge.id === 'edge-0-a')?.label).toBe('labelled')
  })

  test('the edge id is not a usable context key', async () => {
    const { edges } = await convertMermaidToReactFlowWithContext(
      `sequenceDiagram
  participant A
  participant B
  A->>B: hi`,
      { edges: { 'edge-0-a': { label: 'labelled' } } },
      { repositionNodes: true }
    )

    expect(edges.find((edge) => edge.id === 'edge-0-a')?.label).toBeUndefined()
  })

  test('the incoming half of a message is keyed from the message box', async () => {
    const { edges } = await convertMermaidToReactFlowWithContext(
      `sequenceDiagram
  participant A
  participant B
  A->>B: hi`,
      { edges: { 'message-0-participant-B': { label: 'arrives' } } },
      { repositionNodes: true }
    )

    expect(edges.find((edge) => edge.id === 'edge-0-b')?.label).toBe('arrives')
  })

  test('edge type is overridden', async () => {
    const { edges } = await convertMermaidToReactFlowWithContext(
      `sequenceDiagram
  participant A
  participant B
  A->>B: hi`,
      { edges: { 'participant-A-message-0': { type: 'straight' } } },
      { repositionNodes: true }
    )

    expect(edges.find((edge) => edge.id === 'edge-0-a')?.type).toBe('straight')
  })

  test('edge stroke and strokeWidth are applied', async () => {
    const { edges } = await convertMermaidToReactFlowWithContext(
      `sequenceDiagram
  participant A
  participant B
  A->>B: hi`,
      {
        edges: {
          'participant-A-message-0': {
            style: { stroke: '#ef4444', strokeWidth: 4 },
          },
        },
      },
      { repositionNodes: true }
    )

    expect(edges.find((edge) => edge.id === 'edge-0-a')?.style?.stroke).toBe(
      '#ef4444'
    )
    expect(
      edges.find((edge) => edge.id === 'edge-0-a')?.style?.strokeWidth
    ).toBe(4)
  })

  test('edge strokeStyle dashed becomes a 4 2 dasharray', async () => {
    const { edges } = await convertMermaidToReactFlowWithContext(
      `sequenceDiagram
  participant A
  participant B
  A->>B: hi`,
      {
        edges: {
          'participant-A-message-0': { style: { strokeStyle: 'dashed' } },
        },
      },
      { repositionNodes: true }
    )

    expect(
      edges.find((edge) => edge.id === 'edge-0-a')?.style?.strokeDasharray
    ).toBe('4 2')
  })

  test('edge strokeStyle dotted becomes a 1 2 dasharray', async () => {
    const { edges } = await convertMermaidToReactFlowWithContext(
      `sequenceDiagram
  participant A
  participant B
  A->>B: hi`,
      {
        edges: {
          'participant-A-message-0': { style: { strokeStyle: 'dotted' } },
        },
      },
      { repositionNodes: true }
    )

    expect(
      edges.find((edge) => edge.id === 'edge-0-a')?.style?.strokeDasharray
    ).toBe('1 2')
  })

  test('edge strokeStyle solid clears the dasharray', async () => {
    const { edges } = await convertMermaidToReactFlowWithContext(
      `sequenceDiagram
  participant A
  participant B
  A-->>B: hi`,
      {
        edges: {
          'participant-A-message-0': { style: { strokeStyle: 'solid' } },
        },
      },
      { repositionNodes: true }
    )

    expect(
      edges.find((edge) => edge.id === 'edge-0-a')?.style?.strokeDasharray
    ).toBeUndefined()
  })

  test('edge borderAnimationEnabled sets animated', async () => {
    const { edges } = await convertMermaidToReactFlowWithContext(
      `sequenceDiagram
  participant A
  participant B
  A->>B: hi`,
      {
        edges: {
          'participant-A-message-0': {
            style: { borderAnimationEnabled: true },
          },
        },
      },
      { repositionNodes: true }
    )

    expect(edges.find((edge) => edge.id === 'edge-0-a')?.animated).toBe(true)
  })

  test('context handles override the generated row handles', async () => {
    const { edges } = await convertMermaidToReactFlowWithContext(
      `sequenceDiagram
  participant A
  participant B
  A->>B: hi`,
      {
        edges: {
          'participant-A-message-0': {
            sourceHandle: 'row-9-left-source',
            targetHandle: 'target-right',
          },
        },
      },
      { repositionNodes: true }
    )

    expect(edges.find((edge) => edge.id === 'edge-0-a')?.sourceHandle).toBe(
      'row-9-left-source'
    )
    expect(edges.find((edge) => edge.id === 'edge-0-a')?.targetHandle).toBe(
      'target-right'
    )
  })
})

describe('the column grid', () => {
  test('participants sit 360px apart starting at 175', async () => {
    const { nodes } = await convertMermaidToReactFlowWithContext(
      `sequenceDiagram
  participant A
  participant B
  participant C
  participant D
  A->>B: hi`,
      {},
      { repositionNodes: true }
    )

    expect(
      nodes
        .filter((node) => node.type === 'sequenceParticipant')
        .sort((a, b) => a.position.x - b.position.x)
        .map((node) => node.position)
    ).toStrictEqual([
      { x: 175, y: 0 },
      { x: 535, y: 0 },
      { x: 895, y: 0 },
      { x: 1255, y: 0 },
    ])
  })

  test('repositionNodes true does not move the sequence grid', async () => {
    const repositioned = await convertMermaidToReactFlowWithContext(
      `sequenceDiagram
  participant A
  participant B
  participant C
  A->>B: first
  B->>C: second`,
      {},
      { repositionNodes: true }
    )
    const asParsed = await convertMermaidToReactFlowWithContext(
      `sequenceDiagram
  participant A
  participant B
  participant C
  A->>B: first
  B->>C: second`,
      {},
      { repositionNodes: false }
    )

    expect(repositioned.nodes.map((node) => node.position)).toStrictEqual(
      asParsed.nodes.map((node) => node.position)
    )
  })

  test('repositionNodes true does not move a coloured sequence grid', async () => {
    const { nodes } = await convertMermaidToReactFlowWithContext(
      `sequenceDiagram
  participant Alice
  participant John
  Alice->>John: hi`,
      {
        nodes: {
          'participant-Alice': { style: { color: '#FFF000' } },
          'participant-John': { style: { color: '#38bdf8' } },
        },
      },
      { repositionNodes: true }
    )

    expect(
      nodes.find((node) => node.id === 'participant-Alice')?.position
    ).toStrictEqual({ x: 175, y: 0 })
    expect(
      nodes.find((node) => node.id === 'participant-John')?.position
    ).toStrictEqual({ x: 535, y: 0 })
  })

  test('___position overrides a participant column', async () => {
    const { nodes } = await convertMermaidToReactFlowWithContext(
      `sequenceDiagram
  participant A
  participant B
  A->>B: hi`,
      { nodes: { 'participant-A': { ___position: { x: 42, y: 7 } } } },
      { repositionNodes: true }
    )

    expect(
      nodes.find((node) => node.id === 'participant-A')?.position
    ).toStrictEqual({ x: 42, y: 7 })
  })

  test('the converted graph is still detected as a sequence diagram', async () => {
    const { nodes } = await convertMermaidToReactFlowWithContext(
      `sequenceDiagram
  participant A
  participant B
  A->>B: hi`,
      { nodes: { 'participant-A': { style: { color: '#38bdf8' } } } },
      { repositionNodes: true }
    )

    expect(isSequenceDiagram(nodes)).toBe(true)
  })
})

describe('context validation', () => {
  test('the documented sample context parses', () => {
    expect(() =>
      contextSchema.parse({
        nodes: {
          'participant-DB': {
            name: 'Orders Database',
            style: { color: '#2563eb' },
            data: {
              Owner: { type: ComponentInputType.TextInput, value: 'Data Team' },
            },
          },
        },
      })
    ).not.toThrow()
  })

  test('an unknown style key is stripped instead of applied', async () => {
    const { nodes } = await convertMermaidToReactFlowWithContext(
      `sequenceDiagram
  participant U
  U->>U: ping`,
      {
        nodes: {
          'participant-U': { style: { colour: '#38bdf8' } },
        } as unknown as Parameters<
          typeof convertMermaidToReactFlowWithContext
        >[1]['nodes'],
      } as Parameters<typeof convertMermaidToReactFlowWithContext>[1],
      { repositionNodes: true }
    )

    expect(
      nodes.find((node) => node.id === 'participant-U')?.data.color
    ).toBeUndefined()
  })

  test('an invalid strokeStyle is rejected', () => {
    expect(() =>
      contextSchema.parse({
        nodes: { 'participant-U': { style: { strokeStyle: 'wavy' } } },
      })
    ).toThrow()
  })

  test('an unknown component field type is rejected', () => {
    expect(() =>
      contextSchema.parse({
        nodes: {
          'participant-U': {
            data: { Owner: { type: 'Not A Type', value: 'x' } },
          },
        },
      })
    ).toThrow()
  })

  test('context for a node id that does not exist is ignored', async () => {
    const { nodes } = await convertMermaidToReactFlowWithContext(
      `sequenceDiagram
  participant A
  participant B
  A->>B: hi`,
      { nodes: { 'participant-Nope': { style: { color: '#38bdf8' } } } },
      { repositionNodes: true }
    )

    expect(nodes.map((node) => node.id)).toStrictEqual([
      'participant-A',
      'participant-B',
      'message-0',
    ])
  })

  test('an empty context matches a plain conversion', async () => {
    const withContext = await convertMermaidToReactFlowWithContext(
      `sequenceDiagram
  participant A
  participant B
  A->>B: hi`,
      {},
      { repositionNodes: true }
    )
    const withoutContext = await convertMermaidToReactFlow(`sequenceDiagram
  participant A
  participant B
  A->>B: hi`)

    expect(withContext.nodes.map((node) => node.id)).toStrictEqual(
      withoutContext.nodes.map((node) => node.id)
    )
    expect(withContext.edges.map((edge) => edge.id)).toStrictEqual(
      withoutContext.edges.map((edge) => edge.id)
    )
  })
})
