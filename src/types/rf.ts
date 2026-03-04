import { Edge, Node } from '@xyflow/react'
import { ComponentInputType } from '../components/component-type'

export type CustomData = {
  source?: 'mermaid'

  src?: string
  iconSrc?: string

  childNodes?: string[]
  componentFields?: RFComponentField[]

  shape?: string

  serviceTable?: {
    serviceId: string
    serviceDbId: string
    tableName: string
  }
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
