import { EdgeMarkerType, MarkerType, Node } from '@xyflow/react'
import { arrayNonNullable, objectPick } from 'daily-code'
import z from 'zod'
import {
  generateComponentFieldInput,
  getComponentFieldByLabel,
} from '../../components/component-field'
import { ComponentInputType } from '../../components/component-type'
import { generateGroupNodeFromNodes } from '../../react-flow/group'
import { CustomData, ReactFlowData, RFComponentField } from '../../types'
import { convertMermaidToReactFlow } from '../mermaid-to-react-flow'
import { contextSchema } from './context-schema'
import { resolveAnimatedNode, resolveCloudIcon } from './helpers'
import { resizeNodesLayouts } from './resize-nodes-layouts'

type ResolverOptions = {
  repositionNodes?: boolean

  resolveCloudIcon?: (
    cloud: string | undefined,
    service: string
  ) => Promise<string | undefined | null>
}

function hasValidPosition(
  position: { x: number; y: number } | undefined
): position is { x: number; y: number } {
  if (!position) return false
  return Number.isFinite(position.x) && Number.isFinite(position.y)
}

function normalizeContextMarker(
  marker: { type: string; color?: string } | undefined
): EdgeMarkerType | undefined {
  if (!marker) return

  const markerType = marker.type.trim().toLowerCase()

  let type: MarkerType | undefined
  if (markerType === 'arrow') {
    type = MarkerType.Arrow
  } else if (
    markerType === 'arrowclosed' ||
    markerType === 'arrow-closed' ||
    markerType === 'arrow_closed'
  ) {
    type = MarkerType.ArrowClosed
  }

  if (!type) return

  if (marker.color) {
    return {
      type,
      color: marker.color,
    }
  }

  return { type }
}

