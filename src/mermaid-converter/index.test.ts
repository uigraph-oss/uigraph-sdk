import { describe, expect, it } from 'vitest'
import { convertMermaidToReactFlow } from './index'

describe('diagram type detection', () => {
  it('falls back to the flowchart importer when no diagram keyword appears', async () => {
    const { nodes } = await convertMermaidToReactFlow('A --> B')

    expect(nodes.map((node) => node.id)).toEqual(['A', 'B'])
  })

  it('detects the diagram keyword whatever case it is written in', async () => {
    const { nodes } = await convertMermaidToReactFlow(
      'SEQUENCEDIAGRAM\n  A->>B: hi'
    )

    expect(nodes.map((node) => node.id)).toContain('participant-A')
  })

  it('looks past directives and blank lines for the keyword', async () => {
    const { nodes } = await convertMermaidToReactFlow(
      '%%{init: {}}%%\n\nsequenceDiagram\n  A->>B: hi'
    )

    expect(nodes.map((node) => node.id)).toContain('participant-A')
  })

  it('lets the first keyword line decide, not a keyword used later as text', async () => {
    const sequence = await convertMermaidToReactFlow(
      'sequenceDiagram\n  A->>B: graph theory'
    )
    const flowchart = await convertMermaidToReactFlow(
      'flowchart LR\n  A[sequencediagram] --> B'
    )

    expect(sequence.nodes.map((node) => node.id)).toContain('participant-A')
    expect(flowchart.nodes.map((node) => node.id)).toEqual(['A', 'B'])
  })
})
