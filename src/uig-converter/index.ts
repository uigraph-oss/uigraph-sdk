import { Edge, Node } from '@xyflow/react'
import z from 'zod'
import { ComponentInputType } from '../components/component-type'
import { contextSchema } from '../headless'

type UiGraphInput = {
  nodes: Node[]
  edges: Edge[]
}

type UigOutput = {
  mermaid: string
  context: z.infer<typeof contextSchema>
}

const CONTEXT_SHAPES = new Set([
  'rectangle',
  'rounded-rect',
  'ellipse',
  'diamond',
  'triangle',
  'parallelogram',
  'trapezoid',
  'hexagon',
  'document',
  'cylinder',
  'delay',
  'off-page-connector',
  'display',
  'collate',
  'sort',
  'terminator',
  'or',
  'database',
  'multiple-documents',
  'subroutine',
  'manual-input',
  'summing-junction',
  'internal-storage',
])

const COMPONENT_INPUT_TYPES = new Set(Object.values(ComponentInputType))

function isComponentInputType(value: string): value is ComponentInputType {
  return COMPONENT_INPUT_TYPES.has(value as ComponentInputType)
}

const KNOWN_NODE_DATA_KEYS = new Set([
  'componentFields',
  'shape',
  'fill',
  'stroke',
  'strokeWidth',
  'strokeStyle',
  'borderRadius',
  'borderAnimationEnabled',
  'strokeAnimation',
  'src',
  'animatedIcon',
  'iconSrc',
  'componentId',
  'serviceTable',
  'title',
  'columns',
  'rows',
  'name',
  'label',
  'value',
  'cloud',
  'service',
  'childNodes',
])

function toRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return
  return value as Record<string, unknown>
}

function pickString(value: unknown): string | undefined {
  if (typeof value !== 'string') return
  const trimmed = value.trim()
  if (!trimmed) return
  return trimmed
}

function getFieldValue(fieldData: unknown): unknown {
  if (!Array.isArray(fieldData) || fieldData.length !== 1) return fieldData
  const first = toRecord(fieldData[0])
  if (!first) return fieldData
  if (!('value' in first)) return fieldData
  return first.value
}

function getFieldByLabel(
  fields: Record<string, unknown>[],
  label: string
): Record<string, unknown> | undefined {
  return fields.find(
    (field) =>
      pickString(field.label)?.toLowerCase() === label.toLowerCase() &&
      pickString(field.type)
  )
}

function getFieldString(
  fields: Record<string, unknown>[],
  label: string
): string | undefined {
  const field = getFieldByLabel(fields, label)
  if (!field) return
  return pickString(getFieldValue(field.data))
}

function parseStrokeStyle(
  dashArray: unknown
): 'solid' | 'dashed' | 'dotted' | undefined {
  if (typeof dashArray !== 'string' || !dashArray.trim()) return
  const normalized = dashArray.replaceAll(',', ' ').replace(/\s+/g, ' ').trim()
  if (normalized === '1 2') return 'dotted'
  if (normalized === '4 2' || normalized === '4 4' || normalized === '8 4') {
    return 'dashed'
  }
  return 'solid'
}

function normalizeMarker(
  marker: unknown
): { type: string; color?: string } | undefined {
  if (typeof marker === 'string') {
    return { type: marker }
  }

  const markerRecord = toRecord(marker)
  if (!markerRecord) return
  const type = pickString(markerRecord.type)
  if (!type) return

  const color = pickString(markerRecord.color)
  if (color) return { type, color }
  return { type }
}

function sanitizeMermaidId(
  sourceId: string,
  fallbackIndex: number,
  used: Set<string>
): string {
  let baseId = sourceId.replace(/[^A-Za-z0-9_]/g, '_')
  if (!baseId) baseId = `N${fallbackIndex + 1}`
  if (/^\d/.test(baseId)) baseId = `N_${baseId}`

  if (!used.has(baseId)) {
    used.add(baseId)
    return baseId
  }

  let index = 2
  let candidate = `${baseId}_${index}`
  while (used.has(candidate)) {
    index += 1
    candidate = `${baseId}_${index}`
  }

  used.add(candidate)
  return candidate
}