export async function convertMermaidToReactFlowWithContext(
  mermaidCode: string,
  context: z.infer<typeof contextSchema>,
  options?: ResolverOptions
): Promise<ReactFlowData> {
  const validatedContext = contextSchema.parse(context)
  const reactFlowData = await convertMermaidToReactFlow(mermaidCode)

  const rfNodesPromises = reactFlowData.nodes.map(async (node) => {
    const ctx = validatedContext.nodes?.[node.id]
    if (!ctx) return node

    const clonedNode: Node<CustomData> = JSON.parse(JSON.stringify(node))
    const componentFields = clonedNode.data.componentFields ?? []

    ctx.data ??= {}
    clonedNode.data ??= {}

    if (hasValidPosition(ctx.___position)) {
      clonedNode.position = {
        x: ctx.___position.x,
        y: ctx.___position.y,
      }
    }

    if (ctx.type) {
      clonedNode.type = ctx.type
      delete clonedNode.style

      if (ctx.type === 'cloud') {
        clonedNode.height = 150
        clonedNode.width = 150

        if (ctx.service) {
          const cloudIcon = options?.resolveCloudIcon
            ? await options.resolveCloudIcon(ctx.cloud, ctx.service)
            : await resolveCloudIcon(ctx.cloud, ctx.service)

          if (cloudIcon) {
            clonedNode.data.iconSrc = cloudIcon
          }
        }
      }

      if (ctx.type === 'image' && ctx.src) {
        clonedNode.data = {
          ...clonedNode.data,
          src: ctx.src,
        }
      }

      if (ctx.type === 'gif') {
        if (ctx.animatedIcon) {
          const animatedNodeSrc = await resolveAnimatedNode(ctx.animatedIcon)

          if (animatedNodeSrc) {
            clonedNode.data = {
              ...clonedNode.data,
              src: animatedNodeSrc,
            }
          }
        } else if (ctx.src) {
          clonedNode.data = {
            ...clonedNode.data,
            src: ctx.src,
          }
        }
      }

      if (ctx.type === 'text' && (ctx.value || ctx.name)) {
        const textComponentField = generateComponentFieldInput({
          type: ComponentInputType.TextInput,
          componentFieldId: 'text',
          label: 'Text',
          data: ctx.value || ctx.name,
          isReadonly: true,
        })

        componentFields.unshift(textComponentField as RFComponentField)
      }

      if (ctx.type === 'code' && ctx.value) {
        const textComponentField = generateComponentFieldInput({
          type: ComponentInputType.CodeEditor,
          componentFieldId: 'code',
          label: 'Code',
          data: ctx.value,
          isReadonly: true,
        })

        componentFields.unshift(textComponentField as RFComponentField)
      }

      if (ctx.type === 'table' && ctx.table) {
        clonedNode.data.title = ctx.name
        clonedNode.data.rows = ctx.table.rows ?? []
        clonedNode.data.columns = ctx.table.columns ?? []
      }

      if (ctx.type === 'data-source' || ctx.type === 'db-table') {
        ctx.type = 'databaseTableSQL'
        clonedNode.type = 'databaseTableSQL'
      }

      if (ctx.type === 'component') {
        ctx.type = 'builder'
        clonedNode.type = 'builder'
        clonedNode.data.componentId = ctx.componentId
      }

      if (ctx.type === 'shape' && ctx.shape) {
        clonedNode.data.shape = ctx.shape
        if (ctx.shape === 'or' || ctx.shape === 'summing-junction') {
          const maxSize = Math.max(
            clonedNode.width ?? 0,
            clonedNode.height ?? 0,
            200
          )

          clonedNode.width = maxSize
          clonedNode.height = maxSize
        }
      }
    }

    if (ctx.name) {
      ctx.data['Name'] = {
        type: ComponentInputType.TextInput,
        value: ctx.name,
      }
    }

    for (const key in ctx.data) {
      const metaInput = ctx.data[key]
      if (metaInput === undefined) continue

      const componentField = getComponentFieldByLabel(componentFields, key)
      const newComponentField = generateComponentFieldInput({
        label: key,
        type: metaInput.type,
        data: metaInput.value,
        options: metaInput.options,
      })

      if (!componentField) {
        componentFields.push(newComponentField as RFComponentField)
      } else {
        componentField.type = newComponentField.type
        componentField.data = newComponentField.data
      }
    }

    if (ctx.dbConfig) {
      clonedNode.data.serviceTable = {
        serviceName: ctx.dbConfig.serviceName,
        databaseName: ctx.dbConfig.databaseName,
        tableName: ctx.dbConfig.tableName,
      }
    }

    if (ctx.style?.height) {
      clonedNode.height = ctx.style.height
    }

    if (ctx.style?.width) {
      clonedNode.width = ctx.style.width
    }

    clonedNode.data = {
      ...clonedNode.data,
      ...objectPick(ctx.style ?? {}, [
        'fill',
        'stroke',
        'strokeWidth',
        'strokeStyle',
        'borderRadius',
        'borderAnimationEnabled',
      ]),

      componentFields: componentFields,
      strokeAnimation: ctx.style?.borderAnimationEnabled ? 'dash' : undefined,

      ...ctx?.___internal,
    }

    return clonedNode
  })

  const resolvedNodes = await Promise.all(rfNodesPromises)

  const groupNodes: Node<CustomData>[] = Object.entries(
    context.groups ?? {}
  ).map(([nodeId, groupCtx]) => {
    const groupChildNodeIds = groupCtx.nodes ?? []
    const childNodes = arrayNonNullable(
      groupChildNodeIds.map((nodeId) =>
        resolvedNodes.find((n) => n.id === nodeId)
      )
    )

    return generateGroupNodeFromNodes(
      nodeId,
      groupCtx.name ?? 'Group',
      childNodes
    )
  })

  const rfEdgesPromises = reactFlowData.edges.map(async (edge) => {
    const ctx = validatedContext.edges?.[`${edge.source}-${edge.target}`]
    if (!ctx) return edge

    return {
      ...edge,
      type: ctx.type ?? edge.type,
      sourceHandle: ctx.sourceHandle ?? edge.sourceHandle,
      targetHandle: ctx.targetHandle ?? edge.targetHandle,
      markerStart: normalizeContextMarker(ctx.markerStart) ?? edge.markerStart,
      markerEnd: normalizeContextMarker(ctx.markerEnd) ?? edge.markerEnd,

      data: {
        ...edge.data,
        ...ctx?.___internal,
      },

      label: ctx.label ?? edge.label,
      animated: ctx.style?.borderAnimationEnabled ?? edge.animated,
      style: {
        ...edge.style,

        stroke: ctx.style?.stroke ?? edge.style?.stroke,
        strokeWidth: ctx.style?.strokeWidth ?? edge.style?.strokeWidth,
        strokeDasharray:
          ctx.style?.strokeStyle === 'dashed'
            ? '4 2'
            : ctx.style?.strokeStyle === 'dotted'
              ? '1 2'
              : ctx.style?.strokeStyle === 'solid'
                ? undefined
                : edge.style?.strokeDasharray,
      },
    }
  })

  const resolvedEdges = await Promise.all(rfEdgesPromises)
  const combinedNodes = [
    ...groupNodes,
    ...resolvedNodes.map((node) => {
      const nodeParent = groupNodes.find((groupNode) =>
        groupNode.data.childNodes?.includes(node.id)
      )

      if (nodeParent) {
        return {
          ...node,
          parentId: nodeParent.id,
        }
      }

      return node
    }),
  ]

  return {
    edges: resolvedEdges,
    nodes: options?.repositionNodes
      ? resizeNodesLayouts(combinedNodes)
      : combinedNodes,
  }
}
