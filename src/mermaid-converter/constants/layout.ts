// constants/layout.ts
export const LAYOUT_SPACING = {
  SUBGRAPH_HEADER_HEIGHT: 35, // Increased for proper title clearance
  SUBGRAPH_PADDING: 8, // Base padding around subgraph edges (reduced to tighten layout)
  SUBGRAPH_CONTENT_TOP_MARGIN: 10, // Additional space below title before content

  // Node spacing within subgraphs - controls minimum distance between nodes
  NODE_SEPARATION_HORIZONTAL: 120, // Minimum horizontal distance between nodes in same rank
  NODE_SEPARATION_VERTICAL: 180, // Minimum vertical distance between different ranks

  // Container spacing for meta-graph layout - controls distance between top-level elements
  CONTAINER_SEPARATION_HORIZONTAL: 180, // Distance between top-level subgraphs/nodes horizontally
  CONTAINER_SEPARATION_VERTICAL: 280, // Distance between top-level subgraphs/nodes vertically

  // Nested subgraph spacing - controls spacing of child subgraphs within parents
  NESTED_SUBGRAPH_SEPARATION_HORIZONTAL: 160, // Distance between sibling subgraphs
  NESTED_SUBGRAPH_SEPARATION_VERTICAL: 220, // Distance between nested subgraph ranks

  // Minimum rendered size of a subgraph container
  MIN_SUBGRAPH_WIDTH_HORIZONTAL: 600,
  MIN_SUBGRAPH_WIDTH_VERTICAL: 240,
  MIN_SUBGRAPH_HEIGHT: 200,

  // Margin constants for different layout contexts
  META_GRAPH_MARGIN: 100, // Outer margin for the entire diagram
  NESTED_CONTENT_MARGIN: 40, // Margin around content within nested subgraphs (increased)
  MIXED_CONTENT_VERTICAL_SPACING: 180, // Extra spacing between nodes and nested subgraphs in same parent
  MIXED_CONTENT_HORIZONTAL_SPACING: 160, // Extra spacing when laying out children beside nodes (LR/RL)
} as const

export const LAYOUT_RANKERS = {
  NETWORK_SIMPLEX: 'network-simplex',
  TIGHT_TREE: 'tight-tree',
  LONGEST_PATH: 'longest-path',
} as const

export type LayoutRanker = (typeof LAYOUT_RANKERS)[keyof typeof LAYOUT_RANKERS]

export const DEFAULT_LAYOUT_RANKER: LayoutRanker = LAYOUT_RANKERS.TIGHT_TREE

export const SEQUENCE_LAYOUT = {
  COLUMN_WIDTH: 360,
  ROW_HEIGHT: 60,
  HEADER_HEIGHT: 40,
  MESSAGE_NODE_WIDTH: 140,
  MESSAGE_NODE_HEIGHT: 32,
  SELF_LOOP_OFFSET: 48,
  PARTICIPANT_NODE_WIDTH: 10,

  MESSAGE_MAX_WIDTH: 240,
  MESSAGE_TARGET_WRAP_LINES: 2,
  MESSAGE_CHAR_WIDTH: 7,
  MESSAGE_LINE_HEIGHT: 20,
  MESSAGE_HORIZONTAL_PADDING: 24,
  MESSAGE_VERTICAL_PADDING: 8,
  ROW_VERTICAL_PADDING: 16,

  NOTE_OFFSET: 24,
  BLOCK_TOP_PADDING: 36,
  BLOCK_BOTTOM_PADDING: 16,
  BLOCK_SIDE_PADDING: 44,
  BLOCK_SECTION_PADDING: 22,
  BLOCK_CONTENT_INSET: 12,
  BLOCK_FRAME_GAP: 12,
  BOX_TOP_INSET: 26,
  BOX_BOTTOM_PADDING: 24,
} as const
