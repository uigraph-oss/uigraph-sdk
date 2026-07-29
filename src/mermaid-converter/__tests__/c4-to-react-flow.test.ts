import { describe, expect, it } from 'vitest'
import { parseC4Diagram } from '../c4-parser'
import {
  C4_LAYOUT,
  convertC4MermaidToReactFlow,
  convertC4ToReactFlow,
  getC4ElementColors,
} from '../c4-to-react-flow'

const CONTEXT_DIAGRAM = `
C4Context
  title System Context diagram for Internet Banking System

  Enterprise_Boundary(b0, "BankBoundary0") {
    Person(customerA, "Banking Customer A", "A customer of the bank.")
    Person_Ext(customerC, "Banking Customer C", "A customer of the bank.")

    System(SystemAA, "Internet Banking System", "Allows customers to view information.")

    System_Boundary(b1, "BankBoundary") {
      SystemDb(SystemC, "Core Banking System", "Stores all of the core banking information.")
      SystemQueue(SystemD, "Event Bus", "Publishes banking events.")
    }
  }

  System_Ext(SystemE, "Mail System", "The internal Microsoft Exchange system.")

  Rel(customerA, SystemAA, "Uses")
  BiRel(customerC, SystemAA, "Uses")
  Rel(SystemAA, SystemE, "Sends e-mails", "SMTP")
  Rel(SystemAA, SystemC, "Reads from and writes to", "sync, JSON/HTTPS")
  UpdateRelStyle(customerA, SystemAA, $offsetY="60")
`

describe('C4 nodes', () => {
  it('emits a boundary node, an element node and their parent links', () => {
    const flow = convertC4ToReactFlow(parseC4Diagram(CONTEXT_DIAGRAM))
    const byId = new Map(flow.nodes.map((node) => [node.id, node]))

    expect(byId.get('b0')?.type).toBe('c4Boundary')
    expect(byId.get('b1')?.parentId).toBe('b0')
    expect(byId.get('SystemC')?.type).toBe('c4')
    expect(byId.get('SystemC')?.parentId).toBe('b1')
    expect(byId.get('SystemE')?.parentId).toBeUndefined()
  })

  it('constrains a nested node to its parent', () => {
    const flow = convertC4ToReactFlow(parseC4Diagram(CONTEXT_DIAGRAM))
    const byId = new Map(flow.nodes.map((node) => [node.id, node]))

    expect(byId.get('SystemC')?.extent).toBe('parent')
    expect(byId.get('SystemE')?.extent).toBeUndefined()
  })

  it('carries the C4 metadata onto the node data', () => {
    const flow = convertC4ToReactFlow(parseC4Diagram(CONTEXT_DIAGRAM))
    const systemC = flow.nodes.find((node) => node.id === 'SystemC')!

    expect(systemC.data).toMatchObject({
      source: 'mermaid',
      c4Kind: 'system',
      c4Shape: 'db',
      isExternal: false,
      description: 'Stores all of the core banking information.',
    })
  })

  it('carries the boundary type and description onto the boundary data', () => {
    const flow = convertC4MermaidToReactFlow(`
C4Deployment
  Deployment_Node(n, "Server", "Ubuntu 16.04 LTS", "Runs the API") {
    Container(api, "API", "Java")
  }
`)
    const boundary = flow.nodes.find((node) => node.id === 'n')!

    expect(boundary.type).toBe('c4Boundary')
    expect(boundary.data).toMatchObject({
      c4BoundaryKind: 'node',
      c4NodeType: 'node',
      boundaryType: 'Ubuntu 16.04 LTS',
      description: 'Runs the API',
    })
  })

  it('gives external elements the muted palette', () => {
    expect(
      getC4ElementColors({ kind: 'person', isExternal: false } as never)
    ).not.toEqual(
      getC4ElementColors({ kind: 'person', isExternal: true } as never)
    )
  })

  it('renders a $link="uig:…" element as a sub diagram node', () => {
    const flow = convertC4MermaidToReactFlow(
      'C4Container\n System(api, "API", "Backend", $link="uig:diagram-123")'
    )

    expect(flow.nodes[0].type).toBe('subDiagram')
    expect(flow.nodes[0].data.diagramId).toBe('diagram-123')
    expect(flow.nodes[0].data.diagramName).toBe('API')
  })

  it('emits unique node ids for a redeclared alias', () => {
    const flow = convertC4MermaidToReactFlow(`
C4Context
  Person(a, "First")
  Person(a, "Second")
`)

    expect(flow.nodes).toHaveLength(1)
  })
})

