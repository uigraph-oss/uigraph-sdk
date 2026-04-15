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
      x: 540,
      y: 0,
    })

    expect(resizedNodes.find((node) => node.id === 'below')?.position).toEqual({
      x: 0,
      y: 520,
    })

    expect(resizedNodes.find((node) => node.id === 'corner')?.position).toEqual(
      {
        x: 260,
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
        x: 760,
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
      x: 840,
      y: 40,
    })

    expect(
      resizedNodes.find((node) => node.id === 'child-b')?.position
    ).toEqual({
      x: 560,
      y: 180,
    })

    expect(groupNode?.position).toEqual({ x: 540, y: 20 })
    expect(groupNode?.style?.width).toBe(440)
    expect(groupNode?.style?.height).toBe(290)
  })

  it('keeps a visible gap between same-row nodes after content resizing', () => {
    const nodes: Node[] = [
      {
        id: 'text',
        type: 'text',
        position: { x: 100, y: 100 },
        measured: { width: 178, height: 41 },
        data: {},
      },
      {
        id: 'doc',
        type: 'shape',
        position: { x: 377, y: 100 },
        measured: { width: 159, height: 45 },
        data: {},
      },
      {
        id: 'code',
        type: 'code',
        position: { x: 621, y: 100 },
        measured: { width: 278, height: 172 },
        data: {},
      },
      {
        id: 'table',
        type: 'table',
        position: { x: 904, y: 100 },
        measured: { width: 545, height: 194 },
        data: {},
      },
    ]

    const resizedNodes = resizeNodesLayouts(nodes)
    const textNode = resizedNodes.find((node) => node.id === 'text')
    const docNode = resizedNodes.find((node) => node.id === 'doc')
    const codeNode = resizedNodes.find((node) => node.id === 'code')
    const tableNode = resizedNodes.find((node) => node.id === 'table')

    expect(docNode?.position.x).toBe(418)
    expect(codeNode?.position.x).toBe(717)
    expect(tableNode?.position.x).toBe(1135)

    expect(
      (docNode?.position.x ?? 0) - ((textNode?.position.x ?? 0) + 178)
    ).toBe(140)

    expect(
      (codeNode?.position.x ?? 0) - ((docNode?.position.x ?? 0) + 159)
    ).toBe(140)

    expect(
      (tableNode?.position.x ?? 0) - ((codeNode?.position.x ?? 0) + 278)
    ).toBe(140)
  })

  it('uses style and measured size fallbacks when explicit dimensions are missing', () => {
    const nodes: Node[] = [
      {
        id: 'table',
        type: 'table',
        position: { x: 0, y: 0 },
        style: { width: 620, height: 460 },
        data: {},
      },
      {
        id: 'database',
        type: 'databaseTableSQL',
        position: { x: 700, y: 0 },
        measured: { width: 280, height: 450 },
        data: {},
      },
      {
        id: 'target',
        position: { x: 980, y: 0 },
        measured: { width: 80, height: 40 },
        data: {},
      },
    ]

    const resizedNodes = resizeNodesLayouts(nodes)
    const tableNode = resizedNodes.find((node) => node.id === 'table')
    const databaseNode = resizedNodes.find((node) => node.id === 'database')
    const targetNode = resizedNodes.find((node) => node.id === 'target')

    expect(databaseNode?.position).toEqual({
      x: 760,
      y: 0,
    })

    expect(targetNode?.position).toEqual({
      x: 1180,
      y: 0,
    })

    expect(
      (databaseNode?.position.x ?? 0) - ((tableNode?.position.x ?? 0) + 620)
    ).toBeGreaterThanOrEqual(140)

    expect(
      (targetNode?.position.x ?? 0) - ((databaseNode?.position.x ?? 0) + 280)
    ).toBeGreaterThanOrEqual(140)
  })

  it('does not force horizontal spacing for nodes on different rows', () => {
    const nodes: Node[] = [
      {
        id: 'table',
        type: 'table',
        position: { x: 0, y: 0 },
        measured: { width: 700, height: 200 },
        data: {},
      },
      {
        id: 'next-row',
        position: { x: 520, y: 220 },
        measured: { width: 100, height: 50 },
        data: {},
      },
    ]

    const resizedNodes = resizeNodesLayouts(nodes)

    expect(
      resizedNodes.find((node) => node.id === 'next-row')?.position
    ).toEqual({
      x: 520,
      y: 220,
    })
  })

  it('leaves nodes in place when they already have enough horizontal gap', () => {
    const nodes: Node[] = [
      {
        id: 'first',
        position: { x: 100, y: 100 },
        measured: { width: 150, height: 40 },
        data: {},
      },
      {
        id: 'second',
        position: { x: 420, y: 100 },
        measured: { width: 120, height: 60 },
        data: {},
      },
    ]

    const resizedNodes = resizeNodesLayouts(nodes)

    expect(resizedNodes.find((node) => node.id === 'first')?.position).toEqual({
      x: 100,
      y: 100,
    })

    expect(resizedNodes.find((node) => node.id === 'second')?.position).toEqual(
      {
        x: 420,
        y: 100,
      }
    )
  })

  it('recomputes group bounds from available children when some are missing', () => {
    const nodes: Node[] = [
      {
        id: 'child-a',
        position: { x: 300, y: 120 },
        measured: { width: 90, height: 50 },
        data: {},
      },
      {
        id: 'group-1',
        type: 'group',
        position: { x: 0, y: 0 },
        style: { width: 0, height: 0 },
        data: {
          childNodes: ['child-a', 'missing-child'],
        },
      },
    ]

    const resizedNodes = resizeNodesLayouts(nodes)
    const groupNode = resizedNodes.find((node) => node.id === 'group-1')

    expect(groupNode?.position).toEqual({ x: 280, y: 100 })
    expect(groupNode?.style?.width).toBe(150)
    expect(groupNode?.style?.height).toBe(140)
  })
})
