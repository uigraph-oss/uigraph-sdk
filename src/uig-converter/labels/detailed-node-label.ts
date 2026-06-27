import { Node } from '@xyflow/react'
import { ComponentInputType } from '../../components/component-type'
import {
  getFieldString,
  getFieldValue,
  isComponentInputType,
  pickString,
  toComponentFields,
  toRecord,
} from '../utils'
import { resolveMermaidNodeLabel } from './basic-node-label'

function formatInlineRichTextSegment(
  text: string,
  attributes: Record<string, unknown> | undefined
): string {
  const trimmed = text.trim()
  if (!trimmed) return ''

  let output = trimmed

  const link = pickString(attributes?.link)
  if (attributes?.code === true) {
    output = `\`${output}\``
  }
  if (attributes?.bold === true) {
    output = `**${output}**`
  }
  if (link) {
    output = `[${output}](${link})`
  }

  return output
}

function collectQuillOps(value: unknown): Record<string, unknown>[] {
  const ops: Record<string, unknown>[] = []

  function visit(input: unknown): void {
    if (!input) return

    if (Array.isArray(input)) {
      for (const item of input) visit(item)
      return
    }

    const record = toRecord(input)
    if (!record) return

    if (Array.isArray(record.ops)) {
      visit(record.ops)
      return
    }

    if ('insert' in record) {
      ops.push(record)
      return
    }

    if ('value' in record) {
      visit(record.value)
    }
  }

  visit(value)
  return ops
}

function formatQuillRichTextAsMarkdown(value: unknown): string | undefined {
  const ops = collectQuillOps(value)
  if (ops.length === 0) return

  const lines: string[] = []
  let currentLine = ''

  for (const op of ops) {
    const insert = op.insert
    if (typeof insert !== 'string') continue

    const attributes = toRecord(op.attributes)
    const parts = insert.split('\n')

    for (let index = 0; index < parts.length; index += 1) {
      const part = parts[index]
      if (part) {
        const formattedPart = formatInlineRichTextSegment(part, attributes)
        if (formattedPart) {
          if (currentLine) currentLine += ' '
          currentLine += formattedPart
        }
      }

      const endsLine = index < parts.length - 1
      if (!endsLine) continue

      const normalizedLine = currentLine.replace(/\s+/g, ' ').trim()
      if (normalizedLine) {
        if (attributes?.list === 'bullet' || attributes?.list === 'ordered') {
          lines.push(`- ${normalizedLine}`)
        } else {
          lines.push(normalizedLine)
        }
      }
      currentLine = ''
    }
  }

  const trailingLine = currentLine.replace(/\s+/g, ' ').trim()
  if (trailingLine) lines.push(trailingLine)

  if (lines.length === 0) return
  return lines.join('\n')
}

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

function getNodeName(
  nodeData: Record<string, unknown> | undefined,
  componentFields: Record<string, unknown>[]
): string | undefined {
  return getFieldString(componentFields, 'Name') ?? pickString(nodeData?.name)
}

function buildFieldLines(
  componentFields: Record<string, unknown>[],
  excludedLabels: Set<string>
): string[] {
  const lines: string[] = []

  for (const field of componentFields) {
    const label = pickString(field.label)
    const type = pickString(field.type)
    if (!label || !type || !isComponentInputType(type)) continue
    if (excludedLabels.has(label.toLowerCase())) continue

    const rawValue = getFieldValue(field.data)
    const value =
      type === ComponentInputType.RichTextEditor
        ? formatQuillRichTextAsMarkdown(rawValue)
        : formatDetailValue(rawValue)
    const options = Array.isArray(field.options)
      ? field.options.filter((option) => typeof option === 'string')
      : []

    if (!value && options.length === 0) continue
    if (value && options.length > 0) {
      lines.push(`${label}: ${value} [${options.join('/')}]`)
      continue
    }
    if (value) {
      lines.push(`${label}: ${value}`)
      continue
    }
    lines.push(`${label}: [${options.join('/')}]`)
  }

  return lines
}

function buildDetailedLabel(lines: string[]): string | undefined {
  const compact = lines
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
  if (compact.length === 0) return
  return compact.join('\n')
}

