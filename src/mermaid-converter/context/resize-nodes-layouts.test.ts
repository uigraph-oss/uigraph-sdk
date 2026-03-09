import type { Node } from '@xyflow/react'
import { describe, expect, it } from 'vitest'
import { resizeNodesLayouts } from './resize-nodes-layouts'

describe('resizeNodesLayouts', () => {
  it('shifts nodes by the overflow of larger typed nodes', () => {
    const nodes: Node[] = [
      {
        id: 'db',
        type: 'databaseTableSQL',
        position: { x: 0, y: 0 },
        width: 400,
        height: 500,
        data: {},
      },
      {
        id: 'right',
        position: { x: 240, y: 0 },
        width: 100,
        height: 80,
        data: {},
      },
      {
        id: 'below',
        position: { x: 0, y: 420 },
        width: 120,
        height: 70,
        data: {},
      },
      {
        id: 'corner',
        position: { x: 240, y: 420 },
        width: 90,
        height: 60,
        data: {},
      },
    ]

    const resizedNodes = resizeNodesLayouts(nodes)

    expect(resizedNodes.find((node) => node.id === 'db')?.position).toEqual({
      x: 0,
      y: 0,
    })

    expect(resizedNodes.find((node) => node.id === 'right')?.position).toEqual({
      x: 440,
      y: 0,
    })

    expect(resizedNodes.find((node) => node.id === 'below')?.position).toEqual({
      x: 0,
      y: 520,
    })

    expect(resizedNodes.find((node) => node.id === 'corner')?.position).toEqual(
      {
        x: 440,
        y: 520,
      }
    )
  })

  it('accumulates overflow from multiple expanded typed nodes', () => {
    const nodes: Node[] = [
      {
        id: 'db',
        type: 'databaseTableSQL',
        position: { x: 0, y: 0 },
        width: 260,
        height: 480,
        data: {},
      },
      {
        id: 'table',
        type: 'table',
        position: { x: 240, y: 420 },
        width: 650,
        height: 520,
        data: {},
      },
      {
        id: 'target',
        position: { x: 760, y: 860 },
        width: 80,
        height: 40,
        data: {},
      },
    ]

    const resizedNodes = resizeNodesLayouts(nodes)

    expect(resizedNodes.find((node) => node.id === 'target')?.position).toEqual(
      {
        x: 970,
        y: 1060,
      }
    )
  })

  it('recomputes group bounds from moved child nodes', () => {
    const nodes: Node[] = [
      {
        id: 'table-node',
        type: 'table',
        position: { x: 0, y: 0 },
        width: 700,
        height: 480,
        data: {},
      },
      {
        id: 'child-a',
        position: { x: 560, y: 40 },
        width: 100,
        height: 80,
        data: {},
      },
      {
        id: 'child-b',
        position: { x: 560, y: 180 },
        width: 80,
        height: 60,
        data: {},
      },
      {
        id: 'group-1',
        type: 'group',
        position: { x: 0, y: 0 },
        style: { width: 0, height: 0 },
        data: {
          childNodes: ['child-a', 'child-b'],
        },
      },
    ]

    const resizedNodes = resizeNodesLayouts(nodes)
    const groupNode = resizedNodes.find((node) => node.id === 'group-1')

    expect(
      resizedNodes.find((node) => node.id === 'child-a')?.position
    ).toEqual({
      x: 760,
      y: 40,
    })

    expect(
      resizedNodes.find((node) => node.id === 'child-b')?.position
    ).toEqual({
      x: 760,
      y: 180,
    })

    expect(groupNode?.position).toEqual({ x: 740, y: 20 })
    expect(groupNode?.style?.width).toBe(160)
    expect(groupNode?.style?.height).toBe(290)
  })
})
