import { Edge, Node } from '@xyflow/react'
import z from 'zod'
import { contextSchema } from '../headless'

type UiGraphInput = {
  nodes: Node[]
  edges: Edge[]
}

type UigOutput = {
  mermaid: string
  context: z.infer<typeof contextSchema>
}

export function convertUiGraphToMermaid(input: UiGraphInput) {}
