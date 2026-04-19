import { Node } from '@xyflow/react'
import {
  getFieldByLabel,
  getFieldString,
  getFieldValue,
  pickString,
  toComponentFields,
  toRecord,
} from '../utils'
import { resolveMermaidNodeLabel } from './basic-node-label'

function formatDetailValue(value: unknown): string | undefined {
  if (typeof value === 'string') {
    const normalized = value.replace(/\s+/g, ' ').trim()
    if (!normalized) return
    return normalized
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  if (Array.isArray(value)) {
    const formatted = value
      .map((item) => formatDetailValue(item))
      .filter((item) => item !== undefined)
    if (formatted.length === 0) return
    return formatted.join(',')
  }

  const valueRecord = toRecord(value)
  if (valueRecord) {
    const entries = Object.entries(valueRecord)
      .slice(0, 2)
      .map(([key, item]) => {
        const formatted = formatDetailValue(item)
        if (!formatted) return
        return `${key}:${formatted}`
      })
      .filter((entry) => entry !== undefined)

    if (entries.length === 0) return
    return entries.join(',')
  }
}

function getFieldDetailPart(
  fields: Record<string, unknown>[],
  label: string
): string | undefined {
  const field = getFieldByLabel(fields, label)
  if (!field) return

  const value = formatDetailValue(getFieldValue(field.data))
  const options = Array.isArray(field.options)
    ? field.options.filter((option) => typeof option === 'string')
    : []

  if (!value && options.length === 0) return
  if (value && options.length > 0)
    return `${label}:${value} [${options.join('/')}]`
  if (value) return `${label}:${value}`
  return `${label}:[${options.join('/')}]`
}

function getNodeName(
  nodeData: Record<string, unknown> | undefined,
  componentFields: Record<string, unknown>[]
): string | undefined {
  return getFieldString(componentFields, 'Name') ?? pickString(nodeData?.name)
}

export function resolveMermaidDetailedNodeLabel(
  node: Node
): string | undefined {
  const nodeType = pickString(node.type)
  const nodeData = toRecord(node.data)
  const componentFields = toComponentFields(nodeData?.componentFields)
  const name = getNodeName(nodeData, componentFields)

  if (nodeType === 'text') {
    return getFieldString(componentFields, 'Text')
  }

  if (nodeType === 'code') {
    const code = getFieldString(componentFields, 'Code')
    if (!code) return
    const firstLine = code.split(/\r?\n/)[0]?.trim()
    if (!firstLine) return
    return firstLine
  }

  if (nodeType === 'data-source') {
    const parts: string[] = []
    if (name) parts.push(name)

    const serviceTable = toRecord(nodeData?.serviceTable)
    const dbConfig = toRecord(nodeData?.dbConfig)
    const database =
      pickString(serviceTable?.serviceDbId) ?? pickString(dbConfig?.database)
    const tableName =
      pickString(serviceTable?.tableName) ?? pickString(dbConfig?.tableName)
    const dbService =
      pickString(serviceTable?.serviceId) ?? pickString(dbConfig?.service)

    if (database && tableName) {
      parts.push(`db:${database}.${tableName}`)
    }

    if (dbService) {
      parts.push(`service:${dbService}`)
    }

    if (parts.length === 0) return
    return parts.join(' | ')
  }

  if (nodeType === 'cloud') {
    const parts: string[] = []
    if (name) parts.push(name)

    const cloud = pickString(nodeData?.cloud)
    if (cloud) parts.push(`cloud:${cloud}`)

    const service = pickString(nodeData?.service)
    if (service) parts.push(`service:${service}`)

    const operationalFieldLabels = ['Runtime', 'Tier', 'Region']
    for (const label of operationalFieldLabels) {
      const detail = getFieldDetailPart(componentFields, label)
      if (detail) parts.push(detail)
    }

    if (parts.length === 0) return
    return parts.join(' | ')
  }

  if (nodeType === 'table') {
    const parts: string[] = []
    if (name) parts.push(name)

    const columns = Array.isArray(nodeData?.columns)
      ? nodeData.columns.filter((value) => typeof value === 'string').length
      : 0
    const rows = Array.isArray(nodeData?.rows)
      ? nodeData.rows.filter((value) => Array.isArray(value)).length
      : 0
    if (columns > 0 || rows > 0) {
      parts.push(`table:${columns}c/${rows}r`)
    }

    if (parts.length === 0) return
    return parts.join(' | ')
  }

  if (nodeType === 'shape') {
    const parts: string[] = []
    if (name) parts.push(name)

    const shape = pickString(nodeData?.shape)
    if (shape) parts.push(`shape:${shape}`)

    if (parts.length === 0) return
    return parts.join(' | ')
  }

  if (nodeType === 'gif') {
    return name
  }

  if (nodeType === 'builder') {
    const parts: string[] = []
    if (name) parts.push(name)

    const builderFieldLabels = [
      'Service Type',
      'API Version',
      'Runtime',
      'Timeout (ms)',
      'Retry Attempts',
      'Region',
      'Tier',
      'Environment',
    ]

    for (const label of builderFieldLabels) {
      const detail = getFieldDetailPart(componentFields, label)
      if (detail) parts.push(detail)
    }

    if (parts.length === 0) return
    return parts.join(' | ')
  }

  const baseLabel = resolveMermaidNodeLabel(node)
  if (baseLabel) return baseLabel

  const fallbackLabel = pickString(nodeData?.label)
  if (fallbackLabel) return fallbackLabel
  return
}
