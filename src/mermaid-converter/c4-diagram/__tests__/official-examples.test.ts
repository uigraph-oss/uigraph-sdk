import { Node } from '@xyflow/react'
import { describe, expect, it } from 'vitest'
import { CustomData } from '../../../types/rf'
import { convertMermaidToReactFlow } from '../../index'
import {
  C4_COMPONENT_EXAMPLE,
  C4_CONTAINER_EXAMPLE,
  C4_CONTEXT_EXAMPLE,
  C4_DEPLOYMENT_EXAMPLE,
  C4_DYNAMIC_EXAMPLE,
  C4_OFFICIAL_EXAMPLES,
} from '../fixtures/official-diagrams'
import { isC4Diagram, parseC4Diagram } from '../parser'
import { C4_LAYOUT, convertC4MermaidToReactFlow } from '../to-react-flow'

describe.each(C4_OFFICIAL_EXAMPLES)('$name example', ({ name, code }) => {
  it('is detected as a C4 diagram', () => {
    expect(isC4Diagram(code)).toBe(true)
  })

  it('reads its declared type and title', () => {
    const data = parseC4Diagram(code)

    expect(data.type).toBe(name)
    expect(data.title).toBeTruthy()
  })

  it('declares every relationship endpoint', () => {
    const data = parseC4Diagram(code)
    const ids = new Set([
      ...data.elements.map((el) => el.id),
      ...data.boundaries.map((boundary) => boundary.id),
    ])

    for (const rel of data.relationships) {
      expect(ids.has(rel.from)).toBe(true)
      expect(ids.has(rel.to)).toBe(true)
    }
  })

  it('resolves every parent to a declared boundary', () => {
    const data = parseC4Diagram(code)
    const boundaryIds = new Set(data.boundaries.map((boundary) => boundary.id))

    for (const element of data.elements) {
      if (!element.parentId) continue
      expect(boundaryIds.has(element.parentId)).toBe(true)
    }
    for (const boundary of data.boundaries) {
      if (!boundary.parentId) continue
      expect(boundaryIds.has(boundary.parentId)).toBe(true)
    }
  })

  it('closes every boundary it opens', () => {
    const data = parseC4Diagram(code)
    const opened = (code.match(/\{/g) ?? []).length

    expect(data.boundaries).toHaveLength(opened)
  })

  it('converts to React Flow with unique node and edge ids', () => {
    const flow = convertC4MermaidToReactFlow(code)

    expect(flow.nodes.length).toBeGreaterThan(0)
    expect(new Set(flow.nodes.map((node) => node.id)).size).toBe(
      flow.nodes.length
    )
    expect(new Set(flow.edges.map((edge) => edge.id)).size).toBe(
      flow.edges.length
    )
  })

  it('emits one node per declared element and boundary', () => {
    const data = parseC4Diagram(code)
    const flow = convertC4MermaidToReactFlow(code)

    expect(flow.nodes).toHaveLength(
      data.elements.length + data.boundaries.length
    )
    expect(flow.edges).toHaveLength(data.relationships.length)
  })

  it('positions every node inside its parent', () => {
    const flow = convertC4MermaidToReactFlow(code)
    const byId = new Map<string, Node<CustomData>>(
      flow.nodes.map((node) => [node.id, node])
    )

    for (const node of flow.nodes) {
      if (!node.parentId) continue

      const parent = byId.get(node.parentId)!
      const width = (node.width ?? C4_LAYOUT.WIDTH) as number
      const height = (node.height ?? C4_LAYOUT.MIN_HEIGHT) as number

      expect(node.position.x).toBeGreaterThanOrEqual(0)
      expect(node.position.y).toBeGreaterThanOrEqual(0)
      expect(node.position.x + width).toBeLessThanOrEqual(
        parent.style!.width as number
      )
      expect(node.position.y + height).toBeLessThanOrEqual(
        parent.style!.height as number
      )
    }
  })

  it('gives every node a positive size', () => {
    const flow = convertC4MermaidToReactFlow(code)

    for (const node of flow.nodes) {
      expect(node.style!.width as number).toBeGreaterThan(0)
      expect(node.style!.height as number).toBeGreaterThan(0)
    }
  })

  it('routes through convertMermaidToReactFlow', async () => {
    const flow = await convertMermaidToReactFlow(code)
    const converted = convertC4MermaidToReactFlow(code)

    expect(flow.nodes).toHaveLength(converted.nodes.length)
    expect(flow.edges).toHaveLength(converted.edges.length)
  })
})

describe('C4Context example specifics', () => {
  const data = parseC4Diagram(C4_CONTEXT_EXAMPLE)

  it('reads the title', () => {
    expect(data.title).toBe(
      'System Context diagram for Internet Banking System'
    )
  })

  it('declares eight systems and four people across four boundaries', () => {
    expect(data.boundaries.map((boundary) => boundary.id)).toEqual([
      'b0',
      'b1',
      'b2',
      'b3',
    ])
    expect(
      data.elements.filter((el) => el.kind === 'person').map((el) => el.id)
    ).toEqual(['customerA', 'customerB', 'customerC', 'customerD'])
    expect(data.elements.filter((el) => el.kind === 'system')).toHaveLength(8)
  })

  it('nests b3 inside b1 inside b0', () => {
    const byId = new Map(data.boundaries.map((b) => [b.id, b]))

    expect(byId.get('b0')?.parentId).toBeUndefined()
    expect(byId.get('b1')?.parentId).toBe('b0')
    expect(byId.get('b2')?.parentId).toBe('b1')
    expect(byId.get('b3')?.parentId).toBe('b1')
  })

  it('keeps the custom type of the plain Boundary and the fixed types of the rest', () => {
    const byId = new Map(data.boundaries.map((b) => [b.id, b]))

    expect(byId.get('b0')?.type).toBe('ENTERPRISE')
    expect(byId.get('b1')?.type).toBe('ENTERPRISE')
    expect(byId.get('b2')?.type).toBe('SYSTEM')
    expect(byId.get('b3')?.type).toBe('boundary')
  })

  it('splits customerD s description on its <br/>', () => {
    expect(data.elements.find((el) => el.id === 'customerD')?.description).toBe(
      'A customer of the bank, \n with personal bank accounts.'
    )
  })

  it('reads the queue and db shapes', () => {
    const byId = new Map(data.elements.map((el) => [el.id, el]))

    expect(byId.get('SystemE')).toMatchObject({ shape: 'db', isExternal: true })
    expect(byId.get('SystemD')).toMatchObject({
      shape: 'db',
      isExternal: false,
    })
    expect(byId.get('SystemF')).toMatchObject({
      shape: 'queue',
      isExternal: false,
    })
    expect(byId.get('SystemG')).toMatchObject({
      shape: 'queue',
      isExternal: true,
    })
  })

  it('reads its two BiRel and two Rel statements', () => {
    expect(data.relationships.map((rel) => rel.direction)).toEqual([
      'bi',
      'bi',
      'default',
      'default',
    ])
  })

  it('reads all five style overrides and the layout config', () => {
    expect(Object.keys(data.relStyles)).toHaveLength(4)
    expect(data.elementStyles.customerA).toMatchObject({
      fontColor: 'red',
      bgColor: 'grey',
      borderColor: 'red',
    })
    expect(data.layout).toEqual({ c4ShapeInRow: 3, c4BoundaryInRow: 1 })
  })
})

describe('C4Container example specifics', () => {
  const data = parseC4Diagram(C4_CONTAINER_EXAMPLE)

  it('reads $tags alongside positional arguments', () => {
    expect(data.elements.find((el) => el.id === 'email_system')).toMatchObject({
      isExternal: true,
      tags: 'v1.0',
      description: 'The internal Microsoft Exchange system',
    })
  })

  it('reads an unquoted label', () => {
    expect(data.elements.find((el) => el.id === 'customer')?.label).toBe(
      'Customer'
    )
  })

  it('splits technology from description for every container', () => {
    expect(data.elements.find((el) => el.id === 'spa')).toMatchObject({
      technology: 'JavaScript, Angular',
      description:
        'Provides all the Internet banking functionality to customers via their web browser',
    })
  })

  it('parents only the containers declared inside Container_Boundary', () => {
    const inside = data.elements
      .filter((el) => el.parentId === 'c1')
      .map((el) => el.id)

    expect(inside).toEqual([
      'spa',
      'mobile_app',
      'web_app',
      'database',
      'backend_api',
    ])
  })

  it('flips the Rel_Back edge', () => {
    const flow = convertC4MermaidToReactFlow(C4_CONTAINER_EXAMPLE)
    const edge = flow.edges.find((candidate) =>
      candidate.id.startsWith('c4-rel-database-backend_api')
    )!

    expect(edge).toMatchObject({
      source: 'backend_api',
      target: 'database',
      label: 'Reads from and writes to [sync, JDBC]',
    })
  })
})

describe('C4Component example specifics', () => {
  const data = parseC4Diagram(C4_COMPONENT_EXAMPLE)

  it('reads relationships declared inside a boundary block', () => {
    expect(data.relationships.map((rel) => `${rel.from}->${rel.to}`)).toContain(
      'sign->security'
    )
  })

  it('parents the components but not the containers', () => {
    expect(data.elements.find((el) => el.id === 'sign')?.parentId).toBe('api')
    expect(
      data.elements.find((el) => el.id === 'spa')?.parentId
    ).toBeUndefined()
  })

  it('keeps an ampersand in a label', () => {
    expect(
      data.relationships.find((rel) => rel.from === 'security')?.label
    ).toBe('Read & write to')
  })
})

describe('C4Dynamic example specifics', () => {
  const data = parseC4Diagram(C4_DYNAMIC_EXAMPLE)

  it('keeps parentheses inside a relationship label', () => {
    expect(data.relationships.find((rel) => rel.from === 'c2')?.label).toBe(
      'Calls isAuthenticated() on'
    )
  })

  it('keeps a SQL-looking label intact', () => {
    expect(data.relationships.find((rel) => rel.from === 'c3')).toMatchObject({
      label: 'select * from users where username = ?',
      technology: 'JDBC',
    })
  })

  it('orders relationships by declaration', () => {
    expect(data.relationships.map((rel) => rel.from)).toEqual([
      'c1',
      'c2',
      'c3',
    ])
  })
})

describe('C4Deployment example specifics', () => {
  const data = parseC4Diagram(C4_DEPLOYMENT_EXAMPLE)

  it('turns every Deployment_Node into a boundary, not a shape', () => {
    expect(data.boundaries).toHaveLength(12)
    expect(data.boundaries.every((boundary) => boundary.kind === 'node')).toBe(
      true
    )
    expect(data.elements.every((el) => el.kind === 'container')).toBe(true)
  })

  it('reads the node type from the third argument', () => {
    expect(data.boundaries.find((b) => b.id === 'mob')).toMatchObject({
      label: "Customer's mobile device",
      type: 'Apple IOS or Android',
      nodeType: 'node',
    })
  })

  it('nests containers three deep', () => {
    const byId = new Map(data.boundaries.map((b) => [b.id, b]))

    expect(data.elements.find((el) => el.id === 'api')?.parentId).toBe('apache')
    expect(byId.get('apache')?.parentId).toBe('dn')
    expect(byId.get('dn')?.parentId).toBe('plc')
    expect(byId.get('plc')?.parentId).toBeUndefined()
  })

  it('splits a node type on its <br/>', () => {
    expect(data.boundaries.find((b) => b.id === 'browser')?.type).toBe(
      'Google Chrome, Mozilla Firefox,\n Apple Safari or Microsoft Edge'
    )
  })

  it('sizes an outer node larger than the node it contains', () => {
    const flow = convertC4MermaidToReactFlow(C4_DEPLOYMENT_EXAMPLE)
    const byId = new Map(flow.nodes.map((node) => [node.id, node]))

    expect(byId.get('plc')!.style!.height as number).toBeGreaterThan(
      byId.get('dn')!.style!.height as number
    )
    expect(byId.get('dn')!.style!.height as number).toBeGreaterThan(
      byId.get('apache')!.style!.height as number
    )
  })

  it('honours the Rel_U and Rel_R side hints', () => {
    const flow = convertC4MermaidToReactFlow(C4_DEPLOYMENT_EXAMPLE)
    const up = flow.edges.find((edge) => edge.source === 'web')!
    const right = flow.edges.find((edge) => edge.source === 'db')!

    expect(up).toMatchObject({
      sourceHandle: 'source-top',
      targetHandle: 'target-bottom',
    })
    expect(right).toMatchObject({
      sourceHandle: 'source-right',
      targetHandle: 'target-left',
    })
  })
})
