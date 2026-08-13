import { Edge, Node } from '@xyflow/react'
import { describe, expect, it } from 'vitest'
import { CustomData } from '../../types/rf'
import {
  convertReactFlowToC4Mermaid,
  convertReactFlowToC4UiGraph,
  isC4ReactFlowDiagram,
} from '../c4-diagram/from-react-flow'
import { parseC4Diagram } from '../c4-diagram/parser'
import { convertC4ToReactFlow } from '../c4-diagram/to-react-flow'
import { convertMermaidToReactFlowWithContext } from '../context/convert-with-context'
import canvases from './fixtures/c4-canvases.json'

/**
 * Every C4 diagram in the example workspace, exactly as the canvas saved it.
 * The mermaid these produce is the real export path, so a defect in any slot,
 * keyword or fallback shows up here on the diagram that uses it.
 */
const savedCanvases = Object.entries(canvases).map(([name, canvas]) => ({
  name,
  nodes: canvas.nodes as unknown as Node<CustomData>[],
  edges: canvas.edges as unknown as Edge<CustomData>[],
}))

function nodeName(node: Node<CustomData>): string {
  const field = node.data.componentFields?.find(
    (candidate) => candidate.componentFieldId === 'name'
  )
  const values = field?.data as Array<{ value: string }>

  return values[0].value
}

function relationshipLabel(edge: Edge<CustomData>): string {
  const label = edge.label as string
  const technology = edge.data?.c4RelTechnology

  if (!technology) return label

  return label.slice(0, -` [${technology}]`.length)
}

describe.each(savedCanvases)('$name', ({ nodes, edges }) => {
  const mermaid = convertReactFlowToC4Mermaid(nodes, edges)
  const parsed = parseC4Diagram(mermaid)

  const elementNodes = nodes.filter((node) => node.type === 'c4')
  const boundaryNodes = nodes.filter((node) => node.type === 'c4Boundary')

  it('is recognised as a C4 canvas and emits every node', () => {
    expect(isC4ReactFlowDiagram(nodes)).toBe(true)
    expect(elementNodes.length + boundaryNodes.length).toBe(nodes.length)
    expect(parsed.elements).toHaveLength(elementNodes.length)
    expect(parsed.boundaries).toHaveLength(boundaryNodes.length)
    expect(parsed.relationships).toHaveLength(edges.length)
  })

  it('keeps the diagram type', () => {
    expect(parsed.type).toBe(nodes[0].data.c4DiagramType)
  })

  it('keeps every element with its name, kind, shape, technology and description', () => {
    for (const node of elementNodes) {
      const element = parsed.elements.find((entry) => entry.id === node.id)

      expect(element).toBeDefined()
      expect(element).toMatchObject({
        label: nodeName(node),
        kind: node.data.c4Kind,
        shape: node.data.c4Shape,
        isExternal: node.data.isExternal === true,
        parentId: node.parentId,
      })
      expect(element?.technology).toBe(node.data.technology)
      expect(element?.description).toBe(node.data.description)
    }
  })

  it('keeps every boundary with its name, kind, type, node type and nesting', () => {
    for (const node of boundaryNodes) {
      const boundary = parsed.boundaries.find((entry) => entry.id === node.id)

      expect(boundary).toBeDefined()
      expect(boundary).toMatchObject({
        label: nodeName(node),
        kind: node.data.c4BoundaryKind,
        type: node.data.boundaryType,
        parentId: node.parentId,
      })
      expect(boundary?.nodeType).toBe(node.data.c4NodeType)
      expect(boundary?.description).toBe(node.data.description)
    }
  })

  it('keeps every relationship with its label, technology, description and direction', () => {
    for (const edge of edges) {
      const isBack = edge.data?.c4RelDirection === 'back'
      const relationship = parsed.relationships.find(
        (entry) =>
          entry.from === (isBack ? edge.target : edge.source) &&
          entry.to === (isBack ? edge.source : edge.target)
      )

      expect(relationship).toBeDefined()
      expect(relationship).toMatchObject({
        label: relationshipLabel(edge),
        direction: edge.data?.c4RelDirection,
      })
      expect(relationship?.technology).toBe(edge.data?.c4RelTechnology)
      expect(relationship?.description).toBe(edge.data?.c4RelDescription)
    }
  })

  it('is stable across a second trip through the canvas', () => {
    const reimported = convertC4ToReactFlow(parsed)

    expect(
      convertReactFlowToC4Mermaid(reimported.nodes, reimported.edges)
    ).toBe(mermaid)
  })

  it('restores every position, size and parent from the exported context', async () => {
    const exported = convertReactFlowToC4UiGraph(nodes, edges)
    const reimported = await convertMermaidToReactFlowWithContext(
      exported.mermaid,
      exported.context,
      { repositionNodes: true }
    )

    expect(reimported.edges).toHaveLength(edges.length)

    for (const node of nodes) {
      const restored = reimported.nodes.find((entry) => entry.id === node.id)

      expect(restored).toBeDefined()
      expect(restored?.position).toEqual(node.position)
      expect(restored?.parentId).toBe(node.parentId)
      expect(restored?.width).toBe(node.width)
      expect(restored?.height).toBe(node.height)
    }
  })
})

