import { describe, expect, it } from 'vitest'
import { convertC4MermaidToReactFlow } from '../to-react-flow'

describe('handles chosen from where the shapes sit', () => {
  it('reaches leftwards when the other shape sits to the left', () => {
    const flow = convertC4MermaidToReactFlow(
      'C4Context\n Person(a, "A")\n Person(b, "B")\n Rel(b, a, "Back along the row")'
    )

    expect(flow.edges[0]).toMatchObject({
      sourceHandle: 'source-left',
      targetHandle: 'target-right',
    })
  })

  it('keeps the declared pair in the edge id even when the arrow is flipped', () => {
    const flow = convertC4MermaidToReactFlow(
      'C4Context\n Person(a, "A")\n Person(b, "B")\n Rel_Back(a, b, "Reads")'
    )

    expect(flow.edges[0].id).toContain('a-b')
  })

  it('still draws a relationship that points back at its own shape', () => {
    const flow = convertC4MermaidToReactFlow(
      'C4Context\n System(a, "A")\n Rel(a, a, "Retries")'
    )

    expect(flow.edges).toHaveLength(1)
    expect(flow.edges[0].source).toBe('a')
    expect(flow.edges[0].target).toBe('a')
  })
})
