import { Edge, Node } from '@xyflow/react'
import z from 'zod'
import { contextSchema } from '../headless'

export type UiGraphInput = {
  nodes: Node[]
  edges: Edge[]
}

export type UiGraphOptions = {
  detailedContext?: boolean
}

export type UigOutput = {
  mermaid: string
  context: z.infer<typeof contextSchema>
}
