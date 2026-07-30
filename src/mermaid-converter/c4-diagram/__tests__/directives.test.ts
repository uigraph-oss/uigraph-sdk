import { describe, expect, it } from 'vitest'
import { DEFAULT_C4_LAYOUT, parseC4Diagram } from '../parser'
import { convertC4MermaidToReactFlow } from '../to-react-flow'

const SHAPES = 'Person(a, "A")\nSystem(b, "B")'

function parse(code: string) {
  return parseC4Diagram(`C4Context\n${SHAPES}\n${code}`)
}

describe('UpdateElementStyle', () => {
  it('reads the named argument form', () => {
    const data = parse(
      'UpdateElementStyle(a, $bgColor="grey", $fontColor="red", $borderColor="red", $shadowing="true", $shape="RoundedBoxShape", $sprite="img", $techn="Go", $legendText="A person", $legendSprite="mini")'
    )

    expect(data.elementStyles.a).toEqual({
      bgColor: 'grey',
      fontColor: 'red',
      borderColor: 'red',
      shadowing: true,
      shape: 'RoundedBoxShape',
      sprite: 'img',
      techn: 'Go',
      legendText: 'A person',
      legendSprite: 'mini',
    })
  })

  it('reads the positional form in mermaid argument order', () => {
    const data = parse('UpdateElementStyle(a, "grey", "red", "blue")')

    expect(data.elementStyles.a).toMatchObject({
      bgColor: 'grey',
      fontColor: 'red',
      borderColor: 'blue',
    })
  })

  it('leaves untouched properties undefined', () => {
    const data = parse('UpdateElementStyle(a, $bgColor="grey")')

    expect(data.elementStyles.a).toMatchObject({
      bgColor: 'grey',
      fontColor: undefined,
      borderColor: undefined,
      shadowing: undefined,
    })
  })

  it('reads $shadowing as a boolean', () => {
    expect(
      parse('UpdateElementStyle(a, $shadowing="true")').elementStyles.a
    ).toMatchObject({ shadowing: true })
    expect(
      parse('UpdateElementStyle(a, $shadowing="false")').elementStyles.a
    ).toMatchObject({ shadowing: false })
  })

  it('ignores a directive with no target', () => {
    expect(parse('UpdateElementStyle()').elementStyles).toEqual({})
  })

  it('applies to a boundary, as mermaid resolves boundaries too', () => {
    const flow = convertC4MermaidToReactFlow(`
C4Context
  System_Boundary(b1, "Bank") {
    System(core, "Core")
  }
  UpdateElementStyle(b1, $bgColor="#101010", $borderColor="#ff0000")
`)
    const boundary = flow.nodes.find((node) => node.id === 'b1')!

    expect(boundary.data.backgroundColor).toBe('#101010')
    expect(boundary.data.borderColor).toBe('#ff0000')
  })
})

describe('UpdateRelStyle', () => {
  it('reads the named argument form', () => {
    const data = parse(
      'UpdateRelStyle(a, b, $textColor="red", $lineColor="blue", $offsetX="-40", $offsetY="60")'
    )

    expect(data.relStyles['a->b']).toMatchObject({
      textColor: 'red',
      lineColor: 'blue',
      offsetX: -40,
      offsetY: 60,
    })
  })

  it('reads the positional form in mermaid argument order', () => {
    const data = parse('UpdateRelStyle(a, b, "red", "blue", "-40", "60")')

    expect(data.relStyles['a->b']).toMatchObject({
      textColor: 'red',
      lineColor: 'blue',
      offsetX: -40,
      offsetY: 60,
    })
  })

  it('accepts a single offset on its own', () => {
    expect(
      parse('UpdateRelStyle(a, b, $offsetY="60")').relStyles['a->b']
    ).toMatchObject({
      offsetX: undefined,
      offsetY: 60,
      textColor: undefined,
      lineColor: undefined,
    })
  })

  it('keys the override by direction', () => {
    const data = parse('UpdateRelStyle(a, b, $lineColor="blue")')

    expect(data.relStyles['a->b']).toBeDefined()
    expect(data.relStyles['b->a']).toBeUndefined()
  })

  it('ignores a directive with no target pair', () => {
    expect(parse('UpdateRelStyle(a)').relStyles).toEqual({})
  })
})

describe('UpdateLayoutConfig', () => {
  it('defaults to mermaid s c4ShapeInRow 4 and c4BoundaryInRow 2', () => {
    expect(parse('').layout).toEqual(DEFAULT_C4_LAYOUT)
    expect(DEFAULT_C4_LAYOUT).toEqual({ c4ShapeInRow: 4, c4BoundaryInRow: 2 })
  })

  it('reads the named argument form', () => {
    expect(
      parse('UpdateLayoutConfig($c4ShapeInRow="3", $c4BoundaryInRow="1")')
        .layout
    ).toEqual({ c4ShapeInRow: 3, c4BoundaryInRow: 1 })
  })

  it('reads the positional form', () => {
    expect(parse('UpdateLayoutConfig("3", "1")').layout).toEqual({
      c4ShapeInRow: 3,
      c4BoundaryInRow: 1,
    })
  })

  it('keeps the default for an argument that is not a number', () => {
    expect(parse('UpdateLayoutConfig($c4ShapeInRow="many")').layout).toEqual({
      c4ShapeInRow: 4,
      c4BoundaryInRow: 2,
    })
  })

  it('lets a later directive win', () => {
    expect(
      parse(
        'UpdateLayoutConfig($c4ShapeInRow="3")\nUpdateLayoutConfig($c4ShapeInRow="5")'
      ).layout.c4ShapeInRow
    ).toBe(5)
  })
})
