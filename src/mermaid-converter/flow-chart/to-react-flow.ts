/* eslint-disable @typescript-eslint/no-explicit-any */
import { Edge, MarkerType, Node, Position } from '@xyflow/react'
import dagre from 'dagre'
import {
  generateComponentFieldInput,
  generateComponentFieldNameInput,
} from '../../components/component-field'
import { ComponentInputType } from '../../components/component-type'
import {
  MermaidEdge,
  MermaidNode,
  ReactFlowData,
  SubgraphInfo,
  SubgraphLayout,
} from '../../types'
import { LAYOUT_SPACING } from '../constants/layout'
import { debugLog, parseLabelTag, resolvePortalNodeType } from '../helpers'
import { parseMermaidCode } from './parser'

const MERMAID_TO_PORTAL_SHAPE: Record<string, string> = {
  rect: 'rectangle',
  round: 'rounded-rect',
  stadium: 'terminator',
  circle: 'ellipse',
  diamond: 'diamond',
}
// Layout spacing constants - Fine-tune these for better visual separation
const SUBGRAPH_HEADER_HEIGHT = LAYOUT_SPACING.SUBGRAPH_HEADER_HEIGHT // Increased for proper title clearance
const SUBGRAPH_PADDING = LAYOUT_SPACING.SUBGRAPH_PADDING // Base padding around subgraph edges (reduced to tighten layout)
const SUBGRAPH_CONTENT_TOP_MARGIN = LAYOUT_SPACING.SUBGRAPH_CONTENT_TOP_MARGIN // Additional space below title before content

// Node spacing within subgraphs - controls minimum distance between nodes
const NODE_SEPARATION_HORIZONTAL = LAYOUT_SPACING.NODE_SEPARATION_HORIZONTAL // Minimum horizontal distance between nodes in same rank
const NODE_SEPARATION_VERTICAL = LAYOUT_SPACING.NODE_SEPARATION_VERTICAL // Minimum vertical distance between different ranks

// Container spacing for meta-graph layout - controls distance between top-level elements
const CONTAINER_SEPARATION_HORIZONTAL =
  LAYOUT_SPACING.CONTAINER_SEPARATION_HORIZONTAL // Distance between top-level subgraphs/nodes horizontally (reduced)
const CONTAINER_SEPARATION_VERTICAL =
  LAYOUT_SPACING.CONTAINER_SEPARATION_VERTICAL // Distance between top-level subgraphs/nodes vertically (slightly reduced)

// Nested subgraph spacing - controls spacing of child subgraphs within parents
const NESTED_SUBGRAPH_SEPARATION_HORIZONTAL =
  LAYOUT_SPACING.NESTED_SUBGRAPH_SEPARATION_HORIZONTAL // Distance between sibling subgraphs (increased)
const NESTED_SUBGRAPH_SEPARATION_VERTICAL =
  LAYOUT_SPACING.NESTED_SUBGRAPH_SEPARATION_VERTICAL // Distance between nested subgraph ranks (increased)

// Minimum rendered size of a subgraph container
const MIN_SUBGRAPH_WIDTH_HORIZONTAL =
  LAYOUT_SPACING.MIN_SUBGRAPH_WIDTH_HORIZONTAL
const MIN_SUBGRAPH_WIDTH_VERTICAL = LAYOUT_SPACING.MIN_SUBGRAPH_WIDTH_VERTICAL
const MIN_SUBGRAPH_HEIGHT = LAYOUT_SPACING.MIN_SUBGRAPH_HEIGHT

// Margin constants for different layout contexts
const META_GRAPH_MARGIN = LAYOUT_SPACING.META_GRAPH_MARGIN // Outer margin for the entire diagram
const NESTED_CONTENT_MARGIN = LAYOUT_SPACING.NESTED_CONTENT_MARGIN // Margin around content within nested subgraphs (increased)
const MIXED_CONTENT_VERTICAL_SPACING =
  LAYOUT_SPACING.MIXED_CONTENT_VERTICAL_SPACING // Extra spacing between nodes and nested subgraphs in same parent (increased)
const MIXED_CONTENT_HORIZONTAL_SPACING =
  LAYOUT_SPACING.MIXED_CONTENT_HORIZONTAL_SPACING // Extra spacing when laying out children beside nodes (LR/RL)
const DAGRE_RANKER: 'network-simplex' | 'tight-tree' | 'longest-path' =
  'tight-tree'
// Calculate dynamic node sizes based on label length
function calculateNodeSize(
  label: string,
  shape: string,
  isImageNode: boolean = false
) {
  // Fixed size for image nodes
  if (isImageNode) {
    return { width: 80, height: 80 }
  }

  const lines = label.split('\n')

  // Measure text width more accurately using canvas when available
  function measureLineWidth(text: string): number {
    try {
      if (typeof document !== 'undefined') {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        if (ctx) {
          // Match CSS used in nodes
          ctx.font =
            '600 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
          return ctx.measureText(text).width
        }
      }
    } catch {}
    // Fallback heuristic
    return text.length * 8
  }

  const maxLineWidth = Math.max(
    ...lines.map((line) => Math.ceil(measureLineWidth(line)))
  )

  // Base size from content, with reasonable minimums and padding
  const baseWidth = maxLineWidth + 30 // text width + padding
  const baseHeight = lines.length * 18 + 20 // line-height 18 + padding

  // Add some additional space based on content (not rigid minimums)
  const width = Math.max(80, baseWidth + 30) // Content + 30px extra, min 80px for readability
  const height = Math.max(40, baseHeight + 20) // Content + 20px extra, min 40px for readability

  if (shape === 'diamond') {
    return {
      // Slightly increase to account for diagonal bounding box
      width: Math.max(90, Math.ceil(width * 1.05)),
      height: Math.max(90, Math.ceil(height * 1.05)),
    }
  }
  if (shape === 'circle') {
    const size = Math.max(width, height) + 10 // Equal dimensions for circles
    return { width: size, height: size }
  }
  return { width, height }
}

// Helper function to detect and extract image URLs from labels
function extractImageUrl(label: string): {
  imageUrl: string | null
  cleanLabel: string
} {
  // Match common image URL patterns
  const imageUrlPattern =
    /https?:\/\/[^\s]+\.(jpg|jpeg|png|gif|svg|webp)(\?[^\s]*)?/i
  const match = label.match(imageUrlPattern)

  if (match) {
    const imageUrl = match[0]
    const cleanLabel = label.replace(imageUrl, '').trim()
    return { imageUrl, cleanLabel }
  }

  return { imageUrl: null, cleanLabel: label }
}

