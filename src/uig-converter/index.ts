import { buildValidatedContext } from './context'
import { inferDirection } from './core/direction'
import { buildNodeIdMap } from './core/node-id-map'
import {
  buildMermaidEdgeLines,
  buildMermaidNodeLines,
} from './mermaid/build-lines'
import { UiGraphInput, UiGraphOptions, UigOutput } from './types'

export type { UiGraphInput, UiGraphOptions, UigOutput } from './types'

export function convertUiGraphToMermaid(
  input: UiGraphInput,
  options?: UiGraphOptions
): UigOutput {
  const groupNodes = input.nodes.filter((node) => node.type === 'group')
  const graphNodes = input.nodes.filter((node) => node.type !== 'group')
  const direction = inferDirection(graphNodes, input.edges)

  const nodeIdMap = buildNodeIdMap(graphNodes)
  const mermaidNodeLines = buildMermaidNodeLines(
    graphNodes,
    nodeIdMap,
    options?.detailedContext === true
  )
  const mermaidEdgeLines = buildMermaidEdgeLines(
    input.edges,
    nodeIdMap,
    options?.detailedContext === true
  )

  const context = buildValidatedContext(
    graphNodes,
    input.edges,
    groupNodes,
    nodeIdMap
  )

  const mermaidLines = [
    `flowchart ${direction}`,
    ...mermaidNodeLines,
    ...mermaidEdgeLines,
  ]

  return {
    mermaid: mermaidLines.join('\n'),
    context,
  }
}
