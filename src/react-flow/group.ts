import { Node } from '@xyflow/react'
import { ComponentInputType } from '../components/component-type'

const BOUND_PADDING = 20

export function createGroupNode(
  id: string,
  nodes: string[],
  bounds: { x: number; y: number; width: number; height: number }
): Node {
  return {
    id,
    type: 'group',
    position: { x: bounds.x, y: bounds.y },
    data: {
      childNodes: nodes,
      componentFields: [
        {
          componentFieldId: 'name',
          type: ComponentInputType.TextInput,
          label: 'Name',
          isReadonly: true,
          data: [{ value: 'Group' }],
        },
        {
          componentFieldId: 'label',
          type: ComponentInputType.TextInput,
          label: 'Label',
          data: [{ value: 'DEV' }],
        },
      ],
    },

    style: {
      width: bounds.width + 20,
      height: bounds.height + 50,
    },
  }
}

export function generateGroupNodeFromNodes(id: string, nodes: Node[]) {
  const bounds = nodes.map((node) => ({
    top: node.position.y,
    left: node.position.x,

    bottom: node.position.y + (node.height ?? 0),
    right: node.position.x + (node.width ?? 0),
  }))

  const minX = Math.min(...bounds.map((b) => b.left))
  const minY = Math.min(...bounds.map((b) => b.top))
  const maxX = Math.max(...bounds.map((b) => b.right))
  const maxY = Math.max(...bounds.map((b) => b.bottom))

  return createGroupNode(
    id,
    nodes.map((node) => node.id),
    {
      x: minX - BOUND_PADDING,
      y: minY - BOUND_PADDING,
      width: maxX - minX + BOUND_PADDING * 2,
      height: maxY - minY + BOUND_PADDING * 2,
    }
  )
}