// Process subgraphs in hierarchical order (parents before children)
function processSubgraphsInHierarchicalOrder(
  subgraphs: SubgraphInfo[]
): SubgraphInfo[] {
  const result: SubgraphInfo[] = []
  const processed = new Set<string>()

  // First pass: add all subgraphs without parents
  subgraphs.forEach((subgraph) => {
    if (!subgraph.parentId) {
      result.push(subgraph)
      processed.add(subgraph.id)
    }
  })

  // Process remaining subgraphs in hierarchical order
  let lastProcessedCount = 0
  while (
    processed.size < subgraphs.length &&
    lastProcessedCount !== processed.size
  ) {
    lastProcessedCount = processed.size

    subgraphs.forEach((subgraph) => {
      if (
        !processed.has(subgraph.id) &&
        subgraph.parentId &&
        processed.has(subgraph.parentId)
      ) {
        result.push(subgraph)
        processed.add(subgraph.id)
      }
    })
  }

  // Add any remaining subgraphs (in case of circular references)
  subgraphs.forEach((subgraph) => {
    if (!processed.has(subgraph.id)) {
      debugLog(
        `Warning: Subgraph ${subgraph.id} has circular reference or missing parent. Adding it anyway.`
      )
      result.push(subgraph)
    }
  })

  return result
}

// Phase 1: Layout each subgraph independently
function layoutSubgraphs(
  nodes: MermaidNode[],
  edges: MermaidEdge[],
  subgraphs: SubgraphInfo[],
  direction: string
): Map<string, SubgraphLayout> {
  const subgraphLayouts = new Map<string, SubgraphLayout>()
  const isHorizontal = direction === 'LR' || direction === 'RL'

  // Process subgraphs in hierarchical order
  const orderedSubgraphs = processSubgraphsInHierarchicalOrder(subgraphs)

  debugLog(
    `Laying out ${orderedSubgraphs.length} subgraphs in hierarchical order`
  )

  orderedSubgraphs.forEach((subgraph) => {
    const subgraphNodes = nodes.filter((n) => n.subgraph === subgraph.id)
    const subgraphEdges = edges.filter((e) => {
      const sourceNode = nodes.find((n) => n.id === e.source)
      const targetNode = nodes.find((n) => n.id === e.target)
      return (
        sourceNode?.subgraph === subgraph.id &&
        targetNode?.subgraph === subgraph.id
      )
    })

    debugLog(
      `Laying out subgraph: ${subgraph.id} with ${subgraphNodes.length} nodes and ${subgraphEdges.length} edges`
    )

    // Create a new graph for this subgraph with proper node spacing
    const g = new dagre.graphlib.Graph()
    g.setGraph({
      rankdir: subgraph.direction || direction,
      // Node separation settings - ensure minimum distance between nodes
      nodesep: NODE_SEPARATION_HORIZONTAL, // Horizontal spacing between nodes in same rank
      ranksep: NODE_SEPARATION_VERTICAL, // Vertical spacing between different ranks
      // Margins - space around the entire subgraph content area
      marginx: SUBGRAPH_PADDING,
      marginy:
        SUBGRAPH_PADDING + SUBGRAPH_HEADER_HEIGHT + SUBGRAPH_CONTENT_TOP_MARGIN,
      ranker: DAGRE_RANKER, // Algorithm for ranking nodes (tight-tree gives compact layouts)
    })
    g.setDefaultEdgeLabel(() => ({}))

    // Add nodes
    subgraphNodes.forEach((node) => {
      const { imageUrl } = extractImageUrl(node.label)
      const size = calculateNodeSize(node.label, node.shape, !!imageUrl)
      g.setNode(node.id, { width: size.width, height: size.height })
    })

    // Add edges
    subgraphEdges.forEach((edge) => {
      g.setEdge(edge.source, edge.target)
    })

    // Layout this subgraph
    dagre.layout(g)

    // Calculate bounding box
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity
    const nodePositions = new Map<
      string,
      { x: number; y: number; width: number; height: number }
    >()

    // Transform dagre coordinates to React Flow coordinates
    // Dagre gives us center-based coordinates, but we need to track bounding boxes
    // for proper subgraph sizing and relative positioning
    subgraphNodes.forEach((node) => {
      const nodeLayout = g.node(node.id)
      if (!nodeLayout) {
        debugLog(
          `Warning: No layout information for node ${node.id} in subgraph ${subgraph.id}`
        )
        return
      }

      const size = calculateNodeSize(node.label, node.shape)

      // Store center-based coordinates from dagre (will be converted to top-left later)
      nodePositions.set(node.id, {
        x: nodeLayout.x,
        y: nodeLayout.y,
        width: size.width,
        height: size.height,
      })

      // Calculate bounding box for subgraph sizing
      // Note: dagre coordinates are center-based, so we calculate edges
      minX = Math.min(minX, nodeLayout.x - size.width / 2)
      maxX = Math.max(maxX, nodeLayout.x + size.width / 2)
      minY = Math.min(minY, nodeLayout.y - size.height / 2)
      maxY = Math.max(maxY, nodeLayout.y + size.height / 2)
    })

    // Handle empty subgraphs by providing minimum dimensions
    if (subgraphNodes.length === 0 || minX === Infinity || minY === Infinity) {
      // Set default size for empty subgraph
      const defaultWidth = 200
      const defaultHeight = 100
      minX = 0
      minY = 0
      maxX = defaultWidth
      maxY = defaultHeight
      debugLog(
        `Using default dimensions for subgraph ${subgraph.id}: ${defaultWidth}x${defaultHeight}`
      )
    }

    // Normalize positions for React Flow coordinate system
    // React Flow expects top-left coordinates, but dagre gives center coordinates
    // We offset everything so the content starts at the proper position within the subgraph
    const offsetX = -minX + SUBGRAPH_PADDING
    const offsetY =
      -minY +
      SUBGRAPH_PADDING +
      SUBGRAPH_HEADER_HEIGHT +
      SUBGRAPH_CONTENT_TOP_MARGIN

    // Convert center-based coordinates to top-left coordinates for React Flow
    nodePositions.forEach((pos, nodeId) => {
      nodePositions.set(nodeId, {
        ...pos,
        // Apply offset and convert from center to top-left
        x: pos.x + offsetX,
        y: pos.y + offsetY,
      })
    })

    // Validate that nodes have adequate spacing (helps debug layout issues)
    validateNodeSpacing(nodePositions, subgraph.id)

    // Calculate base size from actual content including header and content margin
    const baseWidth = maxX - minX + SUBGRAPH_PADDING * 2
    const baseHeight =
      maxY -
      minY +
      SUBGRAPH_PADDING * 2 +
      SUBGRAPH_HEADER_HEIGHT +
      SUBGRAPH_CONTENT_TOP_MARGIN

    const width = Math.max(
      baseWidth + SUBGRAPH_PADDING * 3,
      isHorizontal ? MIN_SUBGRAPH_WIDTH_HORIZONTAL : MIN_SUBGRAPH_WIDTH_VERTICAL
    )
    const height = Math.max(
      baseHeight + SUBGRAPH_PADDING * 2,
      MIN_SUBGRAPH_HEIGHT
    )

    subgraphLayouts.set(subgraph.id, {
      id: subgraph.id,
      title: subgraph.title,
      nodes: nodePositions,
      width,
      height,
      parentId: subgraph.parentId,
    })

    debugLog(
      `Subgraph ${subgraph.id} sizing: base(${baseWidth.toFixed(
        1
      )}x${baseHeight.toFixed(1)}) = final(${width.toFixed(1)}x${height.toFixed(
        1
      )})`
    )
  })

  // Recalculate parent subgraph sizes to accommodate nested subgraphs
  recalculateParentSubgraphSizes(subgraphLayouts, orderedSubgraphs, direction)

  return subgraphLayouts
}

