import { describe, expect, it } from 'vitest'
import { convertMermaidToReactFlow } from './mermaid-to-react-flow'

describe('convertMermaidToReactFlow', () => {
  it('parses pipe label from dashed arrow', async () => {
    const result = await convertMermaidToReactFlow('flowchart LR\nA -.->|ok| B')
    expect(result.edges).toHaveLength(1)
    expect(result.edges[0].label).toBe('ok')
  })

  it('parses inline label between connectors', async () => {
    const result = await convertMermaidToReactFlow(
      'flowchart LR\nA -- yes --> B'
    )
    expect(result.edges).toHaveLength(1)
    expect(result.edges[0].label).toBe('yes')
  })

  it('parses edge label from colon syntax', async () => {
    const result = await convertMermaidToReactFlow('flowchart LR\nA --> B: ok')
    expect(result.edges).toHaveLength(1)
    expect(result.edges[0].label).toBe('ok')
  })

  it('assigns parentId for nodes in groups', async () => {
    const result = await convertMermaidToReactFlow(
      'flowchart LR\nsubgraph S1\n  A\nend\nA --> B'
    )

    const nodeA = result.nodes.find((node) => node.id === 'A')
    const nodeB = result.nodes.find((node) => node.id === 'B')
    expect(nodeA?.parentId).toBe('subgraph-S1')
    expect(nodeB?.parentId).toBeUndefined()
  })
})
