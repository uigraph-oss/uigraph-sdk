import { describe, expect, it } from 'vitest'
import { parseC4Diagram } from '../parser'

function firstElement(code: string) {
  return parseC4Diagram(`C4Context\n${code}`).elements[0]
}

/** Every shape keyword mermaid's lexer accepts, with the tag it renders. */
const SHAPE_KEYWORDS: {
  keyword: string
  kind: string
  shape: string
  isExternal: boolean
  stereotype: string
}[] = [
  {
    keyword: 'Person',
    kind: 'person',
    shape: 'default',
    isExternal: false,
    stereotype: 'person',
  },
  {
    keyword: 'Person_Ext',
    kind: 'person',
    shape: 'default',
    isExternal: true,
    stereotype: 'external_person',
  },
  {
    keyword: 'System',
    kind: 'system',
    shape: 'default',
    isExternal: false,
    stereotype: 'system',
  },
  {
    keyword: 'SystemDb',
    kind: 'system',
    shape: 'db',
    isExternal: false,
    stereotype: 'system_db',
  },
  {
    keyword: 'SystemQueue',
    kind: 'system',
    shape: 'queue',
    isExternal: false,
    stereotype: 'system_queue',
  },
  {
    keyword: 'System_Ext',
    kind: 'system',
    shape: 'default',
    isExternal: true,
    stereotype: 'external_system',
  },
  {
    keyword: 'SystemDb_Ext',
    kind: 'system',
    shape: 'db',
    isExternal: true,
    stereotype: 'external_system_db',
  },
  {
    keyword: 'SystemQueue_Ext',
    kind: 'system',
    shape: 'queue',
    isExternal: true,
    stereotype: 'external_system_queue',
  },
  {
    keyword: 'Container',
    kind: 'container',
    shape: 'default',
    isExternal: false,
    stereotype: 'container',
  },
  {
    keyword: 'ContainerDb',
    kind: 'container',
    shape: 'db',
    isExternal: false,
    stereotype: 'container_db',
  },
  {
    keyword: 'ContainerQueue',
    kind: 'container',
    shape: 'queue',
    isExternal: false,
    stereotype: 'container_queue',
  },
  {
    keyword: 'Container_Ext',
    kind: 'container',
    shape: 'default',
    isExternal: true,
    stereotype: 'external_container',
  },
  {
    keyword: 'ContainerDb_Ext',
    kind: 'container',
    shape: 'db',
    isExternal: true,
    stereotype: 'external_container_db',
  },
  {
    keyword: 'ContainerQueue_Ext',
    kind: 'container',
    shape: 'queue',
    isExternal: true,
    stereotype: 'external_container_queue',
  },
  {
    keyword: 'Component',
    kind: 'component',
    shape: 'default',
    isExternal: false,
    stereotype: 'component',
  },
  {
    keyword: 'ComponentDb',
    kind: 'component',
    shape: 'db',
    isExternal: false,
    stereotype: 'component_db',
  },
  {
    keyword: 'ComponentQueue',
    kind: 'component',
    shape: 'queue',
    isExternal: false,
    stereotype: 'component_queue',
  },
  {
    keyword: 'Component_Ext',
    kind: 'component',
    shape: 'default',
    isExternal: true,
    stereotype: 'external_component',
  },
  {
    keyword: 'ComponentDb_Ext',
    kind: 'component',
    shape: 'db',
    isExternal: true,
    stereotype: 'external_component_db',
  },
  {
    keyword: 'ComponentQueue_Ext',
    kind: 'component',
    shape: 'queue',
    isExternal: true,
    stereotype: 'external_component_queue',
  },
]

describe('C4 shape keywords', () => {
  it.each(SHAPE_KEYWORDS)(
    '$keyword is a $kind with a $shape shape',
    ({ keyword, kind, shape, isExternal, stereotype }) => {
      expect(firstElement(`${keyword}(a, "A")`)).toMatchObject({
        id: 'a',
        label: 'A',
        kind,
        shape,
        isExternal,
        stereotype,
      })
    }
  )

  it('covers every shape keyword mermaid supports', () => {
    expect(SHAPE_KEYWORDS).toHaveLength(20)
  })
})

