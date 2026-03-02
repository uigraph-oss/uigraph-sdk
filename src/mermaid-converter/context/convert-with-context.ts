import { Node } from '@xyflow/react'
import { arrayNonNullable } from 'daily-code'
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

type ResolverOptions = {
  resolveCloudIcon?: (
    cloud: string | undefined,
    service: string
  ) => Promise<string | undefined | null>
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
            ctx.nodeData ??= {}
            ctx.nodeData.iconSrc = cloudIcon
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
    }

    if (ctx.name) {
      ctx.data ??= {}
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

    if (ctx.nodeData) {
      clonedNode.data = {
        ...clonedNode.data,
        ...ctx.nodeData,
      }
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

  return {
    edges: reactFlowData.edges,
    nodes: [
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
    ],
  }
}
