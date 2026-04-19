import { Edge, Node } from '@xyflow/react'
import { resolveMermaidNodeLabel } from '../labels/basic-node-label'
import { resolveMermaidDetailedNodeLabel } from '../labels/detailed-node-label'
import {
  escapeMermaidEdgeLabelText,
  resolveMermaidEdgeLabel,
} from '../labels/edge-label'
import {
  canInlineMermaidLabel,
  escapeMermaidText,
  normalizeDetailedMermaidLabel,
} from '../utils'

export function buildMermaidNodeLines(
  graphNodes: Node[],
  nodeIdMap: Map<string, string>,
  detailedContext: boolean
): string[] {
  return graphNodes.map((node) => {
    const mappedNodeId = nodeIdMap.get(node.id) ?? node.id
    const mermaidLabel = detailedContext
      ? resolveMermaidDetailedNodeLabel(node)
      : resolveMermaidNodeLabel(node)

    if (!mermaidLabel) {
      return mappedNodeId
    }

    if (detailedContext) {
      const normalizedDetailedLabel =
        normalizeDetailedMermaidLabel(mermaidLabel)
      if (!normalizedDetailedLabel) {
        return mappedNodeId
      }
      return `${mappedNodeId}["${escapeMermaidText(normalizedDetailedLabel)}"]`
    }

    if (!canInlineMermaidLabel(mermaidLabel)) {
      return mappedNodeId
    }

    return `${mappedNodeId}["${escapeMermaidText(mermaidLabel)}"]`
  })
}

export function buildMermaidEdgeLines(
  edges: Edge[],
  nodeIdMap: Map<string, string>,
  detailedContext: boolean
): string[] {
  const mermaidEdgeLines: string[] = []

  for (const edge of edges) {
    const source = nodeIdMap.get(edge.source)
    const target = nodeIdMap.get(edge.target)
    if (!source || !target) continue

    if (detailedContext) {
      const mermaidEdgeLabel = resolveMermaidEdgeLabel(edge)
      if (mermaidEdgeLabel) {
        mermaidEdgeLines.push(
          `${source} -->|${escapeMermaidEdgeLabelText(mermaidEdgeLabel)}| ${target}`
        )
        continue
      }
    }

    mermaidEdgeLines.push(`${source} --> ${target}`)
  }

  return mermaidEdgeLines
}
