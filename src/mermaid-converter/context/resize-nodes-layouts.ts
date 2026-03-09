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
  const resizeRules = nodes
    .map((node) => {
      if (!node.type) {
        return undefined
      }

      const expectedSize = EXPECTED_NODE_SIZE[node.type]

      if (!expectedSize) {
        return undefined
      }

      const size = getNodeSize(node)

      return {
        startX: node.position.x + expectedSize.width,
        startY: node.position.y + expectedSize.height,
        deltaX: Math.max(0, size.width - expectedSize.width),
        deltaY: Math.max(0, size.height - expectedSize.height),
      }
    })
    .filter((rule) => Boolean(rule))

  const resizedNodes = nodes.map((node) => {
    const childNodeIds = (node.data as { childNodes?: unknown[] } | undefined)
      ?.childNodes

    if (Array.isArray(childNodeIds)) {
      return { ...node }
    }

    const offsetX = resizeRules.reduce((total, rule) => {
      if (!rule || rule.deltaX === 0 || node.position.x < rule.startX) {
        return total
      }

      return total + rule.deltaX
    }, 0)

    const offsetY = resizeRules.reduce((total, rule) => {
      if (!rule || rule.deltaY === 0 || node.position.y < rule.startY) {
        return total
      }

      return total + rule.deltaY
    }, 0)

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

  const resizedNodesById = new Map(
    resizedNodes.map((node) => [node.id, node] as const)
  )

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