function inferDirection(nodes: Node[], edges: Edge[]): 'LR' | 'TB' {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]))
  let horizontalWeight = 0
  let verticalWeight = 0
  let weightedEdges = 0

  for (const edge of edges) {
    const sourceNode = nodeMap.get(edge.source)
    const targetNode = nodeMap.get(edge.target)
    if (!sourceNode || !targetNode) continue

    horizontalWeight += Math.abs(targetNode.position.x - sourceNode.position.x)
    verticalWeight += Math.abs(targetNode.position.y - sourceNode.position.y)
    weightedEdges += 1
  }

  if (weightedEdges > 0) {
    return horizontalWeight >= verticalWeight ? 'LR' : 'TB'
  }

  const xs = nodes.map((node) => node.position.x)
  const ys = nodes.map((node) => node.position.y)
  const width = Math.max(...xs, 0) - Math.min(...xs, 0)
  const height = Math.max(...ys, 0) - Math.min(...ys, 0)
  return width >= height ? 'LR' : 'TB'
}

function escapeMermaidText(value: string): string {
  return value.replaceAll('"', '\\"').replaceAll('\n', ' ')
}

function wrapNodeLabel(label: string, node: Node): string {
  const data = toRecord(node.data) ?? {}
  const shape = pickString(data.shape)
  const escaped = escapeMermaidText(label)

  if (node.type === 'shape' && shape === 'rounded-rect') {
    return `(\"${escaped}\")`
  }

  if (node.type === 'shape' && shape === 'ellipse') {
    return `((\"${escaped}\"))`
  }

  if (node.type === 'shape' && shape === 'diamond') {
    return `{\"${escaped}\"}`
  }

  if (node.type === 'shape' && shape === 'terminator') {
    return `([\"${escaped}\"])`
  }

  return `[\"${escaped}\"]`
}

function resolveNodeLabel(
  node: Node,
  fields: Record<string, unknown>[]
): string {
  const data = toRecord(node.data) ?? {}

  const fieldName = getFieldString(fields, 'Name')
  if (fieldName) return fieldName

  if (node.type === 'text') {
    const textValue = getFieldString(fields, 'Text')
    if (textValue) return textValue
  }

  if (node.type === 'code') {
    const codeValue = getFieldString(fields, 'Code')
    if (codeValue) return codeValue
  }

  return node.id
}

