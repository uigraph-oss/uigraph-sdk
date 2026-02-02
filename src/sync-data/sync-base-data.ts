import { ReactFlowData } from '@/types'

type Options = {
  keepPrev?: boolean
}

export function syncBaseData(
  prev: ReactFlowData,
  next: ReactFlowData,
  options?: Options
): ReactFlowData {
  const updated = {
    nodes: next.nodes.map((nextNode) => {
      const prevNode = prev.nodes.find((n) => n.id === nextNode.id)
      if (!prevNode) return nextNode

      return {
        ...prevNode,
        ...nextNode,
        data: {
          ...prevNode.data,
          ...nextNode.data,
          componentFields: [
            ...(prevNode.data?.componentFields ?? []),
            ...(nextNode.data?.componentFields ?? []),
          ],
        },
      }
    }),

    edges: next.edges.map((nextEdge) => {
      const prevEdge = prev.edges.find((e) => e.id === nextEdge.id)
      if (!prevEdge) return nextEdge

      return {
        ...prevEdge,
        ...nextEdge,
        data: {
          ...prevEdge.data,
          ...nextEdge.data,
          componentFields: [
            ...(prevEdge.data?.componentFields ?? []),
            ...(nextEdge.data?.componentFields ?? []),
          ],
        },
      }
    }),
  }

  if (options?.keepPrev) {
    updated.nodes = [
      ...prev.nodes.filter((n) => !updated.nodes.some((n2) => n2.id === n.id)),
      ...updated.nodes,
    ]

    updated.edges = [
      ...prev.edges.filter((e) => !updated.edges.some((e2) => e2.id === e.id)),
      ...updated.edges,
    ]
  }

  return updated
}
