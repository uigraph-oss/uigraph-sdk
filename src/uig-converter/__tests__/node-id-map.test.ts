import { Node } from '@xyflow/react'
import { describe, expect, it } from 'vitest'
import { buildNodeIdMap } from '../core/node-id-map'

function nodeWithId(id: string): Node {
  return { id, position: { x: 0, y: 0 }, data: {} }
}

describe('mapping diagram ids onto mermaid ids', () => {
  it('steps past a letter another node already answers to', () => {
    const map = buildNodeIdMap([nodeWithId('A'), nodeWithId('step 2')])

    expect(map.get('A')).toBe('A')
    expect(map.get('step 2')).toBe('B')
  })

  it('moves a node off its own letter when a generated id got there first', () => {
    const map = buildNodeIdMap([nodeWithId('step 1'), nodeWithId('A')])

    expect(map.get('step 1')).toBe('A')
    expect(map.get('A')).not.toBe('A')
  })

  it('carries on past Z when there are more nodes than letters', () => {
    const nodes = Array.from({ length: 27 }, (_, index) =>
      nodeWithId(`step ${index}`)
    )
    const map = buildNodeIdMap(nodes)

    expect(map.get('step 25')).toBe('Z')
    expect(map.get('step 26')).toBe('AA')
  })
})