// Recalculate parent subgraph sizes to include nested subgraphs
// This runs AFTER child positioning to ensure accurate sizing
function recalculateParentSubgraphSizes(
  subgraphLayouts: Map<string, SubgraphLayout>,
  orderedSubgraphs: SubgraphInfo[],
  direction: string
) {
  // Process in reverse order (children first, then parents)
  for (let i = orderedSubgraphs.length - 1; i >= 0; i--) {
    const subgraph = orderedSubgraphs[i]
    const layout = subgraphLayouts.get(subgraph.id)

    if (!layout) continue

    // Find all direct child subgraphs
    const childSubgraphs = orderedSubgraphs.filter(
      (sg) => sg.parentId === subgraph.id
    )

    if (childSubgraphs.length === 0) continue

    // Calculate the minimum required size based on actual content
    let maxContentRight = 0
    let maxContentBottom = 0

    // Consider existing nodes in the parent
    layout.nodes.forEach((nodePos) => {
      const nodeRight = nodePos.x + nodePos.width / 2
      const nodeBottom = nodePos.y + nodePos.height / 2
      maxContentRight = Math.max(maxContentRight, nodeRight)
      maxContentBottom = Math.max(maxContentBottom, nodeBottom)
    })

    const isHorizontal = direction === 'LR' || direction === 'RL'

    // Consider child subgraphs (they will be positioned with proper spacing)
    childSubgraphs.forEach((childSg) => {
      const childLayout = subgraphLayouts.get(childSg.id)
      if (childLayout) {
        // Estimate child position accounting for dagre spacing and mixed content
        const estimatedChildX = isHorizontal
          ? Math.max(
              SUBGRAPH_PADDING + childLayout.width / 2,
              maxContentRight +
                MIXED_CONTENT_HORIZONTAL_SPACING +
                childLayout.width / 2
            )
          : SUBGRAPH_PADDING + childLayout.width / 2
        const estimatedChildY = isHorizontal
          ? Math.max(
              SUBGRAPH_HEADER_HEIGHT +
                SUBGRAPH_CONTENT_TOP_MARGIN +
                SUBGRAPH_PADDING +
                childLayout.height / 2,
              childLayout.height / 2 // keep near top content area when horizontal
            )
          : Math.max(
              SUBGRAPH_HEADER_HEIGHT +
                SUBGRAPH_CONTENT_TOP_MARGIN +
                SUBGRAPH_PADDING +
                childLayout.height / 2,
              maxContentBottom +
                MIXED_CONTENT_VERTICAL_SPACING +
                childLayout.height / 2
            )

        const childRight = estimatedChildX + childLayout.width / 2
        const childBottom = estimatedChildY + childLayout.height / 2

        maxContentRight = Math.max(maxContentRight, childRight)
        maxContentBottom = Math.max(maxContentBottom, childBottom)
      }
    })

    // Calculate minimum required parent size with generous padding
    const minRequiredWidth = maxContentRight + SUBGRAPH_PADDING * 3 // Extra padding for visual breathing room
    const minRequiredHeight = maxContentBottom + SUBGRAPH_PADDING * 3

    // Ensure minimum size for readability
    const absoluteMinWidth = 300
    const absoluteMinHeight = 200

    const finalWidth = Math.max(
      layout.width,
      minRequiredWidth,
      absoluteMinWidth
    )
    const finalHeight = Math.max(
      layout.height,
      minRequiredHeight,
      absoluteMinHeight
    )

    // Update parent size if it needs to be larger
    if (finalWidth > layout.width || finalHeight > layout.height) {
      const oldWidth = layout.width
      const oldHeight = layout.height
      layout.width = finalWidth
      layout.height = finalHeight

      debugLog(
        `Pre-sized parent ${subgraph.id}: ${oldWidth}x${oldHeight} → ${layout.width}x${layout.height} to contain ${childSubgraphs.length} children + nodes`
      )

      // Also log the child details for debugging
      childSubgraphs.forEach((child) => {
        const childLayout = subgraphLayouts.get(child.id)
        if (childLayout) {
          debugLog(
            `  Child ${child.id}: ${childLayout.width}x${childLayout.height}`
          )
        }
      })
    }
  }
}

// Calculate connection weights between containers
function calculateConnectionWeights(
  nodes: MermaidNode[],
  edges: MermaidEdge[]
): Map<string, Map<string, number>> {
  const weights = new Map<string, Map<string, number>>()

  edges.forEach((edge) => {
    const sourceNode = nodes.find((n) => n.id === edge.source)
    const targetNode = nodes.find((n) => n.id === edge.target)

    if (!sourceNode || !targetNode) return

    // Get container IDs (either subgraph ID or node ID for standalone nodes)
    const sourceContainer = sourceNode.subgraph || sourceNode.id
    const targetContainer = targetNode.subgraph || targetNode.id

    // Skip self-connections within the same container
    if (sourceContainer === targetContainer) return

    // Initialize maps if needed
    if (!weights.has(sourceContainer)) {
      weights.set(sourceContainer, new Map<string, number>())
    }

    const sourceWeights = weights.get(sourceContainer)!
    const currentWeight = sourceWeights.get(targetContainer) || 0
    sourceWeights.set(targetContainer, currentWeight + 1)
  })

  return weights
}

