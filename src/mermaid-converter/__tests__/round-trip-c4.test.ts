import { describe, expect, it } from 'vitest'
import { C4_OFFICIAL_EXAMPLES } from '../c4-diagram/fixtures/official-diagrams'
import {
  convertReactFlowToC4Mermaid,
  convertReactFlowToC4UiGraph,
  isC4ReactFlowDiagram,
} from '../c4-diagram/from-react-flow'
import { parseC4Diagram } from '../c4-diagram/parser'
import { convertC4ToReactFlow } from '../c4-diagram/to-react-flow'
import { convertMermaidToReactFlowWithContext } from '../context/convert-with-context'

function roundTrip(code: string) {
  const source = parseC4Diagram(code)
  const canvas = convertC4ToReactFlow(source)
  const mermaid = convertReactFlowToC4Mermaid(canvas.nodes, canvas.edges)

  return { source, canvas, mermaid, result: parseC4Diagram(mermaid) }
}

describe.each(C4_OFFICIAL_EXAMPLES)('round trip $name', ({ code }) => {
  it('keeps the diagram type', () => {
    const { source, result } = roundTrip(code)

    expect(result.type).toBe(source.type)
  })

  it('keeps every element with its kind, shape, technology and description', () => {
    const { source, result } = roundTrip(code)

    expect(result.elements.map((element) => element.id).sort()).toEqual(
      source.elements.map((element) => element.id).sort()
    )

    for (const element of source.elements) {
      const emitted = result.elements.find((entry) => entry.id === element.id)

      expect(emitted).toBeDefined()
      expect(emitted).toMatchObject({
        label: element.label,
        kind: element.kind,
        shape: element.shape,
        isExternal: element.isExternal,
        stereotype: element.stereotype,
        parentId: element.parentId,
      })
      expect(emitted?.technology).toBe(element.technology)
      expect(emitted?.description).toBe(element.description)
    }
  })

  it('keeps every boundary with its kind, type, node type and nesting', () => {
    const { source, result } = roundTrip(code)

    expect(result.boundaries.map((boundary) => boundary.id).sort()).toEqual(
      source.boundaries.map((boundary) => boundary.id).sort()
    )

    for (const boundary of source.boundaries) {
      const emitted = result.boundaries.find(
        (entry) => entry.id === boundary.id
      )

      expect(emitted).toBeDefined()
      expect(emitted).toMatchObject({
        label: boundary.label,
        kind: boundary.kind,
        type: boundary.type,
        parentId: boundary.parentId,
      })
      expect(emitted?.nodeType).toBe(boundary.nodeType)
      expect(emitted?.description).toBe(boundary.description)
    }
  })

  it('keeps every relationship with its label, technology and direction', () => {
    const { source, result } = roundTrip(code)

    expect(result.relationships.length).toBe(source.relationships.length)

    for (const relationship of source.relationships) {
      const emitted = result.relationships.find(
        (entry) =>
          entry.from === relationship.from && entry.to === relationship.to
      )

      expect(emitted).toBeDefined()
      expect(emitted).toMatchObject({
        label: relationship.label,
        direction: relationship.direction,
      })
      expect(emitted?.technology).toBe(relationship.technology)
      expect(emitted?.description).toBe(relationship.description)
    }
  })

  it('is stable across a second trip', () => {
    const { mermaid } = roundTrip(code)
    const secondTrip = roundTrip(mermaid)

    expect(secondTrip.mermaid).toBe(mermaid)
  })

  it('restores positions from the exported context', async () => {
    const { canvas } = roundTrip(code)
    const exported = convertReactFlowToC4UiGraph(canvas.nodes, canvas.edges)

    expect(isC4ReactFlowDiagram(canvas.nodes)).toBe(true)
    expect(exported.context.nodes).toBeDefined()

    const reimported = await convertMermaidToReactFlowWithContext(
      exported.mermaid,
      exported.context,
      { repositionNodes: true }
    )

    for (const node of canvas.nodes) {
      const restored = reimported.nodes.find((entry) => entry.id === node.id)

      expect(restored).toBeDefined()
      expect(restored?.position).toEqual(node.position)
      expect(restored?.parentId).toBe(node.parentId)
    }
  })
})

describe('multi line labels', () => {
  it('survives as <br/> instead of collapsing to a space', () => {
    const { result } = roundTrip(
      [
        'C4Context',
        'Person(customerD, "Banking Customer D", "A customer of the bank, <br/> with personal bank accounts.")',
      ].join('\n')
    )

    expect(result.elements[0].description).toBe(
      'A customer of the bank, \n with personal bank accounts.'
    )
  })
})

describe('sub diagram links', () => {
  it('re-emits $link as uig:<diagramId>', () => {
    const { mermaid, canvas } = roundTrip(
      [
        'C4Container',
        'Container(api, "API", "Java", "Handles requests", $link="uig:abc123")',
      ].join('\n')
    )

    expect(canvas.nodes[0].type).toBe('subDiagram')
    expect(mermaid).toContain('$link="uig:abc123"')
  })
})

describe('canvas authored edges', () => {
  it('falls back to the handle when no parsed direction is stored', () => {
    const { canvas } = roundTrip(
      ['C4Context', 'System(a, "A")', 'System(b, "B")'].join('\n')
    )

    const mermaid = convertReactFlowToC4Mermaid(canvas.nodes, [
      {
        id: 'manual',
        source: 'a',
        target: 'b',
        sourceHandle: 'source-left',
        label: 'Calls',
      },
    ])

    expect(mermaid).toContain('Rel_L(a, b, "Calls")')
  })
})
