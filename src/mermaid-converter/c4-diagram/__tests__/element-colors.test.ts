import { EdgeMarker } from '@xyflow/react'
import { describe, expect, it } from 'vitest'
import {
  C4_COLORS,
  convertC4MermaidToReactFlow,
  getC4ElementColors,
} from '../to-react-flow'

describe('the C4 palette', () => {
  it('gives every element kind a colour of its own', () => {
    const person = getC4ElementColors({ kind: 'person' } as never)
    const system = getC4ElementColors({ kind: 'system' } as never)
    const container = getC4ElementColors({ kind: 'container' } as never)
    const component = getC4ElementColors({ kind: 'component' } as never)
    const fills = [person.fill, system.fill, container.fill, component.fill]

    expect(new Set(fills).size).toBe(fills.length)
  })

  it('falls back to the system colours for a kind it does not know', () => {
    expect(getC4ElementColors({ kind: 'spaceship' } as never)).toEqual(
      C4_COLORS.system
    )
  })
})

describe('boundary colours', () => {
  it('leaves an unstyled boundary see-through behind a visible border', () => {
    const flow = convertC4MermaidToReactFlow(
      'C4Context\n System_Boundary(b1, "Bank") { System(a, "A") }'
    )
    const boundary = flow.nodes.find((node) => node.id === 'b1')!

    expect(boundary.data.backgroundColor).toBe('transparent')
    expect(boundary.data.borderColor).toBeDefined()
    expect(boundary.data.borderColor).not.toBe('transparent')
  })

  it('paints a boundary that a boundary directive names', () => {
    const flow = convertC4MermaidToReactFlow(
      'C4Context\n System_Boundary(b1, "Bank") { System(a, "A") }\n UpdateBoundaryStyle(b1, $bgColor="navy", $borderColor="white", $fontColor="silver")'
    )
    const boundary = flow.nodes.find((node) => node.id === 'b1')!

    expect(boundary.data.backgroundColor).toBe('navy')
    expect(boundary.data.borderColor).toBe('white')
    expect(boundary.data.fontColor).toBe('silver')
  })

  it('paints a boundary that an element directive names, as mermaid does', () => {
    const flow = convertC4MermaidToReactFlow(
      'C4Context\n System_Boundary(b1, "Bank") { System(a, "A") }\n UpdateElementStyle(b1, $bgColor="olive")'
    )
    const boundary = flow.nodes.find((node) => node.id === 'b1')!

    expect(boundary.data.backgroundColor).toBe('olive')
  })
})

describe('edge colours', () => {
  it('colours both arrow heads to match the line they sit on', () => {
    const plain = convertC4MermaidToReactFlow(
      'C4Context\n Person(a, "A")\n System(b, "B")\n Rel(a, b, "Uses")'
    )
    const painted = convertC4MermaidToReactFlow(
      'C4Context\n Person(a, "A")\n System(b, "B")\n BiRel(a, b, "Uses")\n UpdateRelStyle(a, b, $lineColor="crimson")'
    )

    expect((plain.edges[0].markerEnd as EdgeMarker).color).toBe(
      plain.edges[0].style?.stroke
    )
    expect((painted.edges[0].markerEnd as EdgeMarker).color).toBe('crimson')
    expect((painted.edges[0].markerStart as EdgeMarker).color).toBe('crimson')
  })

  it('draws a line as thick as the directive asks for', () => {
    const flow = convertC4MermaidToReactFlow(
      'C4Context\n Person(a, "A")\n System(b, "B")\n Rel(a, b, "Uses")\n UpdateRelStyle(a, b, $lineWidth="6")'
    )
    const plain = convertC4MermaidToReactFlow(
      'C4Context\n Person(a, "A")\n System(b, "B")\n Rel(a, b, "Uses")'
    )

    expect(flow.edges[0].style?.strokeWidth).toBe(6)
    expect(plain.edges[0].style?.strokeWidth).toBeLessThan(6)
  })
})
