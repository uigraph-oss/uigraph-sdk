/**
 * Sugiyama-style Layered Graph Layout for ER Diagrams
 *
 * Implements a proper hierarchical graph layout algorithm optimized for SQL schemas:
 * 1. Cycle breaking (feedback arc set)
 * 2. Layer assignment (topological ranking)
 * 3. Crossing minimization (barycenter + median heuristic)
 * 4. Coordinate assignment with compaction
 */

import {
  DEFAULT_NODE_X_OFFSET_LAYER,
  DEFAULT_NODE_X_SPACING,
  DEFAULT_NODE_Y_OFFSET_LAYER,
  DEFAULT_NODE_Y_SPACING,
} from './constants'

export interface TableNode {
  id: string
  width: number
  height: number
  columns: Array<{
    name: string
    isPrimaryKey: boolean
    isForeignKey: boolean
  }>
}

export interface TableEdge {
  source: string
  target: string
  sourceColumn: string
  targetColumn: string
  weight: number // Higher for PK→FK relationships
}

export interface LayoutResult {
  positions: Record<string, { x: number; y: number }>
  layers: Map<number, string[]>
  reversedEdges: Set<string> // Edges that were reversed for cycle breaking
  ports: Record<string, { left: string[]; right: string[] }> // Column ports
}

/**
 * Main layout function using Sugiyama framework
 */
export function computeLayeredLayout(
  nodes: TableNode[],
  edges: TableEdge[],
  config: {
    horizontalSpacing?: number
    verticalSpacing?: number
    startX?: number
    startY?: number
  } = {}
): LayoutResult {
  const {
    horizontalSpacing = DEFAULT_NODE_X_SPACING,
    verticalSpacing = DEFAULT_NODE_Y_SPACING,
    startX = DEFAULT_NODE_X_OFFSET_LAYER,
    startY = DEFAULT_NODE_Y_OFFSET_LAYER,
  } = config

  // Step 1: Break cycles
  const { acyclicEdges, reversedEdges } = breakCycles(nodes, edges)

  // Step 2: Detect and handle join tables
  const joinTables = detectJoinTables(nodes, edges)

  // Step 3: Assign layers (topological ranking with hub bias)
  const layers = assignLayers(nodes, acyclicEdges, joinTables)

  // Step 4: Minimize crossings (multiple heuristics + adjacent swap)
  minimizeCrossings(layers, acyclicEdges, joinTables, 4)

  // Step 5: Local adjacent-swap optimization
  adjacentSwapOptimization(layers, acyclicEdges)

  // Step 6: Position join tables between parents
  positionJoinTables(nodes, layers, joinTables, acyclicEdges)

  // Step 7: Assign coordinates with compaction
  const positions = assignCoordinates(
    nodes,
    layers,
    horizontalSpacing,
    verticalSpacing,
    startX,
    startY
  )

  // Step 8: Column balancing for vertical alignment
  balanceColumns(positions, layers)

  // Step 9: Calculate port positions
  const ports = calculatePorts(nodes)

  return {
    positions,
    layers,
    reversedEdges,
    ports,
  }
}

/**
 * Step 1: Break cycles using greedy feedback arc set heuristic
 */