describe('the saved canvases as a corpus', () => {
  const keywords = new Set<string>()

  for (const { nodes, edges } of savedCanvases) {
    for (const line of convertReactFlowToC4Mermaid(nodes, edges).split('\n')) {
      const match = /^\s*([A-Za-z_]+)\(/.exec(line)
      if (match) keywords.add(match[1])
    }
  }

  it('covers every element keyword the exporter can emit', () => {
    expect(
      [...keywords].filter((keyword) => keyword.startsWith('Person'))
    ).toEqual(expect.arrayContaining(['Person', 'Person_Ext']))

    for (const kind of ['System', 'Container', 'Component']) {
      expect([...keywords]).toEqual(
        expect.arrayContaining([
          kind,
          `${kind}_Ext`,
          `${kind}Db`,
          `${kind}Db_Ext`,
          `${kind}Queue`,
          `${kind}Queue_Ext`,
        ])
      )
    }
  })

  it('covers every boundary keyword the exporter can emit', () => {
    expect([...keywords]).toEqual(
      expect.arrayContaining([
        'Boundary',
        'Enterprise_Boundary',
        'System_Boundary',
        'Container_Boundary',
        'Deployment_Node',
        'Node_L',
        'Node_R',
      ])
    )
  })

  it('covers every relationship keyword the exporter can emit', () => {
    expect([...keywords]).toEqual(
      expect.arrayContaining([
        'Rel',
        'BiRel',
        'Rel_Back',
        'Rel_U',
        'Rel_D',
        'Rel_L',
        'Rel_R',
      ])
    )
  })
})

describe('a C4 canvas the user has rearranged', () => {
  const shapes = savedCanvases.find(
    (canvas) => canvas.name === 'Context All Shapes'
  )!

  it('still declares a node that was put inside a group', () => {
    const nodes: Node<CustomData>[] = [
      {
        id: 'group-1',
        type: 'group',
        position: { x: 0, y: 0 },
        data: { childNodes: ['personExt'] },
      },
      ...shapes.nodes.map((node) => {
        if (node.id !== 'personExt') return node

        return { ...node, parentId: 'group-1' }
      }),
    ]

    const parsed = parseC4Diagram(
      convertReactFlowToC4Mermaid(nodes, shapes.edges)
    )

    expect(parsed.elements.map((element) => element.id)).toContain('personExt')
    expect(
      parsed.elements.find((element) => element.id === 'personExt')?.parentId
    ).toBeUndefined()

    for (const relationship of parsed.relationships) {
      expect(parsed.elements.map((element) => element.id)).toContain(
        relationship.from
      )
      expect(parsed.elements.map((element) => element.id)).toContain(
        relationship.to
      )
    }
  })
})

describe('parallel relationships between the same pair', () => {
  const styled = savedCanvases.find(
    (canvas) => canvas.name === 'Container Styled'
  )!

  it('keeps both of them in the mermaid', () => {
    const parsed = parseC4Diagram(
      convertReactFlowToC4Mermaid(styled.nodes, styled.edges)
    )

    expect(parsed.relationships).toHaveLength(styled.edges.length)
    expect(parsed.relationships).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          from: 'api',
          to: 'db',
          label: 'Reads from and writes to',
        }),
        expect.objectContaining({
          from: 'db',
          to: 'api',
          label: 'Returns rows to',
          direction: 'back',
        }),
      ])
    )
  })

  it('gives each of them its own styling in the context sidecar', async () => {
    const exported = convertReactFlowToC4UiGraph(styled.nodes, styled.edges)
    const reimported = await convertMermaidToReactFlowWithContext(
      exported.mermaid,
      exported.context,
      { repositionNodes: true }
    )

    expect(Object.keys(exported.context.edges ?? {})).toHaveLength(
      styled.edges.length
    )

    for (const edge of styled.edges) {
      const restored = reimported.edges.find((entry) => entry.id === edge.id)

      expect(restored?.style?.stroke).toBe(edge.style?.stroke)
    }
  })
})
