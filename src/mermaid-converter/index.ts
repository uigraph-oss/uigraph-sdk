import mermaid from 'mermaid'
import { ReactFlowData } from '../types'
import { convertC4MermaidToReactFlow } from './c4-diagram/to-react-flow'
import { convertFlowChartToReactFlow } from './flow-chart/to-react-flow'
import { convertSequenceDiagramToReactFlow } from './sequence-diagram/to-react-flow'

export { parseSequenceDiagram } from './sequence-diagram/parser'

mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  flowchart: {
    htmlLabels: false,
    curve: 'linear',
  },
})

type DiagramType = 'sequence' | 'flowchart' | 'c4'

function detectDiagramType(code: string): DiagramType {
  const lines = code.split('\n')
  for (const line of lines) {
    const trimmed = line.trim().toLowerCase()
    if (trimmed.startsWith('sequencediagram')) return 'sequence'
    if (trimmed.startsWith('c4')) return 'c4'
    if (trimmed.startsWith('flowchart') || trimmed.startsWith('graph')) {
      return 'flowchart'
    }
  }
  return 'flowchart'
}

export async function convertMermaidToReactFlow(
  mermaidCode: string
): Promise<ReactFlowData> {
  try {
    const diagramType = detectDiagramType(mermaidCode)

    if (diagramType === 'sequence') {
      return convertSequenceDiagramToReactFlow(mermaidCode)
    }

    if (diagramType === 'c4') {
      return convertC4MermaidToReactFlow(mermaidCode)
    }

    return convertFlowChartToReactFlow(mermaidCode)
  } catch (error) {
    console.error('Error converting Mermaid to React Flow:', error)
    return { nodes: [], edges: [] }
  }
}
