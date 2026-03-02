import { Node } from '@xyflow/react'
import { generateUUID } from 'daily-code'
import { generateComponentFieldNameInput } from '../components/component-field'

const BOUND_PADDING = 20

type GroupNodeOptions = {
  id?: string
  name?: string
  nodes: string[]
  bounds: { x: number; y: number; width: number; height: number }
}

export function createGroupNode(options: GroupNodeOptions): Node {
  return {
    id: options.id ?? generateUUID(),
    type: 'group',
    position: { x: options.bounds.x, y: options.bounds.y },

    data: {
      childNodes: options.nodes,
      componentFields: [
        generateComponentFieldNameInput(options.name ?? 'Group'),
      ],
    },

    style: {
      width: options.bounds.width + 20,
      height: options.bounds.height + 50,
    },
  }
}

export function generateGroupNodeFromNodes(
  id: string,
  name: string,
  nodes: Node[]
) {
  const bounds = nodes.map((node) => ({
    top: node.position.y,
    left: node.position.x,

    bottom:
      node.position.y +
      (node.height ?? node.style?.height ?? node.measured?.height ?? 0),

    right:
      node.position.x +
      (node.width ?? node.style?.width ?? node.measured?.width ?? 0),
  }))

  const minX = Math.min(...bounds.map((b) => b.left))
  const minY = Math.min(...bounds.map((b) => b.top))
  const maxX = Math.max(...bounds.map((b) => b.right))
  const maxY = Math.max(...bounds.map((b) => b.bottom))

  return createGroupNode({
    id,
    name,
    nodes: nodes.map((node) => node.id),
    bounds: {
      x: minX - BOUND_PADDING,
      y: minY - BOUND_PADDING,
      width: maxX - minX + BOUND_PADDING * 2,
      height: maxY - minY + BOUND_PADDING * 2,
    },
  })
}
