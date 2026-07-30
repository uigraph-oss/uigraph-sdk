import { describe, expect, it } from 'vitest'
import { parseSequenceDiagram } from '../parser'

function parse(...lines: string[]) {
  return parseSequenceDiagram(['sequenceDiagram', ...lines].join('\n'))
}

describe('malformed declarations', () => {
  it('keeps a participant whose stereotype config is not valid JSON', () => {
    const { participants } = parse('  participant Alice@{ type: database }')

    expect(participants.map((participant) => participant.id)).toEqual(['Alice'])
    expect(participants[0].type).toBe('participant')
  })

  it('keeps a participant whose actor menu is not valid JSON', () => {
    const { participants } = parse(
      '  participant Alice',
      '  links Alice: {Dashboard: no quotes here}'
    )

    expect(participants.map((participant) => participant.id)).toEqual(['Alice'])
    expect(participants[0].links).toEqual([])
  })
})

describe('unterminated constructs', () => {
  it('closes an activation that the diagram never deactivates', () => {
    const { activations } = parse(
      '  Alice->>Bob: hi',
      '  activate Bob',
      '  Bob->>Alice: back'
    )

    expect(activations).toHaveLength(1)
    expect(activations[0].participant).toBe('Bob')
    expect(activations[0].endRow).toBeGreaterThanOrEqual(
      activations[0].startRow
    )
  })

  it('closes a block that the diagram never ends', () => {
    const { blocks, messages } = parse(
      '  Alice->>Bob: hi',
      '  loop forever',
      '    Bob->>Alice: again'
    )

    expect(blocks).toHaveLength(1)
    expect(blocks[0].endRow).toBe(messages[messages.length - 1].rowIndex)
  })

  it('ignores an end that closes nothing', () => {
    const { messages, blocks, boxes } = parse(
      '  end',
      '  Alice->>Bob: hi',
      '  end'
    )

    expect(messages).toHaveLength(1)
    expect(blocks).toHaveLength(0)
    expect(boxes).toHaveLength(0)
  })

  it('ignores a deactivate with no activation open', () => {
    const { activations, participants } = parse(
      '  deactivate Alice',
      '  Alice->>Bob: hi'
    )

    expect(activations).toHaveLength(0)
    expect(participants.map((participant) => participant.id)).toEqual([
      'Alice',
      'Bob',
    ])
  })
})

describe('incomplete message lines', () => {
  it('ignores an arrow with no label, without inventing its participants', () => {
    const { messages, participants } = parse('  Alice->>Bob')

    expect(messages).toHaveLength(0)
    expect(participants).toHaveLength(0)
  })

  it('ignores an arrow with nothing on one end of it', () => {
    const { messages, participants } = parse('  ->>Bob: hi')

    expect(messages).toHaveLength(0)
    expect(participants).toHaveLength(0)
  })
})
