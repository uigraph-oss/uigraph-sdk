import { describe, expect, it } from 'vitest'
import { C4_LAYOUT, convertC4MermaidToReactFlow } from '../to-react-flow'

describe('boundary boxes', () => {
  it('still gives a boundary that holds nothing room for a shape', () => {
    const flow = convertC4MermaidToReactFlow(
      'C4Context\n System_Boundary(empty, "Nothing here") {\n }'
    )
    const boundary = flow.nodes.find((node) => node.id === 'empty')!

    expect(boundary.style!.width as number).toBeGreaterThan(C4_LAYOUT.WIDTH)
    expect(boundary.style!.height as number).toBeGreaterThan(
      C4_LAYOUT.MIN_HEIGHT
    )
  })

  it('leaves the title band above a boundary clear of its first child', () => {
    const flow = convertC4MermaidToReactFlow(
      'C4Context\n System_Boundary(b1, "Bank") { System(a, "A") }'
    )
    const child = flow.nodes.find((node) => node.id === 'a')!

    expect(child.position.y).toBeGreaterThanOrEqual(C4_LAYOUT.BOUNDARY_HEADER)
    expect(child.position.x).toBeGreaterThanOrEqual(C4_LAYOUT.BOUNDARY_PADDING)
  })

  it('drops nested boundaries below the loose shapes they share a parent with', () => {
    const flow = convertC4MermaidToReactFlow(
      'C4Context\n Enterprise_Boundary(outer, "Outer") {\n  System(loose, "Loose")\n  System_Boundary(inner, "Inner") { System(deep, "Deep") }\n }'
    )
    const byId = new Map(flow.nodes.map((node) => [node.id, node]))
    const loose = byId.get('loose')!
    const inner = byId.get('inner')!

    expect(inner.position.y).toBeGreaterThanOrEqual(
      loose.position.y + (loose.height as number)
    )
  })
})
