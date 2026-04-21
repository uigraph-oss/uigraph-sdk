import { Node } from '@xyflow/react'
import z from 'zod'
import { contextSchema } from '../../headless'
import { CONTEXT_SHAPES, KNOWN_NODE_DATA_KEYS } from '../constants'
import {
  getFieldByLabel,
  getFieldValue,
  isComponentInputType,
  isEmptyFieldValue,
  parseStrokeStyle,
  pickPosition,
  pickString,
  toRecord,
} from '../utils'

export function buildContextNodes(
  graphNodes: Node[],
  nodeIdMap: Map<string, string>
): NonNullable<z.infer<typeof contextSchema>['nodes']> {
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

    const nameField = getFieldByLabel(componentFields, 'Name')
    const nameRawValue = nameField ? getFieldValue(nameField.data) : undefined
    const name = pickString(nameRawValue)
    if (name) nodeContext.name = name

    const textField =
      nodeType === 'text' ? getFieldByLabel(componentFields, 'Text') : undefined
    const textRawValue = textField ? getFieldValue(textField.data) : undefined
    const textValue = pickString(textRawValue)
    if (nodeType === 'text') {
      if (textValue) nodeContext.value = textValue
    }

    const codeField =
      nodeType === 'code' ? getFieldByLabel(componentFields, 'Code') : undefined
    const codeRawValue = codeField ? getFieldValue(codeField.data) : undefined
    const codeValue = pickString(codeRawValue)
    if (nodeType === 'code') {
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

    if (nameField && !name && isEmptyFieldValue(nameRawValue)) {
      const nameType = pickString(nameField.type)
      if (nameType && isComponentInputType(nameType)) {
        const nameOptions = Array.isArray(nameField.options)
          ? nameField.options.filter((option) => typeof option === 'string')
          : undefined

        dynamicData.Name = {
          type: nameType,
          value: '',
          options:
            nameOptions && nameOptions.length > 0 ? nameOptions : undefined,
        }
      }
    }

    if (textField && !textValue && isEmptyFieldValue(textRawValue)) {
      const textType = pickString(textField.type)
      if (textType && isComponentInputType(textType)) {
        const textOptions = Array.isArray(textField.options)
          ? textField.options.filter((option) => typeof option === 'string')
          : undefined

        dynamicData.Text = {
          type: textType,
          value: '',
          options:
            textOptions && textOptions.length > 0 ? textOptions : undefined,
        }
      }
    }

    if (codeField && !codeValue && isEmptyFieldValue(codeRawValue)) {
      const codeType = pickString(codeField.type)
      if (codeType && isComponentInputType(codeType)) {
        const codeOptions = Array.isArray(codeField.options)
          ? codeField.options.filter((option) => typeof option === 'string')
          : undefined

        dynamicData.Code = {
          type: codeType,
          value: '',
          options:
            codeOptions && codeOptions.length > 0 ? codeOptions : undefined,
        }
      }
    }

    if (Object.keys(dynamicData).length > 0) {
      nodeContext.data = dynamicData
    }

    const position = pickPosition(node.position)
    if (position) {
      nodeContext.___position = position
    }

    const internalData = Object.entries(nodeData).reduce<
      Record<string, unknown>
    >((acc, [key, value]) => {
      if (KNOWN_NODE_DATA_KEYS.has(key)) return acc
      acc[key] = value
      return acc
    }, {})

    if (nodeType === 'builder' && Array.isArray(nodeData.componentFields)) {
      internalData.componentFields = nodeData.componentFields
    }

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

  return contextNodes
}
