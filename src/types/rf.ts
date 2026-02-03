import { Edge, Node } from '@xyflow/react'
import { ComponentInputType } from '../components/component-type'

export type CustomData = {
  source?: 'mermaid'
  childNodes?: string[]
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
