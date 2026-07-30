import { describe, expect, it } from 'vitest'
import { isC4Diagram, parseC4Diagram } from '../parser'

describe('isC4Diagram', () => {
  const C4_TYPES = [
    'C4Context',
    'C4Container',
    'C4Component',
    'C4Dynamic',
    'C4Deployment',
  ]

  it.each(C4_TYPES)('detects %s', (type) => {
    expect(isC4Diagram(`${type}\n Person(a, "A")`)).toBe(true)
  })

  it('detects a diagram behind leading blank lines and comments', () => {
    expect(isC4Diagram('\n\n%% a note\nC4Context\n Person(a, "A")')).toBe(true)
  })

  it('detects a diagram behind leading indentation', () => {
    expect(isC4Diagram('    C4Context\n      Person(a, "A")')).toBe(true)
  })

  it('is case insensitive on the type keyword', () => {
    expect(isC4Diagram('c4context\n Person(a, "A")')).toBe(true)
  })

  const OTHER_DIAGRAMS = [
    'flowchart TD\n A --> B',
    'sequenceDiagram\n A ->> B: hi',
    'erDiagram\n A ||--o{ B : has',
    'classDiagram\n class A',
    'stateDiagram-v2\n [*] --> A',
  ]

  it.each(OTHER_DIAGRAMS)('rejects %s', (code) => {
    expect(isC4Diagram(code)).toBe(false)
  })

  it('rejects empty input', () => {
    expect(isC4Diagram('')).toBe(false)
    expect(isC4Diagram('   \n\n  ')).toBe(false)
  })
})

describe('C4 diagram header', () => {
  it.each([
    'C4Context',
    'C4Container',
    'C4Component',
    'C4Dynamic',
    'C4Deployment',
  ])('records the %s type', (type) => {
    expect(parseC4Diagram(`${type}\n Person(a, "A")`).type).toBe(type)
  })

  it('defaults to C4Context when no type is declared', () => {
    expect(parseC4Diagram('Person(a, "A")').type).toBe('C4Context')
  })

  it('reads an unquoted title', () => {
    expect(
      parseC4Diagram('C4Context\n title System Context diagram').title
    ).toBe('System Context diagram')
  })

  it('reads a quoted title', () => {
    expect(parseC4Diagram('C4Context\n title "Quoted title"').title).toBe(
      'Quoted title'
    )
  })

  it('reads accTitle', () => {
    expect(parseC4Diagram('C4Context\n accTitle: A short title').accTitle).toBe(
      'A short title'
    )
  })

  it('reads a single line accDescr', () => {
    expect(
      parseC4Diagram('C4Context\n accDescr: A short description').accDescription
    ).toBe('A short description')
  })

  it('reads a multi line accDescr block', () => {
    expect(
      parseC4Diagram(`
C4Context
  accDescr {
    First line
    Second line
  }
  Person(a, "A")
`).accDescription
    ).toBe('First line\nSecond line')
  })

  it('does not let an accDescr block close a boundary', () => {
    const data = parseC4Diagram(`
C4Context
  System_Boundary(b1, "Bank") {
    accDescr {
      Inside
    }
    System(core, "Core")
  }
`)

    expect(data.accDescription).toBe('Inside')
    expect(data.elements[0].parentId).toBe('b1')
  })

  it.each(['TB', 'BT', 'LR', 'RL'])('records direction %s', (direction) => {
    expect(parseC4Diagram(`C4Context\n direction ${direction}`).direction).toBe(
      direction
    )
  })

  it('leaves direction undefined when it is not declared', () => {
    expect(
      parseC4Diagram('C4Context\n Person(a, "A")').direction
    ).toBeUndefined()
  })
})

describe('C4 statement parsing', () => {
  it('strips whole line and trailing %% comments', () => {
    const data = parseC4Diagram(`
C4Context
  %% this whole line is a comment
  Person(a, "A") %% and this tail
  Person(b, "B")
`)

    expect(data.elements.map((el) => el.id)).toEqual(['a', 'b'])
  })

  it('joins a call that wraps across several lines', () => {
    const data = parseC4Diagram(`
C4Context
  Container(web,
    "Web Application",
    "Java, Spring MVC",
    "Delivers the static content")
`)

    expect(data.elements[0]).toMatchObject({
      id: 'web',
      label: 'Web Application',
      technology: 'Java, Spring MVC',
      description: 'Delivers the static content',
    })
  })

  it('tolerates arbitrary indentation and blank lines', () => {
    const data = parseC4Diagram(`

        C4Context

              Person(a, "A")


              System(b, "B")

`)

    expect(data.elements).toHaveLength(2)
  })

  it('tolerates CRLF line endings', () => {
    const data = parseC4Diagram(
      'C4Context\r\n  Person(a, "A")\r\n  System(b, "B")\r\n  Rel(a, b, "Uses")\r\n'
    )

    expect(data.elements).toHaveLength(2)
    expect(data.relationships).toHaveLength(1)
  })

  it('skips SHOW_ and HIDE_ legend directives', () => {
    const data = parseC4Diagram(`
C4Context
  SHOW_LEGEND()
  HIDE_STEREOTYPE()
  Person(a, "A")
`)

    expect(data.elements).toHaveLength(1)
  })

  it('skips statements it does not recognise instead of throwing', () => {
    const data = parseC4Diagram(`
C4Context
  Lay_D(a, b)
  AddElementTag("v1.0", $bgColor="grey")
  this line is nonsense
  Person(a, "A")
`)

    expect(data.elements).toHaveLength(1)
    expect(data.elements[0].id).toBe('a')
  })

  it('returns an empty diagram for empty input', () => {
    const data = parseC4Diagram('')

    expect(data.elements).toEqual([])
    expect(data.boundaries).toEqual([])
    expect(data.relationships).toEqual([])
  })

  it('ignores an unbalanced closing brace', () => {
    const data = parseC4Diagram(`
C4Context
  }
  Person(a, "A")
`)

    expect(data.elements[0].parentId).toBeUndefined()
  })
})
