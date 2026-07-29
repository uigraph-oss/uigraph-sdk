export type C4DiagramType =
  | 'C4Context'
  | 'C4Container'
  | 'C4Component'
  | 'C4Dynamic'
  | 'C4Deployment'

export type C4ElementKind =
  | 'person'
  | 'system'
  | 'container'
  | 'component'
  | 'node'

export type C4ElementShape = 'default' | 'db' | 'queue'

export interface C4Element {
  id: string
  label: string
  description?: string
  technology?: string
  kind: C4ElementKind
  shape: C4ElementShape
  isExternal: boolean
  /** `<<external_system_db>>` tag mermaid prints above the name. */
  stereotype: string
  parentId?: string
  sprite?: string
  tags?: string
  link?: string
  /** `$link="uig:<diagramId>"` drill-down target rendered as a sub diagram. */
  subDiagramId?: string
}

export type C4BoundaryKind =
  | 'enterprise'
  | 'system'
  | 'container'
  | 'generic'
  | 'node'

/** `Node_L` / `Node_R` only differ in how mermaid aligns the node label. */
export type C4NodeType = 'node' | 'nodeL' | 'nodeR'

export interface C4Boundary {
  id: string
  label: string
  kind: C4BoundaryKind
  /** Printed as `[ENTERPRISE]` / `[SYSTEM]` / the verbatim custom type. */
  type: string
  /** Only `Deployment_Node` and friends carry a description. */
  description?: string
  /** Set for the deployment-node keywords, absent for plain boundaries. */
  nodeType?: C4NodeType
  parentId?: string
  childIds: string[]
  sprite?: string
  tags?: string
  link?: string
}

export type C4RelDirection =
  | 'default'
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'back'
  | 'bi'

export interface C4Relationship {
  from: string
  to: string
  label: string
  technology?: string
  description?: string
  direction: C4RelDirection
  index: number
  sprite?: string
  tags?: string
  link?: string
}

/** `UpdateElementStyle(id, $bgColor="grey", …)` overrides. */
export interface C4ElementStyle {
  bgColor?: string
  fontColor?: string
  borderColor?: string
  shadowing?: boolean
  shape?: string
  sprite?: string
  techn?: string
  legendText?: string
  legendSprite?: string
}

/** `UpdateRelStyle(from, to, $lineColor="blue", …)` overrides. */
export interface C4RelStyle {
  textColor?: string
  lineColor?: string
  offsetX?: number
  offsetY?: number
  lineWidth?: number
  lineStyle?: string
}

/** `UpdateLayoutConfig($c4ShapeInRow="3", $c4BoundaryInRow="1")`. */
export interface C4LayoutConfig {
  c4ShapeInRow: number
  c4BoundaryInRow: number
}

export type C4Direction = 'TB' | 'BT' | 'LR' | 'RL'

export interface C4DiagramData {
  type: C4DiagramType
  title?: string
  accTitle?: string
  accDescription?: string
  direction?: C4Direction
  elements: C4Element[]
  boundaries: C4Boundary[]
  relationships: C4Relationship[]
  elementStyles: Record<string, C4ElementStyle>
  boundaryStyles: Record<string, C4ElementStyle>
  /** Keyed by `${from}->${to}`. */
  relStyles: Record<string, C4RelStyle>
  layout: C4LayoutConfig
}
