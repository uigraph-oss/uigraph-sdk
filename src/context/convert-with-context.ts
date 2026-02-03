import { Node } from '@xyflow/react'
import z from 'zod'
import {
  generateComponentFieldInput,
  getComponentFieldByLabel,
} from '../components/component-field'
import { ComponentInputType } from '../components/component-type'
import { convertMermaidToReactFlow } from '../converter/mermaid-to-react-flow'
import { CustomData, ReactFlowData, RFComponentField } from '../types'
import { contextSchema } from './context-schema'

export async function convertMermaidToReactFlowWithContext(
  mermaidCode: string,
  context: z.infer<typeof contextSchema>
): Promise<ReactFlowData> {
  const validatedContext = contextSchema.parse(context)
  const reactFlowData = await convertMermaidToReactFlow(mermaidCode)

  const rfNodes = reactFlowData.nodes.map((node) => {
    const ctx = validatedContext.nodes[node.id]
    if (!ctx) return node

    const clonedNode: Node<CustomData> = JSON.parse(JSON.stringify(node))
    const componentFields = clonedNode.data.componentFields ?? []

    if (ctx.type) {
      clonedNode.type = ctx.type
      delete clonedNode.style
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
      })

      if (!componentField) {
        componentFields.push(newComponentField as RFComponentField)
      } else {
        componentField.type = newComponentField.type
        componentField.data = newComponentField.data
      }
    }

    return clonedNode
  })

  return {
    nodes: rfNodes,
    edges: reactFlowData.edges,
  }
}
