import { Edge } from '@xyflow/react'
import { pickString } from '../utils'

export function escapeMermaidEdgeLabelText(value: string): string {
  return value.replaceAll('|', '/').replace(/\s+/g, ' ').trim()
}

export function resolveMermaidEdgeLabel(edge: Edge): string | undefined {
  return pickString(edge.label)
}
