import type { Node } from '@xyflow/react'
import { describe, expect, it } from 'vitest'
import { createGroupNode, generateGroupNodeFromNodes } from './group'

describe('createGroupNode', () => {
  it('creates group node with provided bounds and nodes', () => {
    const node = createGroupNode({
      id: 'group-1',
      name: 'My Group',
      nodes: ['a', 'b'],
      bounds: { x: 10, y: 20, width: 100, height: 200 },
    })

    expect(node.id).toBe('group-1')
    expect(node.type).toBe('group')
    expect(node.position).toEqual({ x: 10, y: 20 })
    expect(node.data.childNodes).toEqual(['a', 'b'])
    expect(node.style?.width).toBe(120)
    expect(node.style?.height).toBe(250)
  })
})

describe('generateGroupNodeFromNodes', () => {
  it('computes bounds using node sizes and positions', () => {
    const nodes: Node[] = [
      {
        id: 'a',
        position: { x: 10, y: 20 },
        width: 50,
        height: 40,
        data: {},
      },
      {
        id: 'b',
        position: { x: 100, y: 120 },
        style: { width: 60, height: 30 },
        data: {},
      },
    ]

    const group = generateGroupNodeFromNodes('g1', 'Group', nodes)
    expect(group.id).toBe('g1')
    expect(group.data.childNodes).toEqual(['a', 'b'])
    expect(group.position).toEqual({ x: -10, y: 0 })
    expect(group.style?.width).toBe(210)
    expect(group.style?.height).toBe(220)
  })
})
