import { Edge } from '@xyflow/react'
import {
  normalizeMarker,
  parseStrokeStyle,
  pickString,
  toRecord,
} from '../utils'

export function escapeMermaidEdgeLabelText(value: string): string {
  return value.replaceAll('|', '/').replace(/\s+/g, ' ').trim()
}

export function resolveMermaidEdgeLabel(edge: Edge): string | undefined {
  const parts: string[] = []
  const edgeLabel = pickString(edge.label)
  if (edgeLabel) parts.push(edgeLabel)

  const edgeStyle = toRecord(edge.style) ?? {}
  const explicitStrokeStyle = pickString(edgeStyle.strokeStyle)
  if (
    explicitStrokeStyle === 'solid' ||
    explicitStrokeStyle === 'dashed' ||
    explicitStrokeStyle === 'dotted'
  ) {
    parts.push(explicitStrokeStyle)
  } else {
    const strokeStyle = parseStrokeStyle(edgeStyle.strokeDasharray)
    if (strokeStyle) parts.push(strokeStyle)
  }

  if (typeof edge.animated === 'boolean' && edge.animated) {
    parts.push('animated')
  }

  const markerStart = normalizeMarker(edge.markerStart)
  if (markerStart?.color)
    parts.push(`start:${markerStart.type}@${markerStart.color}`)
  else if (markerStart) parts.push(`start:${markerStart.type}`)

  const markerEnd = normalizeMarker(edge.markerEnd)
  if (markerEnd?.color) parts.push(`end:${markerEnd.type}@${markerEnd.color}`)
  else if (markerEnd) parts.push(`end:${markerEnd.type}`)

  if (parts.length === 0) return
  return parts.join(' | ')
}
