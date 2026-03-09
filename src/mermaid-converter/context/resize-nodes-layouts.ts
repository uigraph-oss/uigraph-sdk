import { Node } from '@xyflow/react'

const EXPECTED_NODE_SIZE: Record<string, { width: number; height: number }> = {
  databaseTableSQL: { width: 200, height: 400 },
  table: { width: 500, height: 400 },
}

const GROUP_BOUND_PADDING = 20
const GROUP_WIDTH_PADDING = 20
const GROUP_HEIGHT_PADDING = 50

function resolveDimension(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function getNodeSize(node: Node) {
  const expectedSize = node.type ? EXPECTED_NODE_SIZE[node.type] : undefined

  const width =
    resolveDimension(node.width) ??
    resolveDimension(node.style?.width) ??
    resolveDimension(node.measured?.width) ??
    expectedSize?.width ??
    0

  const height =
    resolveDimension(node.height) ??
    resolveDimension(node.style?.height) ??
    resolveDimension(node.measured?.height) ??
    expectedSize?.height ??
    0

  return { width, height }
}

export function resizeNodesLayouts(nodes: Node[]): Node[] {
  const snapshots = new Map(
    nodes.map((node) => {
      const size = getNodeSize(node)
      const expectedSize = node.type ? EXPECTED_NODE_SIZE[node.type] : undefined

      return [
        node.id,
        {
          node,
          position: node.position,
          size,
          expectedSize,
          overflowX: Math.max(
            0,
            size.width - (expectedSize?.width ?? size.width)
          ),
          overflowY: Math.max(
            0,
            size.height - (expectedSize?.height ?? size.height)
          ),
        },
      ]
    })
  )

  const resizedNodes = nodes.map((node) => {
    const snapshot = snapshots.get(node.id)

    if (!snapshot) {
      return node
    }

    if (
      Array.isArray(
        (node.data as { childNodes?: unknown[] } | undefined)?.childNodes
      )
    ) {
      return { ...node }
    }

    let offsetX = 0
    let offsetY = 0

    for (const source of snapshots.values()) {
      if (!source.expectedSize) {
        continue
      }

      const sourceRight = source.position.x + source.expectedSize.width
      const sourceBottom = source.position.y + source.expectedSize.height

      if (source.overflowX > 0 && snapshot.position.x >= sourceRight) {
        offsetX += source.overflowX
      }

      if (source.overflowY > 0 && snapshot.position.y >= sourceBottom) {
        offsetY += source.overflowY
      }
    }

    if (offsetX === 0 && offsetY === 0) {
      return node
    }

    return {
      ...node,
      position: {
        x: node.position.x + offsetX,
        y: node.position.y + offsetY,
      },
    }
  })

  const resizedNodesById = new Map(resizedNodes.map((node) => [node.id, node]))

  return resizedNodes.map((node) => {
    const childNodeIds = (node.data as { childNodes?: unknown[] } | undefined)
      ?.childNodes

    if (!Array.isArray(childNodeIds)) {
      return node
    }

    const childNodes = childNodeIds
      .map((childNodeId) =>
        typeof childNodeId === 'string'
          ? resizedNodesById.get(childNodeId)
          : undefined
      )
      .filter((childNode): childNode is Node => Boolean(childNode))

    if (childNodes.length === 0) {
      return node
    }

    const bounds = childNodes.map((childNode) => {
      const size = getNodeSize(childNode)

      return {
        left: childNode.position.x,
        top: childNode.position.y,
        right: childNode.position.x + size.width,
        bottom: childNode.position.y + size.height,
      }
    })

    const minX = Math.min(...bounds.map((bound) => bound.left))
    const minY = Math.min(...bounds.map((bound) => bound.top))
    const maxX = Math.max(...bounds.map((bound) => bound.right))
    const maxY = Math.max(...bounds.map((bound) => bound.bottom))

    return {
      ...node,
      position: {
        x: minX - GROUP_BOUND_PADDING,
        y: minY - GROUP_BOUND_PADDING,
      },
      style: {
        ...node.style,
        width: maxX - minX + GROUP_BOUND_PADDING * 2 + GROUP_WIDTH_PADDING,
        height: maxY - minY + GROUP_BOUND_PADDING * 2 + GROUP_HEIGHT_PADDING,
      },
    }
  })
}