describe('C4 layout', () => {
  it('packs shapes into rows of c4ShapeInRow', () => {
    const flow = convertC4MermaidToReactFlow(`
C4Context
  Person(a, "A")
  Person(b, "B")
  Person(c, "C")
  UpdateLayoutConfig($c4ShapeInRow="2")
`)
    const byId = new Map(flow.nodes.map((node) => [node.id, node]))

    expect(byId.get('a')!.position.y).toBe(byId.get('b')!.position.y)
    expect(byId.get('b')!.position.x).toBeGreaterThan(byId.get('a')!.position.x)
    expect(byId.get('c')!.position.x).toBe(byId.get('a')!.position.x)
    expect(byId.get('c')!.position.y).toBeGreaterThan(byId.get('a')!.position.y)
  })

  it('packs boundaries into rows of c4BoundaryInRow', () => {
    const flow = convertC4MermaidToReactFlow(`
C4Context
  System_Boundary(b1, "One") { System(a, "A") }
  System_Boundary(b2, "Two") { System(b, "B") }
  System_Boundary(b3, "Three") { System(c, "C") }
  UpdateLayoutConfig($c4BoundaryInRow="2")
`)
    const byId = new Map(flow.nodes.map((node) => [node.id, node]))

    expect(byId.get('b1')!.position.y).toBe(byId.get('b2')!.position.y)
    expect(byId.get('b2')!.position.x).toBeGreaterThan(
      byId.get('b1')!.position.x
    )
    expect(byId.get('b3')!.position.y).toBeGreaterThan(
      byId.get('b1')!.position.y
    )
  })

  it('keeps every child inside its parent boundary', () => {
    const flow = convertC4ToReactFlow(parseC4Diagram(CONTEXT_DIAGRAM))
    const byId = new Map(flow.nodes.map((node) => [node.id, node]))

    for (const node of flow.nodes) {
      if (!node.parentId) continue

      const parent = byId.get(node.parentId)!
      const width = (node.width ?? C4_LAYOUT.WIDTH) as number

      expect(node.position.x).toBeGreaterThanOrEqual(0)
      expect(node.position.y).toBeGreaterThanOrEqual(0)
      expect(node.position.x + width).toBeLessThanOrEqual(
        parent.style!.width as number
      )
      expect(node.position.y + (node.height as number)).toBeLessThanOrEqual(
        parent.style!.height as number
      )
    }
  })

  it('grows a boundary to fit deeply nested children', () => {
    const flow = convertC4MermaidToReactFlow(`
C4Deployment
  Deployment_Node(outer, "Outer") {
    Deployment_Node(middle, "Middle") {
      Deployment_Node(inner, "Inner") {
        Container(api, "API", "Java")
      }
    }
  }
`)
    const byId = new Map(flow.nodes.map((node) => [node.id, node]))

    const outer = byId.get('outer')!.style!.width as number
    const middle = byId.get('middle')!.style!.width as number
    const inner = byId.get('inner')!.style!.width as number

    expect(outer).toBeGreaterThan(middle)
    expect(middle).toBeGreaterThan(inner)
    expect(inner).toBeGreaterThan(C4_LAYOUT.WIDTH)
  })

  it('gives a taller shape to a longer description', () => {
    const flow = convertC4MermaidToReactFlow(`
C4Context
  System(short, "S", "Short.")
  System(long, "L", "A much longer description that has to wrap over several lines inside the shape before it fits.")
`)
    const byId = new Map(flow.nodes.map((node) => [node.id, node]))

    expect(byId.get('long')!.height as number).toBeGreaterThan(
      byId.get('short')!.height as number
    )
  })

  it('never lays a shape out narrower than the mermaid shape width', () => {
    const flow = convertC4ToReactFlow(parseC4Diagram(CONTEXT_DIAGRAM))

    for (const node of flow.nodes) {
      if (node.type === 'c4Boundary') continue
      expect(node.width).toBe(C4_LAYOUT.WIDTH)
      expect(node.height as number).toBeGreaterThanOrEqual(C4_LAYOUT.MIN_HEIGHT)
    }
  })
})