function breakCycles(
  nodes: TableNode[],
  edges: TableEdge[]
): {
  acyclicEdges: TableEdge[]
  reversedEdges: Set<string>
} {
  const reversedEdges = new Set<string>()
  const acyclicEdges: TableEdge[] = []

  // Build adjacency lists
  const outgoing = new Map<string, Set<string>>()
  const incoming = new Map<string, Set<string>>()
  const edgeMap = new Map<string, TableEdge>()

  nodes.forEach((node) => {
    outgoing.set(node.id, new Set())
    incoming.set(node.id, new Set())
  })

  edges.forEach((edge) => {
    const key = `${edge.source}->${edge.target}`
    edgeMap.set(key, edge)
    outgoing.get(edge.source)?.add(edge.target)
    incoming.get(edge.target)?.add(edge.source)
  })

  // Greedy cycle breaking: process nodes with highest out-degree - in-degree first
  const remaining = new Set(nodes.map((n) => n.id))
  const leftSequence: string[] = []
  const rightSequence: string[] = []

  while (remaining.size > 0) {
    // Find sources (no incoming edges from remaining nodes)
    const sources = [...remaining].filter((node) => {
      const inEdges = incoming.get(node) || new Set()
      return ![...inEdges].some((src) => remaining.has(src))
    })

    if (sources.length > 0) {
      sources.forEach((node) => {
        leftSequence.push(node)
        remaining.delete(node)
      })
      continue
    }

    // Find sinks (no outgoing edges to remaining nodes)
    const sinks = [...remaining].filter((node) => {
      const outEdges = outgoing.get(node) || new Set()
      return ![...outEdges].some((tgt) => remaining.has(tgt))
    })

    if (sinks.length > 0) {
      sinks.forEach((node) => {
        rightSequence.unshift(node) // Add to front
        remaining.delete(node)
      })
      continue
    }

    // No sources or sinks: pick node with highest out-degree - in-degree
    let maxDelta = -Infinity
    let maxNode = remaining.values().next().value

    remaining.forEach((node) => {
      const outDegree = (outgoing.get(node) || new Set()).size
      const inDegree = (incoming.get(node) || new Set()).size
      const delta = outDegree - inDegree
      if (delta > maxDelta) {
        maxDelta = delta
        maxNode = node
      }
    })

    if (maxNode) {
      leftSequence.push(maxNode)
      remaining.delete(maxNode)
    }
  }

  const ordering = [...leftSequence, ...rightSequence]
  const position = new Map(ordering.map((id, idx) => [id, idx]))

  // Reverse edges that go backward in the ordering
  edges.forEach((edge) => {
    const sourcePos = position.get(edge.source)!
    const targetPos = position.get(edge.target)!

    if (sourcePos < targetPos) {
      acyclicEdges.push(edge)
    } else {
      // Reverse this edge
      const key = `${edge.source}->${edge.target}`
      reversedEdges.add(key)
      acyclicEdges.push({
        ...edge,
        source: edge.target,
        target: edge.source,
      })
    }
  })

  return { acyclicEdges, reversedEdges }
}

/**
 * Step 2: Assign layers using longest path method with hub bias
 */
function assignLayers(
  nodes: TableNode[],
  edges: TableEdge[],
  joinTables: Set<string>
): Map<number, string[]> {
  const layers = new Map<string, number>()

  // Build adjacency list
  const outgoing = new Map<string, Set<string>>()
  const incoming = new Map<string, Set<string>>()

  nodes.forEach((node) => {
    outgoing.set(node.id, new Set())
    incoming.set(node.id, new Set())
  })

  edges.forEach((edge) => {
    outgoing.get(edge.source)?.add(edge.target)
    incoming.get(edge.target)?.add(edge.source)
  })

  // Calculate hub scores (outDegree - inDegree)
  const hubScores = new Map<string, number>()
  nodes.forEach((node) => {
    const outDegree = (outgoing.get(node.id) || new Set()).size
    const inDegree = (incoming.get(node.id) || new Set()).size
    const score = Math.max(-2, Math.min(2, outDegree - inDegree)) // Clamped
    hubScores.set(node.id, score * 0.3) // Small bias factor
  })

  // Assign layers using longest path (ensures minimal edge span)
  const visited = new Set<string>()

  function assignLayer(nodeId: string, layer: number) {
    if (!layers.has(nodeId) || layers.get(nodeId)! < layer) {
      layers.set(nodeId, layer)
    }

    if (visited.has(nodeId)) return
    visited.add(nodeId)

    const children = outgoing.get(nodeId) || new Set()
    children.forEach((child) => {
      assignLayer(child, layer + 1)
    })

    visited.delete(nodeId)
  }

  // Start from roots (nodes with no incoming edges)
  const roots = nodes.filter((node) => {
    const inc = incoming.get(node.id) || new Set()
    return inc.size === 0
  })

  if (roots.length === 0) {
    // No roots (all nodes in cycles), start from hub nodes
    const sortedByHub = [...nodes].sort((a, b) => {
      return (hubScores.get(b.id) || 0) - (hubScores.get(a.id) || 0)
    })
    sortedByHub.slice(0, 3).forEach((node) => assignLayer(node.id, 0))
  } else {
    roots.forEach((root) => assignLayer(root.id, 0))
  }

  // Ensure all nodes have a layer
  nodes.forEach((node) => {
    if (!layers.has(node.id)) {
      layers.set(node.id, 0)
    }
  })

  // Apply hub bias to ranks (hubs gravitate toward top/middle)
  nodes.forEach((node) => {
    const baseRank = layers.get(node.id)!
    const bias = hubScores.get(node.id) || 0
    const adjustedRank = Math.max(0, Math.round(baseRank - bias))
    layers.set(node.id, adjustedRank)
  })

  // Special positioning for join tables: place between parents
  joinTables.forEach((joinId) => {
    const parents = [...(incoming.get(joinId) || new Set())]
    if (parents.length >= 2) {
      const parentRanks = parents.map((p) => layers.get(p) || 0)
      const maxParentRank = Math.max(...parentRanks)
      layers.set(joinId, maxParentRank + 1)
    }
  })

  // Group by layer
  const layerGroups = new Map<number, string[]>()
  layers.forEach((layer, nodeId) => {
    if (!layerGroups.has(layer)) {
      layerGroups.set(layer, [])
    }
    layerGroups.get(layer)!.push(nodeId)
  })

  return layerGroups
}

