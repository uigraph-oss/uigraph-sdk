import { describe, expect, it } from 'vitest'
import { convertMermaidToReactFlow } from '../../index'
import {
  C4_CONTEXT_EXAMPLE,
  C4_DEPLOYMENT_EXAMPLE,
} from '../fixtures/official-diagrams'

describe('convertMermaidToReactFlow routing', () => {
  it('routes C4 code to the C4 converter', async () => {
    const result = await convertMermaidToReactFlow(C4_CONTEXT_EXAMPLE)

    expect(result.nodes.some((node) => node.type === 'c4')).toBe(true)
    expect(result.nodes.some((node) => node.type === 'c4Boundary')).toBe(true)
    expect(result.edges).toHaveLength(4)
  })

  it('routes a deployment diagram to the C4 converter', async () => {
    const result = await convertMermaidToReactFlow(C4_DEPLOYMENT_EXAMPLE)

    expect(
      result.nodes.filter((node) => node.data.c4BoundaryKind === 'node')
    ).toHaveLength(12)
  })

  it('routes a sub diagram link to a subDiagram node', async () => {
    const result = await convertMermaidToReactFlow(
      'C4Container\n System(api, "API", "Backend", $link="uig:diagram-123")'
    )

    expect(result.nodes[0].type).toBe('subDiagram')
  })

  it('still routes flowcharts to the flowchart converter', async () => {
    const result = await convertMermaidToReactFlow(
      'flowchart TD\n A[One] --> B[Two]'
    )

    expect(result.nodes.length).toBeGreaterThan(0)
    expect(result.nodes.every((node) => node.type !== 'c4')).toBe(true)
  })

  it('still routes sequence diagrams to the sequence converter', async () => {
    const result = await convertMermaidToReactFlow(
      'sequenceDiagram\n Alice->>Bob: Hello'
    )

    expect(result.nodes.length).toBeGreaterThan(0)
    expect(result.nodes.every((node) => node.type !== 'c4')).toBe(true)
  })
})
