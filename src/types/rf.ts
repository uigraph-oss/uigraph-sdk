import { ComponentInputType } from '@/constants/component-type'
import { Edge, Node } from '@xyflow/react'

type CustomData = {
  source?: 'mermaid'
  componentFields?: ComponentField[]
}

export interface ReactFlowData {
  nodes: Node<CustomData>[]
  edges: Edge<CustomData>[]
}

export interface ComponentField {
  componentFieldId: string
  type: ComponentInputType
  label: string
  data: unknown
}
