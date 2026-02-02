import type { ReactFlowData } from '@/types'
import { describe, expect, it } from 'vitest'
import { syncBaseData } from './sync-base-data'

function makeNode(
  id: string,
  data: Record<string, unknown> = {}
): ReactFlowData['nodes'][0] {
  return { id, data, position: { x: 0, y: 0 } }
}

function makeEdge(
  id: string,
  data: Record<string, unknown> = {}
): ReactFlowData['edges'][0] {
  return { id, source: 'a', target: 'b', data }
}

describe('syncBaseData', () => {
  it('returns empty nodes and edges when both inputs are empty', () => {
    const prev: ReactFlowData = { nodes: [], edges: [] }
    const next: ReactFlowData = { nodes: [], edges: [] }
    expect(syncBaseData(prev, next)).toEqual({ nodes: [], edges: [] })
  })

  it('returns next node unchanged when prev has no node with same id', () => {
    const prev: ReactFlowData = {
      nodes: [makeNode('n2', { label: 'prev' })],
      edges: [],
    }
    const next: ReactFlowData = {
      nodes: [makeNode('n1', { label: 'next' })],
      edges: [],
    }
    const result = syncBaseData(prev, next)
    expect(result.nodes).toHaveLength(1)
    expect(result.nodes[0].id).toBe('n1')
    expect(result.nodes[0].data).toEqual({ label: 'next' })
  })

  it('returns next edge unchanged when prev has no edge with same id', () => {
    const prev: ReactFlowData = {
      nodes: [],
      edges: [makeEdge('e2', { label: 'prev' })],
    }
    const next: ReactFlowData = {
      nodes: [],
      edges: [makeEdge('e1', { label: 'next' })],
    }
    const result = syncBaseData(prev, next)
    expect(result.edges).toHaveLength(1)
    expect(result.edges[0].id).toBe('e1')
    expect(result.edges[0].data).toEqual({ label: 'next' })
  })

  it('merges matching node: uses next node shape and merges data (prev then next)', () => {
    const prev: ReactFlowData = {
      nodes: [
        {
          ...makeNode('n1', { a: 1, b: 2 }),
          position: { x: 10, y: 20 },
        },
      ],
      edges: [],
    }
    const next: ReactFlowData = {
      nodes: [makeNode('n1', { b: 20, c: 3 })],
      edges: [],
    }
    const result = syncBaseData(prev, next)
    expect(result.nodes).toHaveLength(1)
    expect(result.nodes[0].id).toBe('n1')
    expect(result.nodes[0].position).toEqual({ x: 0, y: 0 })
    expect(result.nodes[0].data).toEqual({ a: 1, b: 20, c: 3 })
  })

  it('merges matching edge: uses next edge shape and merges data (prev then next)', () => {
    const prev: ReactFlowData = {
      nodes: [],
      edges: [
        {
          ...makeEdge('e1', { a: 1, b: 2 }),
          source: 'x',
          target: 'y',
        },
      ],
    }
    const next: ReactFlowData = {
      nodes: [],
      edges: [makeEdge('e1', { b: 20, c: 3 })],
    }
    const result = syncBaseData(prev, next)
    expect(result.edges).toHaveLength(1)
    expect(result.edges[0].id).toBe('e1')
    expect(result.edges[0].source).toBe('a')
    expect(result.edges[0].target).toBe('b')
    expect(result.edges[0].data).toEqual({ a: 1, b: 20, c: 3 })
  })

  it('preserves next order and only includes next items (ignores prev-only items)', () => {
    const prev: ReactFlowData = {
      nodes: [makeNode('n1'), makeNode('n2')],
      edges: [makeEdge('e1'), makeEdge('e2')],
    }
    const next: ReactFlowData = {
      nodes: [
        makeNode('n0'),
        makeNode('n1', { x: 1 }),
        makeNode('n2', { x: 2 }),
        makeNode('n3'),
      ],
      edges: [
        makeEdge('e0'),
        makeEdge('e1', { x: 1 }),
        makeEdge('e2', { x: 2 }),
        makeEdge('e3'),
      ],
    }
    const result = syncBaseData(prev, next)
    expect(result.nodes.map((n) => n.id)).toEqual(['n0', 'n1', 'n2', 'n3'])
    expect(result.edges.map((e) => e.id)).toEqual(['e0', 'e1', 'e2', 'e3'])
    expect(result.nodes[1].data).toEqual({ x: 1 })
    expect(result.nodes[2].data).toEqual({ x: 2 })
    expect(result.edges[1].data).toEqual({ x: 1 })
    expect(result.edges[2].data).toEqual({ x: 2 })
  })

  it('handles mix of matched and unmatched next nodes and edges', () => {
    const prev: ReactFlowData = {
      nodes: [makeNode('matched', { keep: true })],
      edges: [makeEdge('matched', { keep: true })],
    }
    const next: ReactFlowData = {
      nodes: [
        makeNode('matched', { added: true }),
        makeNode('unmatched', { added: true }),
      ],
      edges: [
        makeEdge('matched', { added: true }),
        makeEdge('unmatched', { added: true }),
      ],
    }
    const result = syncBaseData(prev, next)
    expect(result.nodes).toHaveLength(2)
    expect(result.nodes[0].data).toEqual({ added: true, keep: true })
    expect(result.nodes[1].data).toEqual({ added: true })
    expect(result.edges).toHaveLength(2)
    expect(result.edges[0].data).toEqual({ added: true, keep: true })
    expect(result.edges[1].data).toEqual({ added: true })
  })
})
