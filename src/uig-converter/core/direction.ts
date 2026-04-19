import { Edge, Node } from '@xyflow/react'

export function inferDirection(nodes: Node[], edges: Edge[]): 'LR' | 'TB' {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]))
  let horizontalWeight = 0
  let verticalWeight = 0
  let weightedEdges = 0

  for (const edge of edges) {
    const sourceNode = nodeMap.get(edge.source)
    const targetNode = nodeMap.get(edge.target)
    if (!sourceNode || !targetNode) continue

    horizontalWeight += Math.abs(targetNode.position.x - sourceNode.position.x)
    verticalWeight += Math.abs(targetNode.position.y - sourceNode.position.y)
    weightedEdges += 1
  }

  if (weightedEdges > 0) {
    return horizontalWeight >= verticalWeight ? 'LR' : 'TB'
  }

  const xs = nodes.map((node) => node.position.x)
  const ys = nodes.map((node) => node.position.y)
  const width = Math.max(...xs, 0) - Math.min(...xs, 0)
  const height = Math.max(...ys, 0) - Math.min(...ys, 0)
  return width >= height ? 'LR' : 'TB'
}
