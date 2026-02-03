import { ComponentInputType } from '@/components/component-type'
import { Edge, Node } from '@xyflow/react'

type CustomData = {
  source?: 'mermaid'
  componentFields?: RFComponentField[]
}

export interface ReactFlowData {
  nodes: Node<CustomData>[]
  edges: Edge<CustomData>[]
}

export interface RFComponentField {
  componentFieldId: string
  type: ComponentInputType
  label: string
  data: unknown
}
