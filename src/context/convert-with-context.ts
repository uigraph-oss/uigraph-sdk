import { Node } from '@xyflow/react'
import { arrayNonNullable } from 'daily-code/.'
import z from 'zod'
import {
  generateComponentFieldInput,
  getComponentFieldByLabel,
} from '../components/component-field'
import { ComponentInputType } from '../components/component-type'
import { convertMermaidToReactFlow } from '../converter/mermaid-to-react-flow'
import { generateGroupNodeFromNodes } from '../react-flow/group'
import { CustomData, ReactFlowData, RFComponentField } from '../types'
import { contextSchema } from './context-schema'

type ResolverOptions = {
  resolveCloudIcon?: (cloud: string) => Promise<string | undefined | null>
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

    const groupEntries = Object.entries(validatedContext.groups ?? {})

    const clonedNode: Node<CustomData> = JSON.parse(JSON.stringify(node))
    const componentFields = clonedNode.data.componentFields ?? []

    if (ctx.type) {
      clonedNode.type = ctx.type
      delete clonedNode.style

      if (ctx.type === 'cloud') {
        clonedNode.height = 150
        clonedNode.width = 150

        if (ctx.cloud) {
          const cloudIcon = await options?.resolveCloudIcon?.(ctx.cloud)
          if (cloudIcon) {
            ctx.data ??= {}
            ctx.data.iconSrc = cloudIcon
          }
        }
      }
    }

    if (ctx.name) {
      ctx.meta ??= {}
      ctx.meta['Name'] = {
        type: ComponentInputType.TextInput,
        value: ctx.name,
      }
    }

    for (const key in ctx.meta) {
      const metaInput = ctx.meta[key]
      if (metaInput === undefined) continue

      const componentField = getComponentFieldByLabel(componentFields, key)
      const newComponentField = generateComponentFieldInput({
        label: key,
        type: metaInput.type,
        data: metaInput.value,
      })

      if (!componentField) {
        componentFields.push(newComponentField as RFComponentField)
      } else {
        componentField.type = newComponentField.type
        componentField.data = newComponentField.data
      }
    }

    if (ctx.data) {
      clonedNode.data = {
        ...clonedNode.data,
        ...ctx.data,
      }
    }

    const group = groupEntries.find(([_, group]) =>
      group.nodes?.includes(node.id)
    )

    if (group) {
      const [groupId] = group
      clonedNode.parentId = groupId
    }

    return clonedNode
  })

  const resolvedNodes = await Promise.all(rfNodesPromises)

  for (const nodeId in context.groups ?? {}) {
    const groupCtx = context.groups?.[nodeId]
    if (!groupCtx) continue

    const childNodes = groupCtx.nodes?.map((nodeId) =>
      resolvedNodes.find((n) => n.id === nodeId)
    )

    const groupNode = generateGroupNodeFromNodes(
      nodeId,
      arrayNonNullable(childNodes)
    )

    resolvedNodes.push(groupNode)
  }

  return {
    edges: reactFlowData.edges,
    nodes: resolvedNodes,
  }
}
