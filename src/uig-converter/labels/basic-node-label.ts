import { Node } from '@xyflow/react'
import { getFieldString, toRecord } from '../utils'

export function resolveMermaidNodeLabel(node: Node): string | undefined {
  const nodeType = node.type
  const nodeData = toRecord(node.data)
  const componentFields = Array.isArray(nodeData?.componentFields)
    ? nodeData.componentFields
        .map((field) => toRecord(field))
        .filter((field) => field !== undefined)
    : []

  const name = getFieldString(componentFields, 'Name')

  if (nodeType === 'text') return getFieldString(componentFields, 'Text')
  if (nodeType === 'code') return getFieldString(componentFields, 'Code')
  if (nodeType === 'shape') return name
  if (nodeType === 'cloud') return name
  if (nodeType === 'table') return name
  if (nodeType === 'gif') return name
  return
}
