import { Edge } from '@xyflow/react'
import z from 'zod'
import { contextSchema } from '../../headless'
import {
  normalizeMarker,
  parseStrokeStyle,
  pickString,
  toRecord,
} from '../utils'

export function buildContextEdges(
  edges: Edge[],
  nodeIdMap: Map<string, string>
): NonNullable<z.infer<typeof contextSchema>['edges']> {
  const contextEdges: NonNullable<z.infer<typeof contextSchema>['edges']> = {}

  /**
   * A diagram can hold several edges between the same pair of nodes, so the
   * pair alone is not a key. The first edge of a pair keys on the bare pair and
   * the rest take their position as a suffix, which the importer recomputes
   * from the same edge order.
   */
  const ordinals = new Map<string, number>()

  for (const edge of edges) {
    const source = nodeIdMap.get(edge.source)
    const target = nodeIdMap.get(edge.target)
    if (!source || !target) continue

    const pair = `${source}-${target}`
    const ordinal = ordinals.get(pair) ?? 0
    ordinals.set(pair, ordinal + 1)

    const edgeContext: NonNullable<
      z.infer<typeof contextSchema>['edges']
    >[string] = {}

    const edgeType = pickString(edge.type)
    if (edgeType) edgeContext.type = edgeType

    const sourceHandle = pickString(edge.sourceHandle)
    if (sourceHandle) edgeContext.sourceHandle = sourceHandle

    const targetHandle = pickString(edge.targetHandle)
    if (targetHandle) edgeContext.targetHandle = targetHandle

    const edgeLabel = pickString(edge.label)
    if (edgeLabel) edgeContext.label = edgeLabel
    const edgeStyleRecord = toRecord(edge.style) ?? {}
    const edgeStyle: NonNullable<typeof edgeContext.style> = {}

    const stroke = pickString(edgeStyleRecord.stroke)
    if (stroke) edgeStyle.stroke = stroke

    if (typeof edgeStyleRecord.strokeWidth === 'number') {
      edgeStyle.strokeWidth = edgeStyleRecord.strokeWidth
    }

    const strokeStyle = parseStrokeStyle(edgeStyleRecord.strokeDasharray)
    if (strokeStyle) edgeStyle.strokeStyle = strokeStyle

    if (typeof edge.animated === 'boolean') {
      edgeStyle.borderAnimationEnabled = edge.animated
    }

    if (Object.keys(edgeStyle).length > 0) {
      edgeContext.style = edgeStyle
    }

    const markerStart = normalizeMarker(edge.markerStart)
    if (markerStart) edgeContext.markerStart = markerStart

    const markerEnd = normalizeMarker(edge.markerEnd)
    if (markerEnd) edgeContext.markerEnd = markerEnd

    const edgeData = toRecord(edge.data) ?? {}
    if (Object.keys(edgeData).length > 0) {
      edgeContext.___internal = edgeData
    }

    if (Object.keys(edgeContext).length > 0) {
      if (ordinal === 0) contextEdges[pair] = edgeContext
      else contextEdges[`${pair}#${ordinal}`] = edgeContext
    }
  }

  return contextEdges
}