describe('C4 edges', () => {
  it('emits one edge per relationship', () => {
    const flow = convertC4ToReactFlow(parseC4Diagram(CONTEXT_DIAGRAM))

    expect(flow.edges).toHaveLength(4)
    expect(new Set(flow.edges.map((edge) => edge.id)).size).toBe(4)
  })

  it('appends the technology to the label the way mermaid does', () => {
    const flow = convertC4ToReactFlow(parseC4Diagram(CONTEXT_DIAGRAM))

    expect(flow.edges[2].label).toBe('Sends e-mails [SMTP]')
    expect(flow.edges[0].label).toBe('Uses')
  })

  it('adds a start marker only for a bidirectional relationship', () => {
    const flow = convertC4ToReactFlow(parseC4Diagram(CONTEXT_DIAGRAM))

    expect(flow.edges[0].markerStart).toBeUndefined()
    expect(flow.edges[1].markerStart).toBeDefined()
    expect(flow.edges.every((edge) => edge.markerEnd)).toBe(true)
  })

  it('flips source and target for Rel_Back', () => {
    const flow = convertC4MermaidToReactFlow(`
C4Container
  ContainerDb(database, "Database", "SQL")
  Container(backend_api, "API", "Java")
  Rel_Back(database, backend_api, "Reads from and writes to", "sync, JDBC")
`)

    expect(flow.edges[0]).toMatchObject({
      source: 'backend_api',
      target: 'database',
    })
  })

  it('anchors an edge to the handles facing the other shape', () => {
    const flow = convertC4MermaidToReactFlow(`
C4Context
  Person(a, "A")
  Person(b, "B")
  UpdateLayoutConfig($c4ShapeInRow="1")
  Rel(a, b, "Down")
  Rel(b, a, "Up")
`)

    expect(flow.edges[0]).toMatchObject({
      sourceHandle: 'source-bottom',
      targetHandle: 'target-top',
    })
    expect(flow.edges[1]).toMatchObject({
      sourceHandle: 'source-top',
      targetHandle: 'target-bottom',
    })
  })

  it.each([
    { keyword: 'Rel_U', source: 'source-top', target: 'target-bottom' },
    { keyword: 'Rel_D', source: 'source-bottom', target: 'target-top' },
    { keyword: 'Rel_L', source: 'source-left', target: 'target-right' },
    { keyword: 'Rel_R', source: 'source-right', target: 'target-left' },
  ])('honours the $keyword side hint', ({ keyword, source, target }) => {
    const flow = convertC4MermaidToReactFlow(
      `C4Context\n Person(a, "A")\n Person(b, "B")\n ${keyword}(a, b, "Hint")`
    )

    expect(flow.edges[0]).toMatchObject({
      sourceHandle: source,
      targetHandle: target,
    })
  })

  it('anchors across boundaries using absolute positions', () => {
    const flow = convertC4MermaidToReactFlow(`
C4Context
  System_Boundary(left, "Left") { System(a, "A") }
  System_Boundary(right, "Right") { System(b, "B") }
  Rel(a, b, "Uses")
`)

    expect(flow.edges[0].sourceHandle).toBe('source-right')
    expect(flow.edges[0].targetHandle).toBe('target-left')
  })

  it('applies UpdateRelStyle to the edge stroke and label offsets', () => {
    const flow = convertC4MermaidToReactFlow(`
C4Context
  Person(customerA, "Banking Customer A")
  System(SystemAA, "Internet Banking System")
  Rel(customerA, SystemAA, "Uses")
  UpdateRelStyle(customerA, SystemAA, $textColor="green", $lineColor="blue", $offsetX="5", $offsetY="-40")
`)

    expect(flow.edges[0].style?.stroke).toBe('blue')
    expect(flow.edges[0].data).toMatchObject({
      labelColor: 'green',
      labelOffsetX: 5,
      labelOffsetY: -40,
    })
  })

  it('applies UpdateElementStyle to the node fill and stroke', () => {
    const flow = convertC4MermaidToReactFlow(`
C4Context
  Person(customerA, "Banking Customer A")
  UpdateElementStyle(customerA, $bgColor="grey", $borderColor="red", $fontColor="white")
`)
    const customerA = flow.nodes[0]

    expect(customerA.data.fill).toBe('grey')
    expect(customerA.data.stroke).toBe('red')
    expect(customerA.data.fontColor).toBe('white')
  })

  it('drops a relationship pointing at an undeclared alias', () => {
    const flow = convertC4MermaidToReactFlow(`
C4Context
  Person(a, "A")
  Rel(a, ghost, "Uses")
  Rel(ghost, a, "Uses")
`)

    expect(flow.edges).toHaveLength(0)
  })

  it('keeps a relationship that targets a boundary', () => {
    const flow = convertC4MermaidToReactFlow(`
C4Context
  Person(a, "A")
  System_Boundary(b1, "Bank") { System(core, "Core") }
  Rel(a, b1, "Uses")
`)

    expect(flow.edges).toHaveLength(1)
    expect(flow.edges[0].target).toBe('b1')
  })
})