describe('C4 shape arguments', () => {
  it('reads Person(alias, label, ?descr, ?sprite, ?tags, $link)', () => {
    expect(
      firstElement('Person(a, "Customer", "Buys things", "img", "v1.0")')
    ).toMatchObject({
      id: 'a',
      label: 'Customer',
      description: 'Buys things',
      sprite: 'img',
      tags: 'v1.0',
      technology: undefined,
    })
  })

  it('reads System(alias, label, ?descr) with no technology slot', () => {
    expect(firstElement('System(s, "Banking", "Core system")')).toMatchObject({
      description: 'Core system',
      technology: undefined,
    })
  })

  it('reads Container(alias, label, ?techn, ?descr, ?sprite, ?tags)', () => {
    expect(
      firstElement('Container(c, "Web App", "React", "The UI", "img", "v2")')
    ).toMatchObject({
      label: 'Web App',
      technology: 'React',
      description: 'The UI',
      sprite: 'img',
      tags: 'v2',
    })
  })

  it('reads Component(alias, label, ?techn, ?descr) the same way', () => {
    expect(
      firstElement('Component(c, "Sign In", "Spring Bean", "Signs users in")')
    ).toMatchObject({
      technology: 'Spring Bean',
      description: 'Signs users in',
    })
  })

  it('falls back to the alias when no label is given', () => {
    expect(firstElement('Person(lonely)')).toMatchObject({
      id: 'lonely',
      label: 'lonely',
    })
  })

  it('accepts unquoted labels', () => {
    expect(firstElement('Person(customer, Customer)')).toMatchObject({
      label: 'Customer',
    })
  })

  it('accepts named arguments in place of positional ones', () => {
    expect(
      firstElement(
        'Container(c, "Web App", $techn="React", $descr="The UI", $tags="v2", $sprite="img")'
      )
    ).toMatchObject({
      technology: 'React',
      description: 'The UI',
      tags: 'v2',
      sprite: 'img',
    })
  })

  it('lets a named argument win over the positional slot', () => {
    expect(
      firstElement('Container(c, "Web App", "React", $descr="Named wins")')
    ).toMatchObject({
      technology: 'React',
      description: 'Named wins',
    })
  })

  it('keeps later arguments in place when a slot is skipped with ,,', () => {
    expect(
      firstElement('Container(c, "Web App",, "Description only")')
    ).toMatchObject({
      technology: undefined,
      description: 'Description only',
    })
  })

  it('turns <br/> into a newline', () => {
    expect(
      firstElement('Person(a, "A", "one<br/>two<br />three")')
    ).toMatchObject({ description: 'one\ntwo\nthree' })
  })

  it('keeps commas inside quoted arguments', () => {
    expect(
      firstElement('Container(c, "App", "Java, Spring MVC", "Serves, well")')
    ).toMatchObject({
      technology: 'Java, Spring MVC',
      description: 'Serves, well',
    })
  })

  it('keeps parentheses inside quoted arguments', () => {
    expect(
      firstElement('Component(c, "Auth", "Bean", "Calls isAuthenticated() on")')
    ).toMatchObject({ description: 'Calls isAuthenticated() on' })
  })

  it('unescapes embedded quotes', () => {
    expect(firstElement('Person(a, "A", "say \\"hi\\"")')).toMatchObject({
      description: 'say "hi"',
    })
  })

  it('reads a $link and its uig sub diagram target', () => {
    expect(
      firstElement('System(api, "API", "Backend", $link="uig:diagram-123")')
    ).toMatchObject({
      link: 'uig:diagram-123',
      subDiagramId: 'diagram-123',
    })
  })

  it('leaves a non uig $link without a sub diagram', () => {
    expect(
      firstElement('System(api, "API", "Backend", $link="https://example.com")')
    ).toMatchObject({
      link: 'https://example.com',
      subDiagramId: undefined,
    })
  })

  it('ignores a shape with no alias', () => {
    expect(parseC4Diagram('C4Context\nPerson()').elements).toHaveLength(0)
  })

  it('merges a redeclared alias instead of emitting a duplicate', () => {
    const data = parseC4Diagram(`
C4Context
  Person(a, "First")
  Person(a, "Second", "Now with a description")
`)

    expect(data.elements).toHaveLength(1)
    expect(data.elements[0]).toMatchObject({
      label: 'Second',
      description: 'Now with a description',
    })
  })
})
