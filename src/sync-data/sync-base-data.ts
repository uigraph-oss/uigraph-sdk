import { ReactFlowData } from '@/types'

export function syncBaseData(
  baseReactFlowData: ReactFlowData,
  newReactFlowData: ReactFlowData
): ReactFlowData {
  return {
    nodes: baseReactFlowData.nodes.map((node) => {
      const newNode = newReactFlowData.nodes.find((n) => n.id === node.id)
      if (!newNode) return node

      return { ...newNode, data: { ...node.data, ...newNode.data } }
    }),

    edges: baseReactFlowData.edges.map((edge) => {
      const newEdge = newReactFlowData.edges.find((e) => e.id === edge.id)
      if (!newEdge) return edge

      return { ...newEdge, data: { ...edge.data, ...newEdge.data } }
    }),
  }
}
