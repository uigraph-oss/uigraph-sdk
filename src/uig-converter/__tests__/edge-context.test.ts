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

  it('keeps one entry for a pair even when two edges join them', () => {
    const contextEdges = buildContextEdges(
      [
        { id: 'e1', source: 'a', target: 'b', label: 'first' },
        { id: 'e2', source: 'a', target: 'b', label: 'second' },
      ],
      ID_MAP
    )

    expect(Object.keys(contextEdges)).toEqual(['A-B'])
    expect(contextEdges['A-B'].label).toBe('second')
  })

  it('leaves the style out when nothing about the line was set', () => {
    const contextEdges = buildContextEdges(
      [{ id: 'e1', source: 'a', target: 'b', label: 'calls' }],
      ID_MAP
    )

    expect(contextEdges['A-B'].style).toBeUndefined()
  })
})