// Post-positioning size adjustment: ensure parent containers properly contain all positioned children
function adjustParentSizesAfterPositioning(
  subgraphLayouts: Map<string, SubgraphLayout>,
  subgraphPositions: Map<string, { x: number; y: number }>,
  orderedSubgraphs: SubgraphInfo[],
  direction: string
): void {
  const isHorizontal = direction === 'LR' || direction === 'RL'

  // Iterate a few times to propagate size growth up through ancestors
  let changed = true
  let iterations = 0
  while (changed && iterations < 5) {
    iterations++
    changed = false

    // Process parents ensuring they contain both own nodes and positioned children
    orderedSubgraphs.forEach((subgraph) => {
      const layout = subgraphLayouts.get(subgraph.id)
      const position = subgraphPositions.get(subgraph.id)
      if (!layout || !position) return

      // Bounds from this parent's own nodes (relative to parent origin)
      let maxNodeRight = 0
      let maxNodeBottom =
        SUBGRAPH_HEADER_HEIGHT + SUBGRAPH_CONTENT_TOP_MARGIN + SUBGRAPH_PADDING // at least header zone
      layout.nodes.forEach((nodePos) => {
        const nodeRight = nodePos.x + nodePos.width / 2
        const nodeBottom = nodePos.y + nodePos.height / 2
        maxNodeRight = Math.max(maxNodeRight, nodeRight)
        maxNodeBottom = Math.max(maxNodeBottom, nodeBottom)
      })

      // Bounds from child subgraphs (direct children only)
      let maxChildRight = 0
      let maxChildBottom = 0
      const childSubgraphs = orderedSubgraphs.filter(
        (sg) => sg.parentId === subgraph.id
      )
      childSubgraphs.forEach((child) => {
        const childLayout = subgraphLayouts.get(child.id)
        const childPosition = subgraphPositions.get(child.id)
        if (!childLayout || !childPosition) return
        const relX = childPosition.x - position.x
        const relY = childPosition.y - position.y
        maxChildRight = Math.max(maxChildRight, relX + childLayout.width)
        maxChildBottom = Math.max(maxChildBottom, relY + childLayout.height)
      })

      // Combine bounds
      const contentMaxRight = Math.max(maxNodeRight, maxChildRight)
      const contentMaxBottom = Math.max(maxNodeBottom, maxChildBottom)

      // Required dimensions with safety margins
      const requiredWidth =
        contentMaxRight +
        (isHorizontal ? SUBGRAPH_PADDING * 4 : SUBGRAPH_PADDING * 3)
      const requiredHeight = contentMaxBottom + SUBGRAPH_PADDING * 3

      const newWidth = Math.max(
        layout.width,
        requiredWidth,
        isHorizontal
          ? MIN_SUBGRAPH_WIDTH_HORIZONTAL
          : MIN_SUBGRAPH_WIDTH_VERTICAL
      )
      const newHeight = Math.max(
        layout.height,
        requiredHeight,
        MIN_SUBGRAPH_HEIGHT
      )

      if (newWidth > layout.width || newHeight > layout.height) {
        debugLog(
          `Post-positioning resize (iter ${iterations}): ${subgraph.id} ${layout.width}x${layout.height} → ${newWidth}x${newHeight}`
        )
        layout.width = newWidth
        layout.height = newHeight
        changed = true
      }
    })
  }
}

// Helper function to calculate the bottom boundary of nodes within a parent subgraph
function getParentNodesBottomBoundary(
  parentId: string,
  parentLayout: SubgraphLayout
): number {
  let maxBottom = 0

  // Check all nodes that belong directly to this parent subgraph
  parentLayout.nodes.forEach((nodePos) => {
    // nodePos contains center-based coordinates and dimensions
    const nodeBottom = nodePos.y + nodePos.height / 2
    maxBottom = Math.max(maxBottom, nodeBottom)
  })

  debugLog(`Parent ${parentId} nodes extend to bottom Y=${maxBottom}`)
  return maxBottom
}

// Validate and enforce minimum spacing between nodes
function validateNodeSpacing(
  nodePositions: Map<
    string,
    { x: number; y: number; width: number; height: number }
  >,
  subgraphId: string
): void {
  const positions = Array.from(nodePositions.values())
  let hasOverlap = false

  // Check for overlapping nodes
  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      const node1 = positions[i]
      const node2 = positions[j]

      // Calculate distance between node centers
      const centerDistance = Math.sqrt(
        Math.pow(node1.x - node2.x, 2) + Math.pow(node1.y - node2.y, 2)
      )

      // Calculate minimum required distance (sum of half-widths + half-heights + padding)
      const minDistance =
        (node1.width + node2.width) / 2 + (node1.height + node2.height) / 2 + 20

      if (centerDistance < minDistance) {
        hasOverlap = true
        debugLog(
          `Warning: Potential node overlap in subgraph ${subgraphId} - distance: ${centerDistance.toFixed(
            1
          )}, required: ${minDistance.toFixed(1)}`
        )
      }
    }
  }

  if (!hasOverlap) {
    debugLog(
      `✓ Node spacing validated for subgraph ${subgraphId} - no overlaps detected`
    )
  }
}

