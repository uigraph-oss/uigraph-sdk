import { describe, expect, it } from 'vitest'
import { DEFAULT_C4_LAYOUT, parseC4Diagram } from '../parser'

describe('style directives the renderer keeps apart', () => {
  it('files UpdateBoundaryStyle under the boundaries, not the elements', () => {
    const data = parseC4Diagram(
      'C4Context\n System_Boundary(b1, "Bank") { System(a, "A") }\n UpdateBoundaryStyle(b1, $bgColor="navy", $borderColor="white")'
    )

    expect(data.boundaryStyles.b1).toMatchObject({
      bgColor: 'navy',
      borderColor: 'white',
    })
    expect(data.elementStyles).toEqual({})
  })

  it('reads the line weight as a number and the line pattern as text', () => {
    const data = parseC4Diagram(
      'C4Context\n Person(a, "A")\n System(b, "B")\n Rel(a, b, "Uses")\n UpdateRelStyle(a, b, $lineWidth="3", $lineStyle="dashed")'
    )

    expect(data.relStyles['a->b']).toMatchObject({
      lineWidth: 3,
      lineStyle: 'dashed',
    })
  })
})

describe('argument splitting', () => {
  it('keeps a comma that sits inside brackets in an unquoted argument', () => {
    const data = parseC4Diagram(
      'C4Context\n System(a, Store [orders, invoices])'
    )

    expect(data.elements[0].label).toBe('Store [orders, invoices]')
  })
})

describe('shared defaults', () => {
  it('leaves the layout defaults alone when a diagram overrides them', () => {
    const overridden = parseC4Diagram(
      'C4Context\n Person(a, "A")\n UpdateLayoutConfig($c4ShapeInRow="7", $c4BoundaryInRow="5")'
    )
    const plain = parseC4Diagram('C4Context\n Person(a, "A")')

    expect(overridden.layout.c4ShapeInRow).toBe(7)
    expect(plain.layout).toEqual(DEFAULT_C4_LAYOUT)
    expect(DEFAULT_C4_LAYOUT.c4BoundaryInRow).toBe(2)
  })
})

describe('anonymous boundaries', () => {
  it('gives two nameless boundaries an id each', () => {
    const data = parseC4Diagram(
      'C4Context\n Boundary() {\n  System(a, "A")\n }\n Boundary() {\n  System(b, "B")\n }'
    )

    expect(data.boundaries).toHaveLength(2)
    expect(data.boundaries[0].id).not.toBe(data.boundaries[1].id)
    expect(data.elements[0].parentId).toBe(data.boundaries[0].id)
    expect(data.elements[1].parentId).toBe(data.boundaries[1].id)
  })
})