/**
 * Step 3: Detect join tables (association tables with mostly FKs)
 */
function detectJoinTables(
  nodes: TableNode[],
  _edges: TableEdge[]
): Set<string> {
  const joinTables = new Set<string>()

  nodes.forEach((node) => {
    const fkCount = node.columns.filter((c) => c.isForeignKey).length
    const nonFkCount = node.columns.filter((c) => !c.isForeignKey).length

    // Join table heuristic: 2+ FKs and few other columns
    if (fkCount >= 2 && nonFkCount <= 2) {
      joinTables.add(node.id)
    }
  })

  return joinTables
}

/**
 * Step 4: Minimize crossings using combined heuristics
 */
function minimizeCrossings(
  layers: Map<number, string[]>,
  edges: TableEdge[],
  joinTables: Set<string>,
  iterations: number
) {
  const maxLayer = Math.max(...layers.keys())

  // Build edge maps
  const outgoing = new Map<string, Array<{ target: string; weight: number }>>()
  const incoming = new Map<string, Array<{ source: string; weight: number }>>()

  edges.forEach((edge) => {
    if (!outgoing.has(edge.source)) {
      outgoing.set(edge.source, [])
    }
    outgoing
      .get(edge.source)!
      .push({ target: edge.target, weight: edge.weight })

    if (!incoming.has(edge.target)) {
      incoming.set(edge.target, [])
    }
    incoming
      .get(edge.target)!
      .push({ source: edge.source, weight: edge.weight })
  })

  // Iterative crossing minimization
  for (let iter = 0; iter < iterations; iter++) {
    // Top-down pass: optimize based on parents
    for (let layer = 1; layer <= maxLayer; layer++) {
      const nodes = layers.get(layer) || []
      if (nodes.length <= 1) continue

      const prevLayer = layers.get(layer - 1) || []
      const positionMap = new Map(prevLayer.map((id, idx) => [id, idx]))

      // Calculate barycenter and median for each node
      const metrics = nodes.map((nodeId) => {
        const parents = incoming.get(nodeId) || []
        if (parents.length === 0) return { nodeId, barycenter: 0, median: 0 }

        const positions = parents
          .map((p) => positionMap.get(p.source))
          .filter((pos): pos is number => pos !== undefined)
          .sort((a, b) => a - b)

        const weightedSum = parents.reduce((sum, p) => {
          const pos = positionMap.get(p.source)
          return pos !== undefined ? sum + pos * p.weight : sum
        }, 0)
        const totalWeight = parents.reduce((sum, p) => sum + p.weight, 0)

        const barycenter = totalWeight > 0 ? weightedSum / totalWeight : 0
        const median =
          positions.length > 0 ? positions[Math.floor(positions.length / 2)] : 0

        return { nodeId, barycenter, median }
      })

      // Sort by barycenter (prefer median for join tables)
      metrics.sort((a, b) => {
        const aValue = joinTables.has(a.nodeId) ? a.median : a.barycenter
        const bValue = joinTables.has(b.nodeId) ? b.median : b.barycenter
        return aValue - bValue
      })

      layers.set(
        layer,
        metrics.map((m) => m.nodeId)
      )
    }

    // Bottom-up pass: optimize based on children
    for (let layer = maxLayer - 1; layer >= 0; layer--) {
      const nodes = layers.get(layer) || []
      if (nodes.length <= 1) continue

      const nextLayer = layers.get(layer + 1) || []
      const positionMap = new Map(nextLayer.map((id, idx) => [id, idx]))

      const metrics = nodes.map((nodeId) => {
        const children = outgoing.get(nodeId) || []
        if (children.length === 0) {
          const currentLayer = layers.get(layer) || []
          return {
            nodeId,
            barycenter: currentLayer.indexOf(nodeId),
            median: currentLayer.indexOf(nodeId),
          }
        }

        const positions = children
          .map((c) => positionMap.get(c.target))
          .filter((pos): pos is number => pos !== undefined)
          .sort((a, b) => a - b)

        const weightedSum = children.reduce((sum, c) => {
          const pos = positionMap.get(c.target)
          return pos !== undefined ? sum + pos * c.weight : sum
        }, 0)
        const totalWeight = children.reduce((sum, c) => sum + c.weight, 0)

        const barycenter =
          totalWeight > 0 ? weightedSum / totalWeight : positions[0] || 0
        const median =
          positions.length > 0 ? positions[Math.floor(positions.length / 2)] : 0

        return { nodeId, barycenter, median }
      })

      metrics.sort((a, b) => {
        const aValue = joinTables.has(a.nodeId) ? a.median : a.barycenter
        const bValue = joinTables.has(b.nodeId) ? b.median : b.barycenter
        return aValue - bValue
      })

      layers.set(
        layer,
        metrics.map((m) => m.nodeId)
      )
    }
  }
}

