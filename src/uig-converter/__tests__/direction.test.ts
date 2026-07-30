import { Edge, Node } from '@xyflow/react'
import { describe, expect, it } from 'vitest'
import { inferDirection } from '../core/direction'

function nodeAt(id: string, x: number, y: number): Node {
  return { id, position: { x, y }, data: {} }
}

function edgeBetween(source: string, target: string): Edge {
  return { id: `${source}-${target}`, source, target }
}

describe('choosing a flow direction', () => {
  it('lets the joined up nodes decide it, not the ones off to the side', () => {
    const direction = inferDirection(
      [nodeAt('a', 0, 0), nodeAt('b', 0, 300), nodeAt('aside', 900, 0)],
      [edgeBetween('a', 'b')]
    )

    expect(direction).toBe('TB')
  })

  it('measures how far apart the ends are, not which way the arrow points', () => {
    const direction = inferDirection(
      [nodeAt('a', 400, 0), nodeAt('b', 0, 10)],
      [edgeBetween('a', 'b')]
    )

    expect(direction).toBe('LR')
  })

  it('settles a tie in favour of left to right', () => {
    const direction = inferDirection(
      [nodeAt('a', 0, 0), nodeAt('b', 120, 120)],
      [edgeBetween('a', 'b')]
    )

    expect(direction).toBe('LR')
  })

  it('falls back to how the nodes are spread when an edge dangles', () => {
    const direction = inferDirection(
      [nodeAt('a', 0, 0), nodeAt('b', 500, 0)],
      [edgeBetween('a', 'ghost')]
    )

    expect(direction).toBe('LR')
  })

  it('reads a tall arrangement as top to bottom when nothing is joined up', () => {
    const direction = inferDirection(
      [nodeAt('a', 0, 0), nodeAt('b', 40, 600)],
      []
    )

    expect(direction).toBe('TB')
  })
})