export function convertUiGraphToMermaid(input: UiGraphInput): UigOutput {
  const groupNodes = input.nodes.filter((node) => node.type === 'group')
  const graphNodes = input.nodes.filter((node) => node.type !== 'group')
  const direction = inferDirection(graphNodes, input.edges)

  const usedMermaidIds = new Set<string>()
  const nodeIdMap = new Map<string, string>()

  graphNodes.forEach((node, index) => {
    nodeIdMap.set(node.id, sanitizeMermaidId(node.id, index, usedMermaidIds))
  })

  const mermaidNodeLines = graphNodes.map((node) => {
    const mappedNodeId = nodeIdMap.get(node.id) ?? node.id
    const nodeData = toRecord(node.data)
    const componentFields = Array.isArray(nodeData?.componentFields)
      ? nodeData.componentFields
          .map((field) => toRecord(field))
          .filter((field) => field !== undefined)
      : []

    const label = resolveNodeLabel(node, componentFields)
    const wrappedLabel = wrapNodeLabel(label, node)
    return `${mappedNodeId}${wrappedLabel}`
  })

  const contextNodes: NonNullable<z.infer<typeof contextSchema>['nodes']> = {}

  for (const node of graphNodes) {
    const mappedNodeId = nodeIdMap.get(node.id)
    if (!mappedNodeId) continue

    const nodeData = toRecord(node.data) ?? {}
    const nodeStyle = toRecord(node.style) ?? {}
    const componentFields = Array.isArray(nodeData.componentFields)
      ? nodeData.componentFields
          .map((field) => toRecord(field))
          .filter((field) => field !== undefined)
      : []

    const nodeContext: NonNullable<
      z.infer<typeof contextSchema>['nodes']
    >[string] = {}

    const nodeType = pickString(node.type)
    if (nodeType) nodeContext.type = nodeType

    const name = getFieldString(componentFields, 'Name')
    if (name) nodeContext.name = name

    if (nodeType === 'text') {
      const textValue = getFieldString(componentFields, 'Text')
      if (textValue) nodeContext.value = textValue
    }

    if (nodeType === 'code') {
      const codeValue = getFieldString(componentFields, 'Code')
      if (codeValue) nodeContext.value = codeValue
    }

    const src = pickString(nodeData.src)
    if (src) nodeContext.src = src

    const animatedIcon = pickString(nodeData.animatedIcon)
    if (animatedIcon) nodeContext.animatedIcon = animatedIcon

    const cloud = pickString(nodeData.cloud)
    if (cloud) nodeContext.cloud = cloud

    const service = pickString(nodeData.service)
    if (service) nodeContext.service = service

    const componentId = pickString(nodeData.componentId)
    if (componentId) nodeContext.componentId = componentId

    const shape = pickString(nodeData.shape)
    if (shape && CONTEXT_SHAPES.has(shape)) {
      nodeContext.shape = shape as NonNullable<typeof nodeContext.shape>
    }

    const style: NonNullable<typeof nodeContext.style> = {}
    const width =
      typeof node.width === 'number'
        ? node.width
        : typeof nodeStyle.width === 'number'
          ? nodeStyle.width
          : undefined
    if (typeof width === 'number') style.width = width

    const height =
      typeof node.height === 'number'
        ? node.height
        : typeof nodeStyle.height === 'number'
          ? nodeStyle.height
          : undefined
    if (typeof height === 'number') style.height = height

    const fill = pickString(nodeData.fill) ?? pickString(nodeStyle.fill)
    if (fill) style.fill = fill

    const stroke = pickString(nodeData.stroke) ?? pickString(nodeStyle.stroke)
    if (stroke) style.stroke = stroke

    const strokeWidth =
      typeof nodeData.strokeWidth === 'number'
        ? nodeData.strokeWidth
        : typeof nodeStyle.strokeWidth === 'number'
          ? nodeStyle.strokeWidth
          : undefined
    if (typeof strokeWidth === 'number') style.strokeWidth = strokeWidth

    const borderRadius =
      typeof nodeData.borderRadius === 'number'
        ? nodeData.borderRadius
        : typeof nodeStyle.borderRadius === 'number'
          ? nodeStyle.borderRadius
          : undefined
    if (typeof borderRadius === 'number') style.borderRadius = borderRadius

    const strokeStyleFromData = pickString(nodeData.strokeStyle)
    if (
      strokeStyleFromData === 'solid' ||
      strokeStyleFromData === 'dashed' ||
      strokeStyleFromData === 'dotted'
    ) {
      style.strokeStyle = strokeStyleFromData
    } else {
      const strokeStyleFromDash = parseStrokeStyle(nodeStyle.strokeDasharray)
      if (strokeStyleFromDash) style.strokeStyle = strokeStyleFromDash
    }

    const borderAnimationEnabled =
      typeof nodeData.borderAnimationEnabled === 'boolean'
        ? nodeData.borderAnimationEnabled
        : nodeData.strokeAnimation === 'dash'
          ? true
          : undefined
    if (typeof borderAnimationEnabled === 'boolean') {
      style.borderAnimationEnabled = borderAnimationEnabled
    }

    if (Object.keys(style).length > 0) {
      nodeContext.style = style
    }

    const tableColumns = Array.isArray(nodeData.columns)
      ? nodeData.columns.filter((value) => typeof value === 'string')
      : undefined
    const tableRows = Array.isArray(nodeData.rows)
      ? nodeData.rows
          .map((row) =>
            Array.isArray(row)
              ? row.filter((value) => typeof value === 'string')
              : undefined
          )
          .filter((row) => row !== undefined)
      : undefined
    if (tableColumns || tableRows) {
      nodeContext.table = {
        columns: tableColumns ?? [],
        rows: tableRows ?? [],
      }
    }

    const serviceTable = toRecord(nodeData.serviceTable)
    const serviceId = pickString(serviceTable?.serviceId)
    const serviceDbId = pickString(serviceTable?.serviceDbId)
    const tableName = pickString(serviceTable?.tableName)
    if (serviceId && serviceDbId && tableName) {
      nodeContext.dbConfig = {
        service: serviceId,
        database: serviceDbId,
        tableName,
      }
    }

    const dynamicData: NonNullable<typeof nodeContext.data> = {}
    for (const field of componentFields) {
      const label = pickString(field.label)
      const type = pickString(field.type)
      if (!label || !type || !isComponentInputType(type)) continue
      const componentType = type

      const normalizedLabel = label.toLowerCase()
      if (normalizedLabel === 'name') continue
      if (nodeType === 'text' && normalizedLabel === 'text') continue
      if (nodeType === 'code' && normalizedLabel === 'code') continue

      const options = Array.isArray(field.options)
        ? field.options.filter((option) => typeof option === 'string')
        : undefined

      dynamicData[label] = {
        type: componentType,
        value: getFieldValue(field.data),
        options: options && options.length > 0 ? options : undefined,
      }
    }

    if (Object.keys(dynamicData).length > 0) {
      nodeContext.data = dynamicData
    }

    const internalData = Object.entries(nodeData).reduce<
      Record<string, unknown>
    >((acc, [key, value]) => {
      if (KNOWN_NODE_DATA_KEYS.has(key)) return acc
      acc[key] = value
      return acc
    }, {})

    const iconSrc = pickString(nodeData.iconSrc)
    if (iconSrc) internalData.iconSrc = iconSrc

    const label = pickString(nodeData.label)
    if (label) internalData.label = label

    const internalCloud = pickString(nodeData.cloud)
    if (internalCloud) internalData.cloud = internalCloud

    if (Object.keys(internalData).length > 0) {
      nodeContext.___internal = internalData
    }

    if (Object.keys(nodeContext).length > 0) {
      contextNodes[mappedNodeId] = nodeContext
    }
  }

  const mermaidEdgeLines: string[] = []
  const contextEdges: NonNullable<z.infer<typeof contextSchema>['edges']> = {}

  for (const edge of input.edges) {
    const source = nodeIdMap.get(edge.source)
    const target = nodeIdMap.get(edge.target)
    if (!source || !target) continue

    const edgeLabel = pickString(edge.label)
    if (edgeLabel) {
      const escapedLabel = edgeLabel.replaceAll('|', '/').replaceAll('\n', ' ')
      mermaidEdgeLines.push(`${source} -->|${escapedLabel}| ${target}`)
    } else {
      mermaidEdgeLines.push(`${source} --> ${target}`)
    }

    const edgeContext: NonNullable<
      z.infer<typeof contextSchema>['edges']
    >[string] = {}
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
      contextEdges[`${source}-${target}`] = edgeContext
    }
  }

  const contextGroups: NonNullable<z.infer<typeof contextSchema>['groups']> = {}

  for (const groupNode of groupNodes) {
    const groupData = toRecord(groupNode.data) ?? {}
    const childNodes = Array.isArray(groupData.childNodes)
      ? groupData.childNodes
          .map((childId) =>
            typeof childId === 'string' ? nodeIdMap.get(childId) : undefined
          )
          .filter((childId) => childId !== undefined)
      : []

    const componentFields = Array.isArray(groupData.componentFields)
      ? groupData.componentFields
          .map((field) => toRecord(field))
          .filter((field) => field !== undefined)
      : []

    const name = getFieldString(componentFields, 'Name')

    if (!name && childNodes.length === 0) continue

    contextGroups[groupNode.id] = {
      name: name ?? undefined,
      nodes: childNodes,
    }
  }

  const context: z.infer<typeof contextSchema> = {}
  if (Object.keys(contextNodes).length > 0) context.nodes = contextNodes
  if (Object.keys(contextEdges).length > 0) context.edges = contextEdges
  if (Object.keys(contextGroups).length > 0) context.groups = contextGroups

  const validatedContext = contextSchema.parse(context)
  const mermaidLines = [
    `flowchart ${direction}`,
    ...mermaidNodeLines,
    ...mermaidEdgeLines,
  ]

  return {
    mermaid: mermaidLines.join('\n'),
    context: validatedContext,
  }
}