/**
 * Step 5: Adjacent-swap optimization for local crossing reduction
 * Performs cheap local swaps to eliminate remaining crossings
 */
function adjacentSwapOptimization(
  layers: Map<number, string[]>,
  edges: TableEdge[]
) {
  const maxLayer = Math.max(...layers.keys())

  // Build edge map for fast crossing calculation
  const _edgeSet = new Set(edges.map((e) => `${e.source}->${e.target}`))

  // Count crossings between two nodes
  function countCrossings(layer: string[], idx1: number, idx2: number): number {
    const node1 = layer[idx1]
    const node2 = layer[idx2]
    let crossings = 0

    // Check all edge pairs
    edges.forEach((e1) => {
      if (e1.source !== node1 && e1.target !== node1) return
      edges.forEach((e2) => {
        if (e2.source !== node2 && e2.target !== node2) return

        // Check if these edges cross
        const e1SourceIdx = layer.indexOf(e1.source)
        const e1TargetIdx = layer.indexOf(e1.target)
        const e2SourceIdx = layer.indexOf(e2.source)
        const e2TargetIdx = layer.indexOf(e2.target)

        if (
          (e1SourceIdx < e2SourceIdx && e1TargetIdx > e2TargetIdx) ||
          (e1SourceIdx > e2SourceIdx && e1TargetIdx < e2TargetIdx)
        ) {
          crossings++
        }
      })
    })

    return crossings
  }

  // Sweep through each layer
  for (let layer = 0; layer <= maxLayer; layer++) {
    const layerNodes = layers.get(layer) || []
    if (layerNodes.length <= 1) continue

    let improved = true
    let iterations = 0
    const maxIterations = 5 // Limit iterations

    while (improved && iterations < maxIterations) {
      improved = false
      iterations++

      for (let i = 0; i < layerNodes.length - 1; i++) {
        const before = countCrossings(layerNodes, i, i + 1)

        // Try swap
        ;[layerNodes[i], layerNodes[i + 1]] = [layerNodes[i + 1], layerNodes[i]]
        const after = countCrossings(layerNodes, i, i + 1)

        if (after < before) {
          // Keep swap
          improved = true
        } else {
          // Revert swap
          ;[layerNodes[i], layerNodes[i + 1]] = [
            layerNodes[i + 1],
            layerNodes[i],
          ]
        }
      }
    }

    layers.set(layer, layerNodes)
  }
}

/**
 * Step 6: Position join tables between their parents (x-coordinate)
 * This is done after layer assignment but before final coordinate assignment
 */
