import { Node } from '@xyflow/react'
import { describe, expect, it } from 'vitest'
import { LAYOUT_SPACING } from '../../constants/layout'
import { convertFlowChartToReactFlow } from '../to-react-flow'

function boxOf(node: Node) {
  return {
    left: node.position.x,
    top: node.position.y,
    right: node.position.x + (node.style!.width as number),
    bottom: node.position.y + (node.style!.height as number),
  }
}

describe('nothing lands on top of anything else', () => {
  it('keeps every top level box clear of every other one', async () => {
    const { nodes } = await convertFlowChartToReactFlow(
      'flowchart TB\n  subgraph S1\n    A --> B\n  end\n  Loose\n  B --> Loose'
    )
    const boxes = nodes
      .filter((node) => !node.parentId)
      .map((node) => boxOf(node))

    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const overlaps =
          boxes[i].left < boxes[j].right &&
          boxes[j].left < boxes[i].right &&
          boxes[i].top < boxes[j].bottom &&
          boxes[j].top < boxes[i].bottom

        expect(overlaps).toBe(false)
      }
    }
  })

  it('keeps a node that joins nothing clear of a group it does not belong to', async () => {
    const { nodes } = await convertFlowChartToReactFlow(
      'flowchart TB\n  subgraph S1\n    A --> B\n  end\n  Loose\n  B --> Loose\n  Far'
    )
    const group = boxOf(nodes.find((node) => node.id === 'subgraph-S1')!)
    const far = boxOf(nodes.find((node) => node.id === 'Far')!)

    expect(far.left >= group.right || far.right <= group.left).toBe(true)
  })

  it('keeps two boxes in the same rank at least a node separation apart', async () => {
    const { nodes } = await convertFlowChartToReactFlow(
      'flowchart LR\n  A --> B\n  C --> D'
    )
    const first = boxOf(nodes.find((node) => node.id === 'A')!)
    const next = boxOf(nodes.find((node) => node.id === 'B')!)
    const below = boxOf(nodes.find((node) => node.id === 'C')!)

    expect(next.left - first.right).toBeGreaterThanOrEqual(
      LAYOUT_SPACING.NODE_SEPARATION_HORIZONTAL
    )
    expect(below.top - first.bottom).toBeGreaterThanOrEqual(
      LAYOUT_SPACING.NODE_SEPARATION_VERTICAL
    )
  })
})

describe('containment', () => {
  it('fits every child entirely within the box of its parent', async () => {
    const { nodes } = await convertFlowChartToReactFlow(
      'flowchart TB\n  subgraph outer\n    subgraph inner\n      A --> B\n    end\n    C\n  end\n  subgraph other\n    D --> E\n  end\n  B --> D'
    )

    for (const child of nodes.filter((node) => node.parentId)) {
      const parent = nodes.find((node) => node.id === child.parentId)!
      const box = boxOf(child)

      expect(box.left).toBeGreaterThanOrEqual(0)
      expect(box.top).toBeGreaterThanOrEqual(0)
      expect(box.right).toBeLessThanOrEqual(parent.style!.width as number)
      expect(box.bottom).toBeLessThanOrEqual(parent.style!.height as number)
    }
  })

  it('lists a parent before the children that hang off it', async () => {
    const { nodes } = await convertFlowChartToReactFlow(
      'flowchart TB\n  subgraph outer\n    subgraph inner\n      A\n    end\n  end'
    )
    const order = nodes.map((node) => node.id)

    for (const child of nodes.filter((node) => node.parentId)) {
      expect(order.indexOf(child.parentId!)).toBeLessThan(
        order.indexOf(child.id)
      )
    }
  })

  it('clips a group nested inside another group to its parent', async () => {
    const { nodes } = await convertFlowChartToReactFlow(
      'flowchart TB\n  subgraph outer\n    subgraph inner\n      A\n    end\n  end'
    )
    const inner = nodes.find((node) => node.id === 'subgraph-inner')!

    expect(inner.type).toBe('group')
    expect(inner.parentId).toBe('subgraph-outer')
    expect(inner.extent).toBe('parent')
  })

  it('leaves a group that nobody nests free of a parent', async () => {
    const { nodes } = await convertFlowChartToReactFlow(
      'flowchart TB\n  subgraph outer\n    A\n  end'
    )
    const outer = nodes.find((node) => node.id === 'subgraph-outer')!

    expect(outer.parentId).toBeUndefined()
    expect(outer.extent).toBeUndefined()
  })
})

describe('the direction decides which way the diagram runs', () => {
  it('runs a chain rightwards and downwards for the two forward directions', async () => {
    const sideways = await convertFlowChartToReactFlow(
      'flowchart LR\n  A --> B'
    )
    const downwards = await convertFlowChartToReactFlow(
      'flowchart TB\n  A --> B'
    )

    expect(boxOf(sideways.nodes[1]).left).toBeGreaterThan(
      boxOf(sideways.nodes[0]).right
    )
    expect(boxOf(downwards.nodes[1]).top).toBeGreaterThan(
      boxOf(downwards.nodes[0]).bottom
    )
  })

  it('turns the same chain around for the two reversed directions', async () => {
    const sideways = await convertFlowChartToReactFlow(
      'flowchart RL\n  A --> B'
    )
    const upwards = await convertFlowChartToReactFlow('flowchart BT\n  A --> B')

    expect(boxOf(sideways.nodes[1]).right).toBeLessThan(
      boxOf(sideways.nodes[0]).left
    )
    expect(boxOf(upwards.nodes[1]).bottom).toBeLessThan(
      boxOf(upwards.nodes[0]).top
    )
  })
})
