import { Edge, Node } from '@xyflow/react'
import { ComponentInputType } from '../components/component-type'
import {
  C4BoundaryKind,
  C4DiagramType,
  C4ElementKind,
  C4ElementShape,
  C4NodeType,
  C4RelDirection,
} from './c4'

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

  c4DiagramType?: C4DiagramType
  c4Kind?: C4ElementKind
  c4Shape?: C4ElementShape
  c4BoundaryKind?: C4BoundaryKind
  c4NodeType?: C4NodeType
  c4RelDirection?: C4RelDirection
  c4RelTechnology?: string
  c4RelDescription?: string
  boundaryType?: string
  isExternal?: boolean
  technology?: string
  description?: string
  link?: string
  color?: string
  fill?: string
  stroke?: string
  fontColor?: string
  backgroundColor?: string
  borderColor?: string
  labelColor?: string
  labelOffsetX?: number
  labelOffsetY?: number

  /** Diagram this node drills down into, opened in a new tab. */
  diagramId?: string
  diagramName?: string
  thumbnailUrl?: string
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
