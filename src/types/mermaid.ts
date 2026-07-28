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

export type SequenceParticipantType =
  | 'participant'
  | 'actor'
  | 'boundary'
  | 'control'
  | 'entity'
  | 'database'
  | 'collections'
  | 'queue'

export interface SequenceParticipantLink {
  label: string
  url: string
}

export interface SequenceParticipant {
  id: string
  name: string
  alias?: string
  index: number
  type: SequenceParticipantType
  boxId?: string
  links: SequenceParticipantLink[]
  /** Row the `create participant X` directive introduced this one at. */
  createdAtRow?: number
  /** Row the `destroy X` directive removed this one at. */
  destroyedAtRow?: number
}

/**
 * Every arrow in https://mermaid.js.org/syntax/sequenceDiagram.html#messages.
 * `head` is what the line ends in, `half`/`reversed` further qualify the
 * half-arrow family (`-|\`, `-//`, `/|-`, …) which draws only one barb, and
 * for the reverse forms draws it at the source end instead of the target end.
 */
export type SequenceArrowHead =
  | 'none'
  | 'filled'
  | 'open'
  | 'cross'
  | 'bidirectional'
  | 'half'
  | 'stick'

export interface SequenceMessage {
  from: string
  to: string
  label: string
  lineStyle: 'solid' | 'dashed'
  arrowType: SequenceArrowHead
  half?: 'top' | 'bottom'
  reversed?: boolean
  /** `Alice()->>John` / `Alice->>()John` — connects to a central lifeline point. */
  centralSource?: boolean
  centralTarget?: boolean
  /** `A->>+B` / `B-->>-A` activation shorthand. */
  activates?: boolean
  deactivates?: boolean
  sequenceNumber?: number
  rowIndex: number
}

export interface SequenceNote {
  placement: 'right of' | 'left of' | 'over'
  participants: string[]
  text: string
  rowIndex: number
}

export type SequenceBlockType =
  | 'loop'
  | 'alt'
  | 'opt'
  | 'par'
  | 'critical'
  | 'break'
  | 'rect'

export interface SequenceBlockSection {
  /** `else`/`and`/`option` branch label; the first section carries the block label. */
  label: string
  startRow: number
  endRow: number
}

export interface SequenceBlock {
  id: string
  type: SequenceBlockType
  label: string
  /** `rect rgb(0, 255, 0)` background color. */
  color?: string
  sections: SequenceBlockSection[]
  startRow: number
  endRow: number
  depth: number
  parentId?: string
}

export interface SequenceBox {
  id: string
  label: string
  color?: string
  participants: string[]
}

export interface SequenceActivation {
  participant: string
  startRow: number
  endRow: number
}

export interface SequenceAutonumber {
  start: number
  step: number
}

export interface SequenceDiagramData {
  participants: SequenceParticipant[]
  messages: SequenceMessage[]
  notes: SequenceNote[]
  blocks: SequenceBlock[]
  boxes: SequenceBox[]
  activations: SequenceActivation[]
  autonumber?: SequenceAutonumber
  title?: string
  accTitle?: string
  accDescr?: string
}