export function resolveMermaidDetailedNodeLabel(
  node: Node
): string | undefined {
  const nodeType = pickString(node.type)
  const nodeData = toRecord(node.data)
  const componentFields = toComponentFields(nodeData?.componentFields)
  const name = getNodeName(nodeData, componentFields)

  if (nodeType === 'text') {
    const text =
      getFieldString(componentFields, 'Text') ?? pickString(nodeData?.value)
    const lines = [
      text ? `Text: ${text}` : 'Text',
      ...buildFieldLines(componentFields, new Set(['name', 'text'])),
    ]
    return buildDetailedLabel(lines)
  }

  if (nodeType === 'code') {
    const code =
      getFieldString(componentFields, 'Code') ?? pickString(nodeData?.value)
    const firstLine = code?.split(/\r?\n/)[0]?.trim()
    const lines = [
      firstLine ? `Code: ${firstLine}` : 'Code',
      ...buildFieldLines(componentFields, new Set(['name', 'code'])),
    ]
    return buildDetailedLabel(lines)
  }

  if (nodeType === 'data-source' || nodeType === 'databaseTableSQL') {
    const lines: string[] = []

    const serviceTable = toRecord(nodeData?.serviceTable)
    const dbConfig = toRecord(nodeData?.dbConfig)
    const database =
      pickString(serviceTable?.databaseName) ??
      pickString(dbConfig?.databaseName)
    const tableName =
      pickString(serviceTable?.tableName) ?? pickString(dbConfig?.tableName)
    const dbService =
      pickString(serviceTable?.serviceName) ?? pickString(dbConfig?.serviceName)

    const dataSourceName = name ?? tableName
    lines.push(dataSourceName ? `DataSource: ${dataSourceName}` : 'DataSource')

    if (database && tableName) {
      lines.push(`db: ${database}.${tableName}`)
    }

    if (dbService) {
      lines.push(`service: ${dbService}`)
    }

    lines.push(...buildFieldLines(componentFields, new Set(['name'])))
    return buildDetailedLabel(lines)
  }

  if (nodeType === 'cloud') {
    const lines: string[] = []
    lines.push(name ? `Cloud: ${name}` : 'Cloud')

    const cloud = pickString(nodeData?.cloud)
    if (cloud) lines.push(`provider: ${cloud}`)

    const service = pickString(nodeData?.service)
    if (service) lines.push(`service: ${service}`)

    lines.push(...buildFieldLines(componentFields, new Set(['name'])))
    return buildDetailedLabel(lines)
  }

  if (nodeType === 'table' || nodeType === 'dataTableInterface') {
    const lines: string[] = []

    const table = toRecord(nodeData?.table)
    const tableName = pickString(table?.name) ?? name
    lines.push(tableName ? `Table: ${tableName}` : 'Table')

    const columns = Array.isArray(nodeData?.columns)
      ? nodeData.columns.filter((value) => typeof value === 'string').length
      : Array.isArray(table?.columns)
        ? table.columns.length
        : 0
    const rows = Array.isArray(nodeData?.rows)
      ? nodeData.rows.filter((value) => Array.isArray(value)).length
      : Array.isArray(table?.rows)
        ? table.rows.length
        : 0

    lines.push(`columns: ${columns}`)
    lines.push(`rows: ${rows}`)

    lines.push(...buildFieldLines(componentFields, new Set(['name'])))
    return buildDetailedLabel(lines)
  }

  if (nodeType === 'shape') {
    const fieldLines = buildFieldLines(componentFields, new Set())
    if (fieldLines.length > 0) return buildDetailedLabel(fieldLines)
    if (name) return `Name: ${name}`
    return
  }

  if (nodeType === 'gif') {
    const src = pickString(nodeData?.src)
    const lines = [
      name ? `Gif: ${name}` : src ? `Gif: ${src}` : 'Gif',
      ...(src ? [`src: ${src}`] : []),
      ...buildFieldLines(componentFields, new Set(['name'])),
    ]
    return buildDetailedLabel(lines)
  }

  if (nodeType === 'image') {
    const src = pickString(nodeData?.src)
    const lines = [
      name ? `Image: ${name}` : src ? `Image: ${src}` : 'Image',
      ...(src ? [`src: ${src}`] : []),
      ...buildFieldLines(componentFields, new Set(['name'])),
    ]
    return buildDetailedLabel(lines)
  }

  if (nodeType === 'group') {
    const childCount = Array.isArray(nodeData?.childNodes)
      ? nodeData.childNodes.length
      : 0
    const lines = [
      name ? `Group: ${name}` : 'Group',
      `children: ${childCount}`,
      ...buildFieldLines(componentFields, new Set(['name'])),
    ]
    return buildDetailedLabel(lines)
  }

  if (nodeType === 'sequenceParticipant') {
    const label =
      getFieldString(componentFields, 'Label') ?? pickString(nodeData?.label)
    const participantName = name ?? label
    const rowCount =
      typeof nodeData?.rowCount === 'number' ? nodeData.rowCount : undefined
    const color =
      getFieldString(componentFields, 'Color') ?? pickString(nodeData?.color)
    const lines = [
      participantName
        ? `SequenceParticipant: ${participantName}`
        : 'SequenceParticipant',
      ...(typeof rowCount === 'number' ? [`rows: ${rowCount}`] : []),
      ...(color ? [`color: ${color}`] : []),
      ...buildFieldLines(componentFields, new Set(['name', 'label', 'color'])),
    ]
    return buildDetailedLabel(lines)
  }

  if (nodeType === 'comment') {
    const isResolved =
      typeof nodeData?.isResolved === 'boolean'
        ? nodeData.isResolved
        : undefined
    const lines = [
      `Comment: ${isResolved ? 'Resolved' : 'Open'}`,
      ...buildFieldLines(componentFields, new Set(['name'])),
    ]
    return buildDetailedLabel(lines)
  }

  if (nodeType === 'builder') {
    const componentId = pickString(nodeData?.componentId)
    const lines = [
      name ? `Builder: ${name}` : 'Builder',
      ...(componentId ? [`componentId: ${componentId}`] : []),
      ...buildFieldLines(componentFields, new Set(['name'])),
    ]
    return buildDetailedLabel(lines)
  }

  const baseLabel = resolveMermaidNodeLabel(node)
  if (baseLabel) {
    const nodeTypeLabel = nodeType
      ? nodeType.charAt(0).toUpperCase() + nodeType.slice(1)
      : 'Node'
    const lines = [`${nodeTypeLabel}: ${baseLabel}`]
    lines.push(
      ...buildFieldLines(componentFields, new Set(['name', 'text', 'code']))
    )
    return buildDetailedLabel(lines)
  }

  const fallbackLabel = pickString(nodeData?.label)
  if (fallbackLabel) {
    const nodeTypeLabel = nodeType
      ? nodeType.charAt(0).toUpperCase() + nodeType.slice(1)
      : 'Node'
    return `${nodeTypeLabel}: ${fallbackLabel}`
  }
  return
}
