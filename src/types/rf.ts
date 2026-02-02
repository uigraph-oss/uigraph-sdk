import { ComponentInputType } from '@/constants/component-type'
import { Edge, Node } from '@xyflow/react'

export interface ReactFlowData {
  nodes: Node<{ componentFields?: ComponentField[] }>[]
  edges: Edge<{ componentFields?: ComponentField[] }>[]
}

export interface ComponentField {
  componentFieldId: string
  type: ComponentInputType
  label: string
  data: unknown
}
