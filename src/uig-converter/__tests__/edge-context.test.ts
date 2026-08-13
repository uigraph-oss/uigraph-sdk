import { describe, expect, it } from 'vitest'
import { buildContextEdges } from '../context/edge-context'

const ID_MAP = new Map([
  ['a', 'A'],
  ['b', 'B'],
])

describe('what reaches the edge context', () => {
  it('leaves out an edge that carries nothing worth recording', () => {
    const contextEdges = buildContextEdges(
      [{ id: 'e1', source: 'a', target: 'b' }],
      ID_MAP
    )

    expect(contextEdges).toEqual({})
  })

  it('ignores an edge that reaches a node the map does not know', () => {
    const contextEdges = buildContextEdges(
      [{ id: 'e1', source: 'a', target: 'grouped-away', label: 'calls' }],
      ID_MAP
    )

    expect(contextEdges).toEqual({})
  })

  it('keeps an entry per edge when two of them join the same pair', () => {
    const contextEdges = buildContextEdges(
      [
        { id: 'e1', source: 'a', target: 'b', label: 'first' },
        { id: 'e2', source: 'a', target: 'b', label: 'second' },
      ],
      ID_MAP
    )

    expect(Object.keys(contextEdges)).toEqual(['A-B', 'A-B#1'])
    expect(contextEdges['A-B'].label).toBe('first')
    expect(contextEdges['A-B#1'].label).toBe('second')
  })

  it('counts an edge that records nothing when it numbers the next one', () => {
    const contextEdges = buildContextEdges(
      [
        { id: 'e1', source: 'a', target: 'b' },
        { id: 'e2', source: 'a', target: 'b', label: 'second' },
      ],
      ID_MAP
    )

    expect(Object.keys(contextEdges)).toEqual(['A-B#1'])
  })

  it('leaves the style out when nothing about the line was set', () => {
    const contextEdges = buildContextEdges(
      [{ id: 'e1', source: 'a', target: 'b', label: 'calls' }],
      ID_MAP
    )

    expect(contextEdges['A-B'].style).toBeUndefined()
  })
})
