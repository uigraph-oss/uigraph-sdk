import { MermaidEdge, MermaidNode, SubgraphInfo } from '../../types'
import { debugLog } from '../helpers'

// The `cleanLabel` helper was previously used to strip HTML from labels and
// normalize line breaks. It is currently unused because we use `enhancedCleanLabel`
// throughout parsing which provides better unicode and escape handling.
//
// Keeping the original implementation commented out for reference and to
// make it easy to re-enable if needed in the future.
/*
function cleanLabel(label: string): string {
  return label
    .replace(/<br\s*\/?>(/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .trim();
}
*/

function getNodeShape(nodeDefinition: string): string {
  if (nodeDefinition.includes('{') && nodeDefinition.includes('}'))
    return 'diamond'
  if (nodeDefinition.includes('((') && nodeDefinition.includes('))'))
    return 'circle'
  if (nodeDefinition.includes('([') && nodeDefinition.includes('])'))
    return 'stadium'
  if (nodeDefinition.includes('[') && nodeDefinition.includes(']'))
    return 'rect'
  if (nodeDefinition.includes('(') && nodeDefinition.includes(')'))
    return 'round'
  return 'rect'
}

// Update the parseMermaidCode function to handle subgraph connections

export function parseMermaidCode(code: string): {
  nodes: MermaidNode[]
  edges: MermaidEdge[]
  subgraphs: SubgraphInfo[]
  direction: string
} {
  const nodes: MermaidNode[] = []
  const edges: MermaidEdge[] = []
  const subgraphs: SubgraphInfo[] = []
  const nodeMap = new Map<string, MermaidNode>()
  const subgraphMap = new Map<string, SubgraphInfo>()

  // Track all node definitions found in the code
  const nodeDefinitions = new Map<
    string,
    { label: string; shape: string; fullDef: string }
  >()

  // Default direction is top-to-bottom
  let direction = 'TB'

  // Remove comments and clean up the code
  let cleanCode = code
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('%%'))
    .join('\n')

  // Pre-process to fix multi-line node definitions
  // This handles cases where labels are split across lines like:
  // AI["Transactions Database
  // (MySQL)"]
  const preprocessedLines: string[] = []
  const rawLines = cleanCode.split('\n')
  let i = 0

  while (i < rawLines.length) {
    const line = rawLines[i].trim()

    // Check if this line has an unclosed bracket (indicating a multi-line definition)
    const openBrackets = (line.match(/[\[\(\{]/g) || []).length
    const closeBrackets = (line.match(/[\]\)\}]/g) || []).length

    if (openBrackets > closeBrackets && i < rawLines.length - 1) {
      // This line has unclosed brackets, try to find the closing line
      let combinedLine = line
      let j = i + 1
      let currentOpenBrackets = openBrackets
      let currentCloseBrackets = closeBrackets

      while (
        j < rawLines.length &&
        currentOpenBrackets > currentCloseBrackets
      ) {
        const nextLine = rawLines[j].trim()
        combinedLine += ' ' + nextLine

        currentOpenBrackets += (nextLine.match(/[\[\(\{]/g) || []).length
        currentCloseBrackets += (nextLine.match(/[\]\)\}]/g) || []).length
        j++
      }

      preprocessedLines.push(combinedLine)
      i = j // Skip the lines we just combined
    } else {
      preprocessedLines.push(line)
      i++
    }
  }

  // Update cleanCode with preprocessed lines
  cleanCode = preprocessedLines.join('\n')

  debugLog('Clean code:', cleanCode)

  // Parse graph direction - Updated to handle both flowchart and graph
  const directionMatch = cleanCode.match(
    /(?:flowchart|graph)\s+(TB|TD|BT|RL|LR)/i
  )
  if (directionMatch) {
    direction = directionMatch[1].toUpperCase()
    // Normalize TD to TB
    if (direction === 'TD') direction = 'TB'
    debugLog('Detected graph direction:', direction)
  }

  const lines = cleanCode.split('\n')
  const subgraphStack: string[] = []

  // Enhanced cleanLabel function to handle unicode and special characters
  function enhancedCleanLabel(label: string): string {
    return label
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]*>/g, '')
      .replace(/\\u([0-9a-fA-F]{4})/g, (match, code) => {
        try {
          return String.fromCharCode(parseInt(code, 16))
        } catch {
          debugLog(`Warning: Could not parse unicode character: ${match}`)
          return match
        }
      })
      .replace(/\\n/g, '\n')
      .replace(/\s*\n\s*/g, '\n') // Normalize line breaks and remove extra whitespace
      .trim()
  }

  // Pre-scan to find all node definitions
  debugLog('Pre-scanning for node definitions...')
  lines.forEach((line, lineIndex) => {
    const trimmedLine = line.trim()
    if (
      !trimmedLine ||
      trimmedLine.startsWith('subgraph') ||
      trimmedLine === 'end' ||
      trimmedLine.startsWith('%%')
    )
      return

    // Improved node definition scanner: match complete node definitions
    // Look for node definitions that appear at word boundaries or after arrows/spaces
    // This prevents matching letters within labels
    const nodeDefPattern = /(^|[\s\-\>]|\|[^|]*\|)([A-Za-z0-9_]+)([\[\(\{])/g
    let match
    const processedMatches = new Set() // Track processed positions to avoid duplicates

    while ((match = nodeDefPattern.exec(trimmedLine)) !== null) {
      const prefix = match[1]
      const nodeId = match[2]
      const openChar = match[3]
      const matchStart = match.index + prefix.length // Start of node ID

      // Skip if we already processed this position or if node already exists
      if (processedMatches.has(matchStart) || nodeDefinitions.has(nodeId))
        continue
      processedMatches.add(matchStart)

      const openIndex = matchStart + nodeId.length // position of opening bracket
      const closeChar = openChar === '[' ? ']' : openChar === '(' ? ')' : '}'

      // Find the matching closing bracket, considering nesting
      let closeIndex = -1
      let depth = 0
      for (let i = openIndex; i < trimmedLine.length; i++) {
        const char = trimmedLine[i]
        if (char === openChar) {
          depth++
        } else if (char === closeChar) {
          depth--
          if (depth === 0) {
            closeIndex = i
            break
          }
        }
      }

      let fullDef = nodeId
      let shapeDef = ''
      if (closeIndex !== -1) {
        fullDef = trimmedLine.slice(matchStart, closeIndex + 1)
        shapeDef = trimmedLine.slice(openIndex, closeIndex + 1)
      } else {
        // Fallback: try to find any bracket sequence starting from our position
        const remainingLine = trimmedLine.slice(matchStart)
        const fallback = remainingLine.match(
          /([A-Za-z0-9_]+)([\[\(\{][^\]\)\}]*[\]\)\}])/
        )
        if (fallback && fallback[1] === nodeId) {
          fullDef = fallback[0]
          shapeDef = fallback[2]
        }
      }

      // Only process if we have a valid shape definition
      if (shapeDef) {
        const shape = getNodeShape(fullDef)

        let rawLabel = nodeId
        const labelContentMatch = shapeDef.match(/^[\[\(\{](.*)[\]\)\}]$/s)
        if (labelContentMatch) {
          rawLabel = labelContentMatch[1]
          // Strip surrounding quotes if present
          rawLabel = rawLabel
            .replace(/^"(.*)"$/, '$1')
            .replace(/^'(.*)'$/, '$1')
        }

        const label = enhancedCleanLabel(rawLabel)
        nodeDefinitions.set(nodeId, { label, shape, fullDef })
        debugLog(
          `Pre-scan found node definition: ${nodeId} -> "${label}" (${shape}) from line ${
            lineIndex + 1
          }`
        )
      }
    }
  })

  // First pass: identify all subgraphs
  debugLog('First pass: identifying subgraphs...')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    // Handle subgraph start - more robust parsing to support:
    // - subgraph id [Title]
    // - subgraph id "Title with spaces"
    // - subgraph "Title with spaces" (no id)
    if (line.startsWith('subgraph')) {
      const rest = line.slice('subgraph'.length).trim()

      let subgraphId: string | undefined
      let subgraphTitle: string | undefined

      // If rest starts with a quote, treat entire quoted string as title and generate an id
      const quoteMatch = rest.match(/^(["'])(.*?)\1/)
      if (quoteMatch) {
        subgraphTitle = quoteMatch[2]
        // create a slug id from title
        subgraphId =
          subgraphTitle
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '') || `sg-${i}`
      } else {
        // Otherwise, try to extract an id and an optional bracketed title first
        const bracketMatch = rest.match(/^([^\s\[]+)(?:\s*\[(.+?)\])?/)
        if (bracketMatch) {
          subgraphId = bracketMatch[1]
          if (bracketMatch[2]) subgraphTitle = bracketMatch[2]
        }

        // If no explicit bracketed/quoted title was found and the rest contains spaces,
        // treat the entire `rest` as the subgraph title (this supports `subgraph Component C`).
        if (!subgraphTitle && rest.indexOf(' ') !== -1) {
          subgraphTitle = rest
          // Generate a slug id from the title
          subgraphId =
            subgraphTitle
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/^-+|-+$/g, '') || `sg-${i}`
        }

        // Also check for an explicit quoted title after the id: e.g. subgraph id "Title"
        if (!subgraphTitle) {
          const altQuote = rest.match(/^[^\s]+\s+(["'])(.*?)\1/)
          if (altQuote) subgraphTitle = altQuote[2]
        }
      }

      if (subgraphId) {
        // Get parent from stack if this is a nested subgraph
        const parentId =
          subgraphStack.length > 0
            ? subgraphStack[subgraphStack.length - 1]
            : undefined

        const cleanTitle = subgraphTitle
          ? enhancedCleanLabel(subgraphTitle)
          : subgraphId

        debugLog(
          `Found subgraph: ${subgraphId}, title: "${cleanTitle}", parent: ${
            parentId || 'none'
          }`
        )

        subgraphStack.push(subgraphId)

        const newSubgraph: SubgraphInfo = {
          id: subgraphId,
          title: cleanTitle,
          nodes: [],
          parentId,
          childrenIds: [],
        }

        subgraphMap.set(subgraphId, newSubgraph)

        if (parentId) {
          const parentSubgraph = subgraphMap.get(parentId)
          if (parentSubgraph) {
            parentSubgraph.childrenIds.push(subgraphId)
          }
        }

        subgraphs.push(newSubgraph)
      }
    } else if (line.toLowerCase().startsWith('direction ')) {
      // Capture per-subgraph direction if inside a subgraph
      const dirMatch = line.match(/^direction\s+(TB|TD|BT|RL|LR)$/i)
      if (dirMatch && subgraphStack.length > 0) {
        const top = subgraphStack[subgraphStack.length - 1]
        const sg = subgraphMap.get(top)
        if (sg) {
          const d = dirMatch[1].toUpperCase()
          sg.direction = d === 'TD' ? 'TB' : d
        }
      }
    } else if (line === 'end' && subgraphStack.length > 0) {
      subgraphStack.pop()
    }
  }

  // Reset for second pass
  subgraphStack.length = 0

  // Helper function to create or get existing node
  function createOrGetNode(
    nodeId: string,
    currentSubgraph?: string
  ): MermaidNode {
    // Check if node already exists
    if (nodeMap.has(nodeId)) {
      const existingNode = nodeMap.get(nodeId)!

      // Update subgraph if the node is being referenced in a new context
      if (currentSubgraph && !existingNode.subgraph) {
        existingNode.subgraph = currentSubgraph
        const subgraph = subgraphMap.get(currentSubgraph)
        if (subgraph && !subgraph.nodes.includes(nodeId)) {
          subgraph.nodes.push(nodeId)
        }
        debugLog(
          `Updated existing node ${nodeId} to be part of subgraph ${currentSubgraph}`
        )
      }

      return existingNode
    }

    // Create new node using pre-scanned definition if available
    const nodeDef = nodeDefinitions.get(nodeId)
    let label: string
    let shape: string

    if (nodeDef) {
      // Use the pre-scanned definition
      label = nodeDef.label
      shape = nodeDef.shape
      debugLog(
        `Creating node ${nodeId} using pre-scanned definition: "${label}" (${shape})`
      )
    } else {
      // Fallback to simple node
      label = nodeId
      shape = 'rect'
      debugLog(`Creating simple fallback node: ${nodeId}`)
    }

    const node: MermaidNode = {
      id: nodeId,
      label,
      shape,
      subgraph: currentSubgraph,
      parentSubgraph:
        subgraphStack.length > 1
          ? subgraphStack[subgraphStack.length - 2]
          : undefined,
    }

    nodes.push(node)
    nodeMap.set(nodeId, node)

    if (currentSubgraph) {
      const subgraph = subgraphMap.get(currentSubgraph)
      if (subgraph) subgraph.nodes.push(nodeId)
    }

    return node
  }

  // Second pass: process nodes and edges
  debugLog('Second pass: processing nodes and edges...')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    // Handle subgraph start (robust parsing to support quoted titles and bracket titles)
    if (line.startsWith('subgraph')) {
      const rest = line.slice('subgraph'.length).trim()

      let subgraphId: string | undefined

      // If rest starts with quote, generate id from title
      const quoteMatch = rest.match(/^(?:["'])(.*?)(?:["'])/)
      if (quoteMatch) {
        const title = quoteMatch[1]
        subgraphId =
          title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '') || `sg-${i}`
      } else {
        // First try id with optional bracketed title
        const bracketMatch = rest.match(/^([^\s\[]+)(?:\s*\[(.+?)\])?/)
        if (bracketMatch) {
          const idToken = bracketMatch[1]
          const bracketTitle = bracketMatch[2]
          // If there was an explicit bracketed title use the id token as-is
          if (bracketTitle) {
            subgraphId = idToken
          } else if (rest.indexOf(' ') !== -1) {
            // If rest contains spaces (e.g. `subgraph Component C`) treat the whole rest as the title
            const title = rest
            subgraphId =
              title
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-+|-+$/g, '') || `sg-${i}`
          } else {
            // Simple single-token id
            subgraphId = idToken
          }
        }
      }

      if (subgraphId) {
        subgraphStack.push(subgraphId)
        debugLog(
          `Entering subgraph: ${subgraphId}, stack: [${subgraphStack.join(
            ', '
          )}]`
        )
        continue
      }
    }

    // Handle subgraph end
    if (line === 'end') {
      if (subgraphStack.length > 0) {
        const exitingSubgraph = subgraphStack[subgraphStack.length - 1]
        subgraphStack.pop()
        debugLog(
          `Exiting subgraph: ${exitingSubgraph}, stack: [${subgraphStack.join(
            ', '
          )}]`
        )
      } else {
        debugLog('Warning: Found "end" without matching subgraph start')
      }
      continue
    }

    // Skip various non-edge lines
    if (
      line.startsWith('direction ') ||
      line.startsWith('flowchart ') ||
      line.startsWith('graph ') ||
      line.startsWith('%%')
    ) {
      debugLog(`Skipping line: ${line}`)
      continue
    }

    // Get current subgraph from the top of the stack
    const currentSubgraph =
      subgraphStack.length > 0
        ? subgraphStack[subgraphStack.length - 1]
        : undefined

    debugLog(
      `Processing line: "${line}" in subgraph: ${currentSubgraph || 'none'}`
    )

    // Manual edge parser to avoid brittle regex that stops at the first
    // closing bracket of any type. This scanner finds bracketed sections
    // by locating the matching closing bracket for the opening bracket
    // (same bracket type) and supports optional edge labels like |label|.
    function extractToken(str: string, startIndex: number) {
      // Match identifier
      const idMatch = str.slice(startIndex).match(/^\s*([A-Za-z0-9_]+)/)
      if (!idMatch) return null
      const id = idMatch[1]
      const idx = startIndex + idMatch[0].length // position after id (includes leading spaces)

      // if next non-space char is an opening bracket, find its matching close
      const rest = str.slice(idx)
      const openCharMatch = rest.match(/^[\s]*([\[\(\{])/)
      if (openCharMatch) {
        const openChar = openCharMatch[1]
        const openPos = idx + rest.indexOf(openChar)
        const closeChar = openChar === '[' ? ']' : openChar === '(' ? ')' : '}'
        const closePos = str.indexOf(closeChar, openPos + 1)
        if (closePos !== -1) {
          const full = str
            .slice(startIndex + idMatch[0].search(/\S/), closePos + 1)
            .trim()
          return { id, full, endIndex: closePos + 1 }
        }
      }

      // Otherwise return just the id token
      return { id, full: id, endIndex: idx }
    }

    function parseEdge(str: string) {
      try {
        let i = 0
        // source token
        const src = extractToken(str, i)
        if (!src) return null
        i = src.endIndex

        // consume whitespace
        while (i < str.length && /\s/.test(str[i])) i++

        // Enhanced operator and label parsing to support both
        // 1) pipe labels:   A -->|Yes| B
        // 2) inline labels: A -- Yes --> B
        // and legacy connectors without arrows: A --- B, A -.-> B, etc.

        // First, try to locate a known arrow head further in the string.
        const arrowHeads = [
          '-.->',
          '-->',
          '==>',
          '->>',
          '<->',
          '-<>',
          '<-',
          '->',
        ]
        let foundArrowIndex = -1
        let foundArrow = ''
        for (const ah of arrowHeads) {
          const idx = str.indexOf(ah, i)
          if (idx !== -1 && (foundArrowIndex === -1 || idx < foundArrowIndex)) {
            foundArrowIndex = idx
            foundArrow = ah
          }
        }

        let op: string | null = null
        let edgeLabel = ''

        if (foundArrowIndex !== -1) {
          // There is an arrow head later in the string. The region between
          // current index and the arrow head can contain dashes and an inline label.
          const between = str.slice(i, foundArrowIndex)

          // First, check for pipe label BEFORE the arrow (non-standard but tolerated)
          const prePipeMatch = between.match(/\|(.*?)\|/)
          if (prePipeMatch) {
            edgeLabel = prePipeMatch[1]
          } else {
            // Remove leading/trailing connector chars, what's left is an inline label
            const inline = between
              .replace(/^\s*[\-\.=:\~]+\s*/g, '')
              .replace(/\s*[\-\.=:\~]+\s*$/g, '')
              .trim()
            if (inline) edgeLabel = inline
          }

          op = foundArrow
          // Advance past the arrow head
          i = foundArrowIndex + foundArrow.length

          // Standard Mermaid syntax places pipe labels AFTER the operator:
          //   A -->|label| B  or  A -.->|label| B
          // If we didn't already capture a label, or even if we did, prefer the
          // explicit pipe label immediately after the arrow.
          while (i < str.length && /\s/.test(str[i])) i++
          if (str[i] === '|') {
            const next = str.indexOf('|', i + 1)
            if (next !== -1) {
              edgeLabel = str.slice(i + 1, next)
              i = next + 1
            }
          }
        } else {
          // Fallback to legacy immediate-operator parsing (no arrow head found)
          const operators = ['---', '-.-', '::', ':-:', '...', '~', '===']
          for (const o of operators.sort((a, b) => b.length - a.length)) {
            if (str.startsWith(o, i)) {
              op = o
              i += o.length
              break
            }
          }
          if (!op) return null

          // optional edge label |label| after operator
          while (i < str.length && /\s/.test(str[i])) i++
          if (str[i] === '|') {
            const next = str.indexOf('|', i + 1)
            if (next !== -1) {
              edgeLabel = str.slice(i + 1, next)
              i = next + 1
            }
          }
        }

        // skip whitespace then parse target
        while (i < str.length && /\s/.test(str[i])) i++
        const tgt = extractToken(str, i)
        if (!tgt) return null

        const trailing = str.slice(tgt.endIndex).trimStart()
        if (!edgeLabel && !trailing.startsWith(':::')) {
          const colonLabelMatch = trailing.match(/^:\s*(.+)$/)
          if (colonLabelMatch) {
            edgeLabel = colonLabelMatch[1].trim()
          }
        }

        const isReverseArrow = op === '<-'

        return {
          sourceId: isReverseArrow ? tgt.id : src.id,
          sourceFull: isReverseArrow ? tgt.full : src.full,
          targetId: isReverseArrow ? src.id : tgt.id,
          targetFull: isReverseArrow ? src.full : tgt.full,
          edgeType: isReverseArrow ? '->' : op!,
          edgeLabel,
        }
      } catch {
        return null
      }
    }

    const parsedEdge = parseEdge(line)
    if (!parsedEdge) {
      debugLog(
        `Line "${line}" did not match edge pattern - checking for standalone nodes`
      )
    }

    if (parsedEdge) {
      try {
        const { sourceId, targetId, edgeType, edgeLabel } = parsedEdge
        debugLog(
          `Found edge: ${sourceId} ${edgeType} ${targetId} with label: "${edgeLabel}" in context: ${
            currentSubgraph || 'global'
          }`
        )

        // Check if source/target are subgraphs
        const isSourceSubgraph = subgraphMap.has(sourceId)
        const isTargetSubgraph = subgraphMap.has(targetId)

        debugLog(
          `Source "${sourceId}" is ${
            isSourceSubgraph ? 'a subgraph' : 'a node'
          }`
        )
        debugLog(
          `Target "${targetId}" is ${
            isTargetSubgraph ? 'a subgraph' : 'a node'
          }`
        )

        // Handle source node creation
        if (!isSourceSubgraph) {
          const existingSource = nodeMap.get(sourceId)
          if (existingSource) {
            debugLog(
              `Source ${sourceId} already exists in subgraph: ${
                existingSource.subgraph || 'none'
              }`
            )
          } else {
            createOrGetNode(sourceId, currentSubgraph)
          }
        }

        // Handle target node creation
        if (!isTargetSubgraph) {
          const existingTarget = nodeMap.get(targetId)

          if (existingTarget) {
            debugLog(
              `Target ${targetId} already exists in subgraph: ${
                existingTarget.subgraph || 'none'
              }`
            )
          } else {
            // Target doesn't exist yet - assign to current subgraph if we're inside one
            const targetSubgraph = currentSubgraph

            debugLog(
              `Creating target ${targetId} with subgraph assignment: ${
                targetSubgraph || 'none'
              } (current subgraph: ${currentSubgraph || 'none'})`
            )
            createOrGetNode(targetId, targetSubgraph)
          }
        }

        // Add edge
        edges.push({
          source: sourceId,
          target: targetId,
          label: enhancedCleanLabel(edgeLabel),
          type: edgeType,
          isSourceSubgraph: isSourceSubgraph,
          isTargetSubgraph: isTargetSubgraph,
        })

        debugLog(
          `Added edge: ${sourceId} -> ${targetId} (source subgraph: ${isSourceSubgraph}, target subgraph: ${isTargetSubgraph})`
        )
      } catch (error) {
        debugLog(`Error parsing edge: ${line}`, error)
      }
    } else {
      // Parse standalone node definitions
      try {
        const nodePatterns = [
          /^([A-Za-z0-9_]+)([\[\(\{][^\]\)\}]*[\]\)\}])/,
          /^([A-Za-z0-9_]+)$/,
        ]

        let foundStandaloneNode = false
        for (const pattern of nodePatterns) {
          const nodeMatch = line.match(pattern)
          if (nodeMatch && !nodeMap.has(nodeMatch[1])) {
            const nodeId = nodeMatch[1]

            // Skip if this is a subgraph ID
            if (subgraphMap.has(nodeId)) {
              debugLog(
                `Skipping node creation for ${nodeId} as it's a subgraph`
              )
              break
            }

            debugLog(
              `Found standalone node definition: ${nodeId} in context: ${
                currentSubgraph || 'global'
              }`
            )
            createOrGetNode(nodeId, currentSubgraph)
            foundStandaloneNode = true
            break
          }
        }

        if (!foundStandaloneNode) {
          debugLog(
            `Line "${line}" did not match any pattern (edge or standalone node)`
          )
        }
      } catch (error) {
        debugLog(`Error parsing standalone node: ${line}`, error)
      }
    }
  }

  // Final verification and cleanup
  debugLog('=== FINAL VERIFICATION ===')
  debugLog('Subgraph hierarchy:')
  subgraphs.forEach((sg) => {
    debugLog(
      `- ${sg.id}: "${sg.title}" (parent: ${sg.parentId || 'none'}, children: ${
        sg.childrenIds.join(', ') || 'none'
      }, nodes: ${sg.nodes.length})`
    )
  })

  debugLog('Final node assignments:')
  nodes.forEach((node) => {
    debugLog(
      `- ${node.id}: "${node.label}" in subgraph ${
        node.subgraph || 'none'
      } (shape: ${node.shape})`
    )
  })

  debugLog('Final edges:')
  edges.forEach((edge, index) => {
    debugLog(
      `- Edge ${index}: ${edge.source} -> ${edge.target} (label: "${edge.label}", type: "${edge.type}")`
    )
  })

  return { nodes, edges, subgraphs, direction }
}
