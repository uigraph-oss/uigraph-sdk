import { describe, expect, it } from 'vitest'
import { parseC4Diagram } from '../c4-parser'

function firstBoundary(code: string) {
  return parseC4Diagram(`C4Context\n${code}`).boundaries[0]
}

describe('C4 boundary keywords', () => {
  it('Boundary defaults its type to system', () => {
    expect(firstBoundary('Boundary(b, "Group") { }')).toMatchObject({
      id: 'b',
      label: 'Group',
      kind: 'generic',
      type: 'system',
      nodeType: undefined,
    })
  })

  it('Boundary takes a custom type in its third slot', () => {
    expect(firstBoundary('Boundary(b, "Group", "boundary") { }')).toMatchObject(
      {
        kind: 'generic',
        type: 'boundary',
      }
    )
  })

  it('Enterprise_Boundary prints a fixed ENTERPRISE type', () => {
    expect(firstBoundary('Enterprise_Boundary(b, "Bank") { }')).toMatchObject({
      kind: 'enterprise',
      type: 'ENTERPRISE',
    })
  })

  it('System_Boundary prints a fixed SYSTEM type', () => {
    expect(firstBoundary('System_Boundary(b, "Bank") { }')).toMatchObject({
      kind: 'system',
      type: 'SYSTEM',
    })
  })

  it('Container_Boundary prints a fixed CONTAINER type', () => {
    expect(firstBoundary('Container_Boundary(b, "API") { }')).toMatchObject({
      kind: 'container',
      type: 'CONTAINER',
    })
  })

  it('reads the third argument of a fixed-type boundary as ?tags, not a type', () => {
    expect(
      firstBoundary('System_Boundary(b, "Bank", "v1.0") { }')
    ).toMatchObject({
      type: 'SYSTEM',
      tags: 'v1.0',
    })
  })

  it('reads Boundary(alias, label, ?type, ?tags, $link)', () => {
    expect(
      firstBoundary('Boundary(b, "Group", "zone", "v1.0", $link="/docs") { }')
    ).toMatchObject({
      type: 'zone',
      tags: 'v1.0',
      link: '/docs',
    })
  })

  it('falls back to the alias when no label is given', () => {
    expect(firstBoundary('Boundary(b) { }')).toMatchObject({
      id: 'b',
      label: 'b',
    })
  })

  it('names an anonymous boundary', () => {
    expect(firstBoundary('Boundary() { }')).toMatchObject({
      id: 'boundary-1',
      label: 'boundary-1',
    })
  })
})

describe('C4 deployment nodes', () => {
  const NODE_KEYWORDS = [
    { keyword: 'Deployment_Node', nodeType: 'node' },
    { keyword: 'Node', nodeType: 'node' },
    { keyword: 'Node_L', nodeType: 'nodeL' },
    { keyword: 'Node_R', nodeType: 'nodeR' },
  ]

  it.each(NODE_KEYWORDS)(
    '$keyword is a boundary of kind node',
    ({ keyword, nodeType }) => {
      const data = parseC4Diagram(`C4Deployment\n${keyword}(n, "Server") { }`)

      expect(data.elements).toHaveLength(0)
      expect(data.boundaries[0]).toMatchObject({
        id: 'n',
        label: 'Server',
        kind: 'node',
        type: 'node',
        nodeType,
      })
    }
  )

  it('reads Node(alias, label, ?type, ?descr, ?sprite, ?tags)', () => {
    const data = parseC4Diagram(
      'C4Deployment\nNode(n, "Server", "Ubuntu 16.04 LTS", "Runs the API", "img", "v1") { }'
    )

    expect(data.boundaries[0]).toMatchObject({
      label: 'Server',
      type: 'Ubuntu 16.04 LTS',
      description: 'Runs the API',
      sprite: 'img',
      tags: 'v1',
    })
  })

  it('holds its children the way a boundary does', () => {
    const data = parseC4Diagram(`
C4Deployment
  Deployment_Node(mob, "Customer's mobile device", "Apple IOS or Android") {
    Container(mobile, "Mobile App", "Xamarin", "A limited subset.")
  }
`)

    expect(data.boundaries[0].childIds).toEqual(['mobile'])
    expect(data.elements[0].parentId).toBe('mob')
  })
})

describe('C4 boundary nesting', () => {
  const NESTED = `
C4Context
  Enterprise_Boundary(b0, "Outer") {
    Person(customer, "Customer")

    System_Boundary(b1, "Middle") {
      Container_Boundary(b2, "Inner") {
        System(core, "Core")
      }
    }
  }

  System_Ext(mail, "Mail")
`

  it('records the parent of every nested boundary', () => {
    const data = parseC4Diagram(NESTED)
    const byId = new Map(data.boundaries.map((b) => [b.id, b]))

    expect(byId.get('b0')?.parentId).toBeUndefined()
    expect(byId.get('b1')?.parentId).toBe('b0')
    expect(byId.get('b2')?.parentId).toBe('b1')
  })

  it('records children on each boundary', () => {
    const data = parseC4Diagram(NESTED)
    const byId = new Map(data.boundaries.map((b) => [b.id, b]))

    expect(byId.get('b0')?.childIds).toEqual(['customer', 'b1'])
    expect(byId.get('b1')?.childIds).toEqual(['b2'])
    expect(byId.get('b2')?.childIds).toEqual(['core'])
  })

  it('leaves elements declared outside every boundary unparented', () => {
    const data = parseC4Diagram(NESTED)

    expect(
      data.elements.find((el) => el.id === 'mail')?.parentId
    ).toBeUndefined()
  })

  it('closes a boundary on its own brace line', () => {
    const data = parseC4Diagram(`
C4Context
  System_Boundary(b1, "One") {
    System(a, "A")
  }
  System(b, "B")
`)

    expect(data.elements.find((el) => el.id === 'b')?.parentId).toBeUndefined()
  })

  it('accepts a brace glued to the closing parenthesis', () => {
    const data = parseC4Diagram(`
C4Deployment
  Deployment_Node(n, "Server"){
    Container(api, "API")
  }
`)

    expect(data.elements[0].parentId).toBe('n')
  })

  it('merges a redeclared boundary but keeps the children it collected', () => {
    const data = parseC4Diagram(`
C4Context
  System_Boundary(b1, "First") {
    System(a, "A")
  }
  System_Boundary(b1, "Second") {
    System(b, "B")
  }
`)

    expect(data.boundaries).toHaveLength(1)
    expect(data.boundaries[0].label).toBe('Second')
    expect(data.boundaries[0].childIds).toEqual(['a', 'b'])
  })
})