function positionJoinTables(
  nodes: TableNode[],
  layers: Map<number, string[]>,
  joinTables: Set<string>,
  edges: TableEdge[]
) {
  // Build parent map
  const incoming = new Map<string, Set<string>>()
  nodes.forEach((node) => incoming.set(node.id, new Set()))
  edges.forEach((edge) => {
    incoming.get(edge.target)?.add(edge.source)
  })

  // For each join table, try to position it between parents in ordering
  joinTables.forEach((joinId) => {
    const parents = [...(incoming.get(joinId) || new Set())]
    if (parents.length >= 2) {
      // Find layer containing join table
      let joinLayer = -1
      let joinIndex = -1

      layers.forEach((layerNodes, layerIdx) => {
        const idx = layerNodes.indexOf(joinId)
        if (idx !== -1) {
          joinLayer = layerIdx
          joinIndex = idx
        }
      })

      if (joinLayer === -1) return

      // Find parent positions in previous layer(s)
      const parentPositions: number[] = []
      layers.forEach((layerNodes, layerIdx) => {
        if (layerIdx < joinLayer) {
          parents.forEach((parent) => {
            const idx = layerNodes.indexOf(parent)
            if (idx !== -1) {
              parentPositions.push(idx)
            }
          })
        }
      })

      if (parentPositions.length >= 2) {
        // Calculate optimal position (average of parents)
        const avgPosition =
          parentPositions.reduce((a, b) => a + b, 0) / parentPositions.length
        const targetIndex = Math.round(avgPosition)

        // Move join table to target position in its layer
        const layerNodes = layers.get(joinLayer)!
        layerNodes.splice(joinIndex, 1)
        const insertIdx = Math.min(targetIndex, layerNodes.length)
        layerNodes.splice(insertIdx, 0, joinId)
        layers.set(joinLayer, layerNodes)
      }
    }
  })
}

/**
 * Step 7: Assign coordinates with compaction
 */
function assignCoordinates(
  nodes: TableNode[],
  layers: Map<number, string[]>,
  horizontalSpacing: number,
  verticalSpacing: number,
  startX: number,
  startY: number
): Record<string, { x: number; y: number }> {
  const positions: Record<string, { x: number; y: number }> = {}
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))

  layers.forEach((layerNodes, layerIndex) => {
    let currentX = startX

    layerNodes.forEach((nodeId) => {
      const node = nodeMap.get(nodeId)
      const nodeWidth = node?.width || 350

      positions[nodeId] = {
        x: currentX,
        y: startY + layerIndex * verticalSpacing,
      }

      // Add spacing: node width + gap
      currentX += nodeWidth + (horizontalSpacing - nodeWidth)
    })
  })

  return positions
}

/**
 * Step 8: Balance columns for vertical alignment
 * Aligns nodes vertically within layers to reduce zig-zags
 */
function balanceColumns(
  positions: Record<string, { x: number; y: number }>,
  layers: Map<number, string[]>
) {
  // For each layer, find the median x position and shift slightly toward it
  layers.forEach((layerNodes) => {
    if (layerNodes.length <= 2) return

    const xPositions = layerNodes
      .map((id) => positions[id].x)
      .sort((a, b) => a - b)
    const median = xPositions[Math.floor(xPositions.length / 2)]

    // Gentle pull toward median (10% adjustment)
    layerNodes.forEach((id) => {
      const currentX = positions[id].x
      const delta = (median - currentX) * 0.1
      positions[id].x += delta
    })
  })
}

/**
 * Step 9: Calculate port positions for columns
 * PKs on WEST (left), FKs on EAST (right)
 */
function calculatePorts(
  nodes: TableNode[]
): Record<string, { left: string[]; right: string[] }> {
  const ports: Record<string, { left: string[]; right: string[] }> = {}

  nodes.forEach((node) => {
    const left: string[] = []
    const right: string[] = []

    // Sort columns: PKs → FKs → others
    const sortedColumns = [...node.columns].sort((a, b) => {
      if (a.isPrimaryKey && !b.isPrimaryKey) return -1
      if (!a.isPrimaryKey && b.isPrimaryKey) return 1
      if (a.isForeignKey && !b.isForeignKey) return 1
      if (!a.isForeignKey && b.isForeignKey) return -1
      return 0
    })

    sortedColumns.forEach((col) => {
      if (col.isPrimaryKey) {
        left.push(col.name) // PKs on WEST (left)
      }
      if (col.isForeignKey) {
        right.push(col.name) // FKs on EAST (right)
      }
    })

    ports[node.id] = { left, right }
  })

  return ports
}
