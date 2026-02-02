import { ReactFlowData } from '@/types'
import { mergeComponentFields } from './helpers'

type Options = {
  keepPrev?: boolean
  includeNodePositions?: boolean
  includeNodeDimensions?: boolean
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

        width: options?.includeNodeDimensions
          ? (prevNode.width ?? nextNode.width)
          : nextNode.width,

        height: options?.includeNodeDimensions
          ? (prevNode.height ?? nextNode.height)
          : nextNode.height,

        position: options?.includeNodePositions
          ? (prevNode.position ?? nextNode.position)
          : nextNode.position,

        data: {
          ...prevNode.data,
          ...nextNode.data,
          componentFields: mergeComponentFields(
            prevNode.data?.componentFields,
            nextNode.data?.componentFields
          ),
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
          componentFields: mergeComponentFields(
            prevEdge.data?.componentFields,
            nextEdge.data?.componentFields
          ),
        },
      }
    }),
  }

  if (options?.keepPrev) {
    const missingNodes = prev.nodes.filter((n) => {
      if (n.data?.source === 'mermaid') return false
      return !updated.nodes.some((n2) => n2.id === n.id)
    })

    const missingEdges = prev.edges.filter((e) => {
      if (e.data?.source === 'mermaid') return false
      return !updated.edges.some((e2) => e2.id === e.id)
    })

    updated.nodes = [...missingNodes, ...updated.nodes]
    updated.edges = [...missingEdges, ...updated.edges]
  }

  return updated
}