// Phase 2: Layout meta-graph (containers + standalone nodes)
function layoutMetaGraph(
  nodes: MermaidNode[],
  edges: MermaidEdge[],
  subgraphLayouts: Map<string, SubgraphLayout>,
  direction: string
): {
  subgraphPositions: Map<string, { x: number; y: number }>
  standalonePositions: Map<string, { x: number; y: number }>
} {
  // Create meta-graph for top-level layout with generous spacing
  const g = new dagre.graphlib.Graph()
  g.setGraph({
    rankdir: direction,
    // Container separation - ensure top-level elements don't overlap
    nodesep: CONTAINER_SEPARATION_HORIZONTAL, // Horizontal spacing between top-level containers
    ranksep: CONTAINER_SEPARATION_VERTICAL, // Vertical spacing between container ranks
    // Outer margins for the entire diagram
    marginx: META_GRAPH_MARGIN,
    marginy: META_GRAPH_MARGIN,
    ranker: DAGRE_RANKER, // Use tight-tree for better container arrangement
  })
  g.setDefaultEdgeLabel(() => ({}))

  debugLog('Laying out meta-graph')

  // Calculate connection weights between containers
  const connectionWeights = calculateConnectionWeights(nodes, edges)

  // Add subgraph containers as nodes
  subgraphLayouts.forEach((layout, id) => {
    // Skip nested subgraphs - they'll be positioned relative to their parents
    if (!layout.parentId) {
      g.setNode(id, { width: layout.width, height: layout.height })
      debugLog(
        `Added subgraph ${id} to meta-graph (width=${layout.width}, height=${layout.height})`
      )
    }
  })

  // Add standalone nodes
  const standaloneNodes = nodes.filter((n) => !n.subgraph)
  standaloneNodes.forEach((node) => {
    const { imageUrl } = extractImageUrl(node.label)
    const size = calculateNodeSize(node.label, node.shape, !!imageUrl)
    g.setNode(node.id, { width: size.width, height: size.height })
    debugLog(`Added standalone node ${node.id} to meta-graph`)
  })

  // Add edges between containers and standalone nodes with weights
  connectionWeights.forEach((targets, sourceId) => {
    targets.forEach((weight, targetId) => {
      // Skip edges between nested subgraphs and their parents
      const sourceLayout = subgraphLayouts.get(sourceId)
      const targetLayout = subgraphLayouts.get(targetId)

      if (
        (sourceLayout && sourceLayout.parentId === targetId) ||
        (targetLayout && targetLayout.parentId === sourceId)
      ) {
        return
      }

      // Only add edges between top-level containers or standalone nodes
      const sourceIsTopLevel = !sourceLayout || !sourceLayout.parentId
      const targetIsTopLevel = !targetLayout || !targetLayout.parentId

      if (sourceIsTopLevel && targetIsTopLevel) {
        // Check if both nodes exist in the graph
        if (g.hasNode(sourceId) && g.hasNode(targetId)) {
          if (!g.hasEdge(sourceId, targetId)) {
            g.setEdge(sourceId, targetId, { weight })
            debugLog(
              `Added meta-edge from ${sourceId} to ${targetId} with weight ${weight}`
            )
          }
        }
      }
    })
  })

  // Layout the meta-graph
  dagre.layout(g)

  // Extract positions
  const subgraphPositions = new Map<string, { x: number; y: number }>()
  const standalonePositions = new Map<string, { x: number; y: number }>()

  // Position top-level subgraphs
  subgraphLayouts.forEach((layout, id) => {
    if (!layout.parentId) {
      const node = g.node(id)
      if (node) {
        subgraphPositions.set(id, {
          x: node.x - layout.width / 2,
          y: node.y - layout.height / 2,
        })
        debugLog(
          `Positioned subgraph ${id} at (${node.x - layout.width / 2}, ${
            node.y - layout.height / 2
          })`
        )
      } else {
        debugLog(`Warning: No position for subgraph ${id} in meta-graph`)
      }
    }
  })

  const processedSubgraphs = new Set<string>()

  function layoutChildrenWithinParent(parentId: string): boolean {
    const parentPos = subgraphPositions.get(parentId)
    const parentLayout = subgraphLayouts.get(parentId)
    if (!parentPos || !parentLayout) return false

    // Collect direct child subgraphs
    const childIds: string[] = []
    subgraphLayouts.forEach((layout, id) => {
      if (layout.parentId === parentId) childIds.push(id)
    })

    if (childIds.length === 0) return false

    // CRITICAL FIX: Calculate the occupied space by existing nodes in the parent
    // This prevents nested subgraphs from overlapping with parent's direct nodes
    let maxNodeBottom = 0
    const parentNodesBottom = getParentNodesBottomBoundary(
      parentId,
      parentLayout
    )
    if (parentNodesBottom > 0) {
      maxNodeBottom = parentNodesBottom
      debugLog(
        `Parent ${parentId} has nodes extending to Y=${maxNodeBottom}, will position child subgraphs below this`
      )
    }

    // Build a dagre graph for child subgraphs with proper nested spacing
    const cg = new dagre.graphlib.Graph()
    // We didn't carry direction through here; default to global direction for meta stage
    const parentDir = direction
    cg.setGraph({
      rankdir: parentDir,
      // Nested subgraph separation - spacing between sibling subgraphs within parent
      nodesep: NESTED_SUBGRAPH_SEPARATION_HORIZONTAL, // Horizontal spacing between sibling subgraphs
      ranksep: NESTED_SUBGRAPH_SEPARATION_VERTICAL, // Vertical spacing between subgraph ranks
      // Margins within parent content area
      marginx: NESTED_CONTENT_MARGIN,
      marginy: NESTED_CONTENT_MARGIN,
      ranker: DAGRE_RANKER, // Consistent ranking algorithm
    })
    cg.setDefaultEdgeLabel(() => ({}))

    // Add child subgraphs as nodes with their sizes
    childIds.forEach((cid) => {
      const cl = subgraphLayouts.get(cid)!
      cg.setNode(cid, { width: cl.width, height: cl.height })
    })

    // Add edges between children based on connection weights in the full graph
    // Only include edges where both source and target are in childIds
    let hasEdges = false
    childIds.forEach((sourceId) => {
      const targets = connectionWeights.get(sourceId)
      if (!targets) return
      targets.forEach((weight, targetId) => {
        if (childIds.includes(targetId) && !cg.hasEdge(sourceId, targetId)) {
          cg.setEdge(sourceId, targetId, { weight })
          hasEdges = true
        }
      })
    })

    // If there are no inter-child edges, create a simple flow layout
    if (!hasEdges && childIds.length > 1) {
      // Create a simple chain to spread them out better
      for (let i = 0; i < childIds.length - 1; i++) {
        cg.setEdge(childIds[i], childIds[i + 1], { weight: 1 })
      }
    }

    dagre.layout(cg)

    // Compute bounding box of children from dagre positions
    let minLeft = Infinity,
      minTop = Infinity,
      maxRight = -Infinity,
      maxBottom = -Infinity
    const childTopLefts = new Map<string, { x: number; y: number }>()

    childIds.forEach((cid) => {
      const n = cg.node(cid)
      const cl = subgraphLayouts.get(cid)!
      const left = n.x - cl.width / 2
      const top = n.y - cl.height / 2
      const right = n.x + cl.width / 2
      const bottom = n.y + cl.height / 2
      childTopLefts.set(cid, { x: left, y: top })
      minLeft = Math.min(minLeft, left)
      minTop = Math.min(minTop, top)
      maxRight = Math.max(maxRight, right)
      maxBottom = Math.max(maxBottom, bottom)
    })

    // Origin inside parent content area (absolute coords) - below header with content margin
    let contentOriginX = parentPos.x + SUBGRAPH_PADDING
    let contentOriginY =
      parentPos.y +
      SUBGRAPH_HEADER_HEIGHT +
      SUBGRAPH_CONTENT_TOP_MARGIN +
      SUBGRAPH_PADDING

    // CRITICAL: If parent has nodes, position child subgraphs below them with adequate spacing
    const isHorizontal = parentDir === 'LR' || parentDir === 'RL'
    if (isHorizontal) {
      // In horizontal flow, keep children near the top content band and shift X if parent has wide nodes
      const parentNodesMaxRight = Array.from(
        parentLayout.nodes.values()
      ).reduce((acc, n) => Math.max(acc, n.x + n.width / 2), 0)
      if (parentNodesMaxRight > 0) {
        const proposedX =
          parentPos.x +
          Math.max(
            SUBGRAPH_PADDING,
            parentNodesMaxRight + MIXED_CONTENT_HORIZONTAL_SPACING
          )
        contentOriginX = Math.max(contentOriginX, proposedX)
        debugLog(
          `Adjusted child subgraph start position to X=${contentOriginX} for LR/RL to avoid parent nodes`
        )
      }
      // Keep Y anchored at content start for LR/RL to avoid growing height unnecessarily
    } else {
      if (maxNodeBottom > 0) {
        const nodeBottomInParentCoords = maxNodeBottom
        const proposedY =
          parentPos.y +
          nodeBottomInParentCoords +
          MIXED_CONTENT_VERTICAL_SPACING
        // Use the lower of the two positions (either normal content start or below existing nodes)
        contentOriginY = Math.max(contentOriginY, proposedY)
        debugLog(
          `Adjusted child subgraph start position to Y=${contentOriginY} to avoid parent nodes (added ${MIXED_CONTENT_VERTICAL_SPACING}px spacing)`
        )
      }
    }

    // Calculate the available space in the parent for centering (accounting for header + content margin)
    const availableWidth = parentLayout.width - SUBGRAPH_PADDING * 2
    const usedVerticalSpace = contentOriginY - parentPos.y
    const availableHeight =
      parentLayout.height - usedVerticalSpace - SUBGRAPH_PADDING

    // Calculate the actual content dimensions
    const contentWidth = maxRight - minLeft
    const contentHeight = maxBottom - minTop

    // Align children within the available parent space
    // For vertical flows (TB/BT), left-align to avoid excess right whitespace; center only horizontally oriented layouts
    const centerOffsetX = isHorizontal
      ? Math.max(0, (availableWidth - contentWidth) / 2)
      : 0
    const centerOffsetY = isHorizontal
      ? 0
      : Math.max(0, (availableHeight - contentHeight) / 2)

    // Position children with centering offset
    childIds.forEach((cid) => {
      const tl = childTopLefts.get(cid)!
      const absX = contentOriginX + centerOffsetX + (tl.x - minLeft)
      const absY = contentOriginY + centerOffsetY + (tl.y - minTop)
      subgraphPositions.set(cid, { x: absX, y: absY })
      processedSubgraphs.add(cid)
      debugLog(
        `Positioned nested subgraph "${cid}" within parent ${parentId} at (${absX}, ${absY}) with centering`
      )
    })

    // Ensure parent is large enough to contain both existing nodes and the centered children
    // Use generous padding to prevent overflow issues
    const requiredWidth = isHorizontal
      ? Math.max(
          contentWidth + SUBGRAPH_PADDING * 6,
          contentOriginX - parentPos.x + contentWidth + SUBGRAPH_PADDING * 3
        )
      : contentWidth + SUBGRAPH_PADDING * 6 // Extra generous padding for centering and overflow prevention

    // Calculate required height considering both node content and child subgraphs
    const childrenBottomBoundary =
      contentOriginY + centerOffsetY + (maxBottom - minTop) - parentPos.y
    const minRequiredHeight = isHorizontal
      ? Math.max(
          SUBGRAPH_HEADER_HEIGHT +
            SUBGRAPH_CONTENT_TOP_MARGIN +
            SUBGRAPH_PADDING * 2 +
            contentHeight +
            SUBGRAPH_PADDING * 2,
          300
        )
      : Math.max(
          childrenBottomBoundary + SUBGRAPH_PADDING * 4, // Height to fit positioned children with safety margin
          maxNodeBottom +
            MIXED_CONTENT_VERTICAL_SPACING +
            contentHeight +
            SUBGRAPH_PADDING * 4 // Height for nodes + spacing + children with safety margin
        )

    // Apply minimum dimensions to prevent cramped layouts
    const finalRequiredWidth = Math.max(requiredWidth, isHorizontal ? 600 : 400) // Wider min for LR/RL
    const finalRequiredHeight = Math.max(minRequiredHeight, 300) // Minimum height for readability

    if (
      finalRequiredWidth > parentLayout.width ||
      finalRequiredHeight > parentLayout.height
    ) {
      const oldWidth = parentLayout.width
      const oldHeight = parentLayout.height
      parentLayout.width = Math.max(parentLayout.width, finalRequiredWidth)
      parentLayout.height = Math.max(parentLayout.height, finalRequiredHeight)
      debugLog(
        `Expanded parent ${parentId} from ${oldWidth}x${oldHeight} to ${parentLayout.width}x${parentLayout.height} to fit nodes + ${childIds.length} child subgraphs (overflow-safe)`
      )
    }

    return true
  }

  // Process parents in waves from top-level down until all nested are positioned
  const processedParents = new Set<string>()
  let madeProgress = true
  let safetyCounter = 0
  while (madeProgress && safetyCounter < 100) {
    safetyCounter++
    madeProgress = false
    // For each subgraph that already has an absolute position, try to lay out its direct children once
    subgraphLayouts.forEach((_, id) => {
      if (subgraphPositions.has(id) && !processedParents.has(id)) {
        const progressed = layoutChildrenWithinParent(id)
        if (progressed) {
          madeProgress = true
          processedParents.add(id)
        }
      }
    })
  }
  if (safetyCounter === 100) {
    debugLog(
      'Warning: nested subgraph layout reached iteration cap; potential cyclic dependency'
    )
  }

  // Position standalone nodes
  standaloneNodes.forEach((node) => {
    const nodeLayout = g.node(node.id)
    if (nodeLayout) {
      const size = calculateNodeSize(node.label, node.shape)
      standalonePositions.set(node.id, {
        x: nodeLayout.x - size.width / 2,
        y: nodeLayout.y - size.height / 2,
      })
      debugLog(
        `Positioned standalone node ${node.id} at (${
          nodeLayout.x - size.width / 2
        }, ${nodeLayout.y - size.height / 2})`
      )
    } else {
      debugLog(
        `Warning: No position for standalone node ${node.id} in meta-graph`
      )
    }
  })

  return { subgraphPositions, standalonePositions }
}

