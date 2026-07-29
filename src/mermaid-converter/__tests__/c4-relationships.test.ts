import { describe, expect, it } from 'vitest'
import { parseC4Diagram } from '../c4-parser'

const SHAPES = 'Person(a, "A")\nPerson(b, "B")'

function firstRelationship(code: string) {
  return parseC4Diagram(`C4Context\n${SHAPES}\n${code}`).relationships[0]
}

describe('C4 relationship keywords', () => {
  const REL_KEYWORDS = [
    { keyword: 'Rel', direction: 'default' },
    { keyword: 'BiRel', direction: 'bi' },
    { keyword: 'Rel_Back', direction: 'back' },
    { keyword: 'Rel_U', direction: 'up' },
    { keyword: 'Rel_Up', direction: 'up' },
    { keyword: 'Rel_D', direction: 'down' },
    { keyword: 'Rel_Down', direction: 'down' },
    { keyword: 'Rel_L', direction: 'left' },
    { keyword: 'Rel_Left', direction: 'left' },
    { keyword: 'Rel_R', direction: 'right' },
    { keyword: 'Rel_Right', direction: 'right' },
  ]

  it.each(REL_KEYWORDS)(
    '$keyword has direction $direction',
    ({ keyword, direction }) => {
      expect(firstRelationship(`${keyword}(a, b, "Uses")`)).toMatchObject({
        from: 'a',
        to: 'b',
        label: 'Uses',
        direction,
      })
    }
  )

  it('covers every relationship keyword mermaid supports', () => {
    expect(REL_KEYWORDS).toHaveLength(11)
  })

  it('accepts the C4-PlantUML _Neighbor aliases', () => {
    expect(firstRelationship('Rel_Neighbor(a, b, "Uses")')).toMatchObject({
      direction: 'default',
    })
    expect(firstRelationship('BiRel_Neighbor(a, b, "Uses")')).toMatchObject({
      direction: 'bi',
    })
  })
})

describe('C4 relationship arguments', () => {
  it('reads Rel(from, to, label, ?techn, ?descr, ?sprite, ?tags)', () => {
    expect(
      firstRelationship('Rel(a, b, "Uses", "HTTPS", "Signs in", "img", "v1")')
    ).toMatchObject({
      label: 'Uses',
      technology: 'HTTPS',
      description: 'Signs in',
      sprite: 'img',
      tags: 'v1',
    })
  })

  it('accepts named arguments', () => {
    expect(
      firstRelationship(
        'Rel(a, b, "Uses", $techn="HTTPS", $descr="Signs in", $link="/docs")'
      )
    ).toMatchObject({
      technology: 'HTTPS',
      description: 'Signs in',
      link: '/docs',
    })
  })

  it('defaults the label to an empty string', () => {
    expect(firstRelationship('Rel(a, b)')).toMatchObject({ label: '' })
  })

  it('numbers relationships in declaration order', () => {
    const data = parseC4Diagram(`
C4Context
  Person(a, "A")
  Person(b, "B")
  Person(c, "C")
  Rel(a, b, "One")
  Rel(b, c, "Two")
  Rel(c, a, "Three")
`)

    expect(data.relationships.map((rel) => rel.index)).toEqual([0, 1, 2])
    expect(data.relationships.map((rel) => rel.label)).toEqual([
      'One',
      'Two',
      'Three',
    ])
  })

  it('ignores a relationship with no target', () => {
    expect(
      parseC4Diagram(`C4Context\n${SHAPES}\nRel(a)`).relationships
    ).toHaveLength(0)
  })

  it('merges a redeclared from/to pair, keeping its original position', () => {
    const data = parseC4Diagram(`
C4Context
  Person(a, "A")
  Person(b, "B")
  Person(c, "C")
  Rel(a, b, "First")
  Rel(b, c, "Other")
  Rel(a, b, "Second")
`)

    expect(data.relationships).toHaveLength(2)
    expect(data.relationships[0]).toMatchObject({ label: 'Second', index: 0 })
  })

  it('treats a reversed pair as a separate relationship', () => {
    const data = parseC4Diagram(
      `C4Context\n${SHAPES}\nRel(a, b, "There")\nRel(b, a, "Back")`
    )

    expect(data.relationships).toHaveLength(2)
  })
})

describe('RelIndex', () => {
  it('drops the leading sequence number and reads the rest as a Rel', () => {
    expect(
      firstRelationship('RelIndex(1, a, b, "Submits credentials to")')
    ).toMatchObject({
      from: 'a',
      to: 'b',
      label: 'Submits credentials to',
      direction: 'default',
      index: 0,
    })
  })

  it('orders by statement position, not by the given index', () => {
    const data = parseC4Diagram(`
C4Dynamic
  Person(a, "A")
  Person(b, "B")
  Person(c, "C")
  RelIndex(9, a, b, "First written")
  RelIndex(1, b, c, "Second written")
`)

    expect(data.relationships.map((rel) => rel.label)).toEqual([
      'First written',
      'Second written',
    ])
    expect(data.relationships.map((rel) => rel.index)).toEqual([0, 1])
  })

  it('keeps the remaining argument slots aligned', () => {
    expect(
      firstRelationship('RelIndex(1, a, b, "Uses", "HTTPS", "Signs in")')
    ).toMatchObject({
      technology: 'HTTPS',
      description: 'Signs in',
    })
  })
})
