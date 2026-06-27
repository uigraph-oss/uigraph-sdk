import { Edge, Node } from '@xyflow/react'
import { ComponentInputType } from '../components/component-type'

export type CustomData = {
  source?: 'mermaid'

  componentId?: string

  src?: string
  iconSrc?: string

  childNodes?: string[]
  autoLayout?: boolean
  componentFields?: RFComponentField[]

  shape?: string

  serviceTable?: {
    serviceName: string
    databaseName: string
    tableName: string
  }

  title?: string
  columns?: string[]
  rows?: string[][]

  strokeAnimation?: 'dash'
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