// Phase 3: Combine layouts and create React Flow elements
function createReactFlowElements(
  nodes: MermaidNode[],
  edges: MermaidEdge[],
  subgraphs: SubgraphInfo[],
  subgraphLayouts: Map<string, SubgraphLayout>,
  subgraphPositions: Map<string, { x: number; y: number }>,
  standalonePositions: Map<string, { x: number; y: number }>,
  direction: string
): ReactFlowData {
  const reactFlowNodes: Node[] = []

  debugLog('Creating React Flow elements')

  // Color schemes
  function getNodeColors(shape: string) {
    const colorSchemes = {
      rect: ['#1C2336', '#3D5EA8'],
      diamond: ['#1C2336', '#3D5EA8'],
      circle: ['#1C2336', '#3D5EA8'],
      stadium: ['#1C2336', '#3D5EA8'],
      round: ['#1C2336', '#3D5EA8'],
    }

    const defaultColors = ['#1C2336', '#3D5EA8']
    const colors =
      colorSchemes[shape as keyof typeof colorSchemes] || defaultColors

    return {
      backgroundColor: colors[0],
      borderColor: colors[1],
    }
  }

  function getSubgraphColors(index: number) {
    const subgraphColors = [
      { bg: 'rgba(100, 181, 246, 0.08)', border: '#64B5F6' }, // Blue
      { bg: 'rgba(129, 199, 132, 0.08)', border: '#81C784' }, // Green
      { bg: 'rgba(186, 104, 200, 0.08)', border: '#BA68C8' }, // Purple
      { bg: 'rgba(255, 183, 77, 0.08)', border: '#FFB74D' }, // Orange
      { bg: 'rgba(240, 98, 146, 0.08)', border: '#F06292' }, // Pink
    ]
    return subgraphColors[index % subgraphColors.length]
  }

  // Process subgraphs in hierarchical order (parents first for proper rendering)
  const orderedSubgraphs = processSubgraphsInHierarchicalOrder(subgraphs)

  // Add subgraph containers in the correct order (parents before children)
  orderedSubgraphs.forEach((subgraph, index) => {
    const layout = subgraphLayouts.get(subgraph.id)
    const position = subgraphPositions.get(subgraph.id)

    if (layout && position) {
      const colors = getSubgraphColors(index)

      // React Flow expects child positions to be RELATIVE to their parent.
      // Our layoutMetaGraph currently stores ABSOLUTE positions for all subgraphs.
      // Convert to relative coordinates for nested subgraphs so they render in place
      // immediately (without requiring a drag to reflow).
      let finalPosition = position
      if (layout.parentId) {
        const parentAbsPos = subgraphPositions.get(layout.parentId)
        if (parentAbsPos) {
          finalPosition = {
            x: position.x - parentAbsPos.x,
            y: position.y - parentAbsPos.y,
          }
        }
      }

      reactFlowNodes.push({
        id: `subgraph-${subgraph.id}`,
        type: 'group',
        position: finalPosition,
        data: {
          backgroundColor: colors.bg,
          borderColor: colors.border,
          childNodes: subgraph.nodes,
          autoLayout: true,
          componentFields: [generateComponentFieldNameInput(subgraph.title)],
        },
        style: {
          width: layout.width,
          height: layout.height,
          zIndex: 0,
        },
        selectable: true,
        draggable: true,
        connectable: true,
        parentId: layout.parentId ? `subgraph-${layout.parentId}` : undefined,
        extent: layout.parentId ? 'parent' : undefined,
        zIndex: layout.parentId ? 1 : 0,
      })
    }
  })

  // Add nodes
  nodes.forEach((node) => {
    const colors = getNodeColors(node.shape)
    const { imageUrl, cleanLabel } = extractImageUrl(node.label)
    const { tag, displayLabel } = parseLabelTag(cleanLabel)
    const portalType = resolvePortalNodeType(!!imageUrl, tag)

    // Calculate node position based on whether it's in a subgraph or standalone
    let position: { x: number; y: number }
    let parentNode: string | undefined

    if (node.subgraph) {
      // Node positioning within a subgraph
      const subgraphLayout = subgraphLayouts.get(node.subgraph)
      const subgraphPosition = subgraphPositions.get(node.subgraph)
      const nodeLayout = subgraphLayout?.nodes.get(node.id)

      if (nodeLayout && subgraphPosition) {
        // CRITICAL: React Flow expects positions relative to parent group
        // nodeLayout coordinates are already positioned relative to subgraph (0,0)
        // We convert from center-based to top-left coordinates for React Flow
        position = {
          x: nodeLayout.x - nodeLayout.width / 2, // Convert center-x to top-left-x
          y: nodeLayout.y - nodeLayout.height / 2, // Convert center-y to top-left-y
        }
        parentNode = `subgraph-${node.subgraph}`

        debugLog(
          `Node ${node.id} positioned at (${position.x}, ${position.y}) within subgraph ${node.subgraph}`
        )
      } else {
        // Fallback position if layout data is missing
        position = { x: 0, y: 0 }
        debugLog(
          `Warning: Missing layout data for node ${node.id} in subgraph ${node.subgraph}`
        )
      }
    } else {
      // Standalone node positioning (global coordinates)
      const standalonePos = standalonePositions.get(node.id)
      position = standalonePos || { x: 0, y: 0 }

      debugLog(
        `Standalone node ${node.id} positioned at (${position.x}, ${position.y})`
      )
    }

    const isHorizontal = direction === 'LR' || direction === 'RL'
    const sourcePos = isHorizontal ? Position.Right : Position.Bottom
    const targetPos = isHorizontal ? Position.Left : Position.Top

    let wrapperWidth = 150
    let wrapperHeight = 60
    if (node.subgraph) {
      const subgraphLayout = subgraphLayouts.get(node.subgraph)
      const nodeLayout = subgraphLayout?.nodes.get(node.id)
      if (nodeLayout) {
        wrapperWidth = Math.max(20, Math.round(nodeLayout.width))
        wrapperHeight = Math.max(20, Math.round(nodeLayout.height))
      }
    } else {
      const size = calculateNodeSize(node.label, node.shape, !!imageUrl)
      wrapperWidth = Math.max(20, Math.round(size.width))
      wrapperHeight = Math.max(20, Math.round(size.height))
    }

    let data: Record<string, unknown>
    switch (portalType.toLowerCase()) {
      case 'image':
        data = { src: imageUrl ?? '' }
        break

      case 'shape': {
        const portalShapeId = MERMAID_TO_PORTAL_SHAPE[node.shape] ?? 'rectangle'
        data = {
          shape: portalShapeId,
          componentFields: [generateComponentFieldNameInput(displayLabel)],
          fill: colors.backgroundColor,
          stroke: colors.borderColor,
          strokeWidth: 2,
        }
        break
      }

      case 'default':
        data = {
          name: displayLabel,
          label: displayLabel,
          description: '',
          componentId: 'file-note',
        }
        break

      case 'builder':
        data = {
          componentName: 'file-note',
          componentFields: [
            generateComponentFieldNameInput(displayLabel),
            generateComponentFieldInput({
              label: 'Label',
              data: displayLabel,
              type: ComponentInputType.TextInput,
            }),
            generateComponentFieldInput({
              label: 'Description',
              data: '',
              type: ComponentInputType.TextBox,
            }),
          ],
        }
        break

      case 'text':
        data = {
          componentFields: [
            generateComponentFieldInput({
              componentFieldId: 'text',
              label: 'Text',
              data: displayLabel,
              type: ComponentInputType.TextBox,
            }),
          ],
        }
        break

      case 'code':
        data = {
          componentFields: [
            generateComponentFieldNameInput(displayLabel),
            generateComponentFieldInput({
              label: 'Code',
              data: '',
              type: ComponentInputType.CodeEditor,
            }),
          ],
        }
        break

      case 'table':
        data = {
          componentFields: [generateComponentFieldNameInput(displayLabel)],
          columns: ['Task', 'Owner', 'Status', 'Due'],
          rows: [
            ['Website revamp', 'Amara', 'In progress', 'May 12'],
            ['Marketing sync', 'Liu', 'Blocked', 'May 15'],
          ],
        }
        break

      case 'cloud':
        data = {
          componentFields: [generateComponentFieldNameInput(displayLabel)],
        }
        break

      case 'comment':
        data = {
          componentFields: [generateComponentFieldNameInput(displayLabel)],
        }
        break

      default:
        data = {
          name: displayLabel,
          label: displayLabel,
          description: '',
          componentId: 'file-note',
        }
    }

    reactFlowNodes.push({
      id: node.id,
      type: portalType,
      position,
      data,
      style: { width: wrapperWidth, height: wrapperHeight },
      sourcePosition: sourcePos,
      targetPosition: targetPos,
      parentId: parentNode,
      extent: parentNode ? 'parent' : undefined,
      draggable: true,
      zIndex: 1,
    })
  })

  // Create edges with consistent styling
  const reactFlowEdges: Edge[] = edges.map((edge, index) => {
    const edgeStyle: {
      strokeWidth: number
      strokeDasharray?: string
    } = {
      strokeWidth: 2.5,
    }

    const edgeType = 'default'

    switch (edge.type) {
      case '-->':

      case '->':
        break

      case '---':
        edgeStyle.strokeDasharray = '8,4'
        break

      case '-.-':
        edgeStyle.strokeDasharray = '4,4'
        break

      case '==>':

      case '===>':
        edgeStyle.strokeWidth = 4
        break
    }

    // Adjust source and target IDs if they refer to subgraphs
    const sourceId = edge.isSourceSubgraph
      ? `subgraph-${edge.source}`
      : edge.source
    const targetId = edge.isTargetSubgraph
      ? `subgraph-${edge.target}`
      : edge.target

    // Create edge with explicit properties - ensure consistent styling
    return {
      id: `edge-${edge.source}-${edge.target}-${index}`,
      source: sourceId,
      target: targetId,
      label: edge.label,
      type: edgeType,
      style: edgeStyle,
      labelStyle: {
        fontSize: '12px',
        fontWeight: '500',
        color: '#E2E8F0',
        backgroundColor: '#1E293B',
        padding: '2px 6px',
      },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 20,
        height: 20,
      },
      sourceHandle:
        direction === 'LR' || direction === 'RL'
          ? 'source-right'
          : 'source-bottom',
      targetHandle:
        direction === 'LR' || direction === 'RL' ? 'target-left' : 'target-top',
      zIndex: 0,
    }
  })

  return { nodes: reactFlowNodes, edges: reactFlowEdges }
}

