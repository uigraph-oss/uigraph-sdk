export interface MermaidNode {
  id: string
  label: string
  shape: string
  subgraph?: string
  parentSubgraph?: string // For nested subgraphs
}

export interface MermaidEdge {
  source: string
  target: string
  label?: string
  type: string
  isSourceSubgraph?: boolean
  isTargetSubgraph?: boolean
}

export interface SubgraphInfo {
  id: string
  title: string
  nodes: string[]
  parentId?: string // For nested subgraphs
  childrenIds: string[] // For nested subgraphs
  direction?: string // Optional per-subgraph layout direction (TB/LR/BT/RL)
}

export interface SubgraphLayout {
  id: string
  title: string
  nodes: Map<string, { x: number; y: number; width: number; height: number }>
  width: number
  height: number
  position?: { x: number; y: number }
  parentId?: string
}

export interface SequenceParticipant {
  id: string
  name: string
  alias?: string
  index: number
}

export interface SequenceMessage {
  from: string
  to: string
  label: string
  lineStyle: 'solid' | 'dashed'
  arrowType: 'filled' | 'open' | 'none'
  rowIndex: number
}

export interface SequenceDiagramData {
  participants: SequenceParticipant[]
  messages: SequenceMessage[]
}
