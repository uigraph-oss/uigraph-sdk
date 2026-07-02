import { Node } from '@xyflow/react'

function isAlreadyNormalizedId(sourceId: string): boolean {
  return /^[A-Za-z]+$/.test(sourceId)
}

function indexToAlphabetId(index: number): string {
  let current = index
  let result = ''

  while (current >= 0) {
    result = String.fromCharCode((current % 26) + 65) + result
    current = Math.floor(current / 26) - 1
  }

  return result
}

export function buildNodeIdMap(graphNodes: Node[]): Map<string, string> {
  const usedMermaidIds = new Set<string>()
  const nodeIdMap = new Map<string, string>()
  let alphabeticIndex = 0

  graphNodes.forEach((node) => {
    if (isAlreadyNormalizedId(node.id) && !usedMermaidIds.has(node.id)) {
      nodeIdMap.set(node.id, node.id)
      usedMermaidIds.add(node.id)
      return
    }

    let mappedNodeId = indexToAlphabetId(alphabeticIndex)
    alphabeticIndex += 1

    while (usedMermaidIds.has(mappedNodeId)) {
      mappedNodeId = indexToAlphabetId(alphabeticIndex)
      alphabeticIndex += 1
    }

    nodeIdMap.set(node.id, mappedNodeId)
    usedMermaidIds.add(mappedNodeId)
  })

  return nodeIdMap
}