// Main layout function using the three-phase approach
function layoutGraph(
  nodes: MermaidNode[],
  edges: MermaidEdge[],
  subgraphs: SubgraphInfo[],
  direction: string
): { nodes: Node[]; edges: Edge[] } {
  debugLog('Starting graph layout with direction:', direction)
  debugLog(
    `Input: ${nodes.length} nodes, ${edges.length} edges, ${subgraphs.length} subgraphs`
  )

  // Phase 1: Layout each subgraph independently
  const subgraphLayouts = layoutSubgraphs(nodes, edges, subgraphs, direction)

  // Phase 2: Layout meta-graph (containers + standalone nodes)
  const { subgraphPositions, standalonePositions } = layoutMetaGraph(
    nodes,
    edges,
    subgraphLayouts,
    direction
  )

  // Phase 2.5: Post-positioning adjustment - ensure parent containers properly contain positioned children
  const orderedSubgraphs = processSubgraphsInHierarchicalOrder(subgraphs)
  adjustParentSizesAfterPositioning(
    subgraphLayouts,
    subgraphPositions,
    orderedSubgraphs,
    direction
  )

  // Phase 3: Combine layouts and create React Flow elements
  return createReactFlowElements(
    nodes,
    edges,
    subgraphs,
    subgraphLayouts,
    subgraphPositions,
    standalonePositions,
    direction
  )
}

// Debug helper: run full conversion but return intermediate structures for inspection
export async function debugConvertMermaid(mermaidCode: string): Promise<any> {
  const { nodes, edges, subgraphs, direction } = parseMermaidCode(mermaidCode)

  const subgraphLayouts = layoutSubgraphs(nodes, edges, subgraphs, direction)
  const { subgraphPositions, standalonePositions } = layoutMetaGraph(
    nodes,
    edges,
    subgraphLayouts,
    direction
  )

  const orderedSubgraphs = processSubgraphsInHierarchicalOrder(subgraphs)
  adjustParentSizesAfterPositioning(
    subgraphLayouts,
    subgraphPositions,
    orderedSubgraphs,
    direction
  )

  const reactFlowData = createReactFlowElements(
    nodes,
    edges,
    subgraphs,
    subgraphLayouts,
    subgraphPositions,
    standalonePositions,
    direction
  )

  // Convert Maps to plain objects/arrays for JSON-friendly output
  const subgraphLayoutsPlain: Record<string, any> = {}
  subgraphLayouts.forEach((v, k) => {
    subgraphLayoutsPlain[k] = {
      id: v.id,
      title: v.title,
      width: v.width,
      height: v.height,
      parentId: v.parentId,
      nodes: Array.from(v.nodes.entries()).map(([nid, pos]) => ({
        id: nid,
        ...pos,
      })),
    }
  })

  const subgraphPositionsPlain = Object.fromEntries(
    Array.from(subgraphPositions.entries())
  )
  const standalonePositionsPlain = Object.fromEntries(
    Array.from(standalonePositions.entries())
  )

  return {
    nodes,
    edges,
    subgraphs,
    direction,
    subgraphLayouts: subgraphLayoutsPlain,
    subgraphPositions: subgraphPositionsPlain,
    standalonePositions: standalonePositionsPlain,
    reactFlowData,
  }
}

export async function convertFlowChartToReactFlow(
  mermaidCode: string
): Promise<ReactFlowData> {
  debugLog('Starting Mermaid to React Flow conversion')
  debugLog('Mermaid code:', mermaidCode)

  const { nodes, edges, subgraphs, direction } = parseMermaidCode(mermaidCode)

  if (nodes.length === 0) {
    debugLog('No nodes found in Mermaid diagram')
    return { nodes: [], edges: [] }
  }

  debugLog(
    `Parsed ${nodes.length} nodes, ${edges.length} edges, ${subgraphs.length} subgraphs`
  )

  const graphedResult = layoutGraph(nodes, edges, subgraphs, direction)
  return {
    nodes: graphedResult.nodes.map((node) => ({
      ...node,
      data: { ...node.data, source: 'mermaid' },
    })),
    edges: graphedResult.edges.map((edge) => ({
      ...edge,
      data: { ...edge.data, source: 'mermaid' },
    })),
  }
}
