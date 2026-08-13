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
import canvas from './fixtures/fraud-detection-canvas.json'

const nodes = canvas.nodes as unknown as Node<CustomData>[]
const edges = canvas.edges as unknown as Edge<CustomData>[]

const elementNodes = nodes.filter((node) => node.type === 'c4')
const boundaryNodes = nodes.filter((node) => node.type === 'c4Boundary')

function nodeName(node: Node<CustomData>): string {
  const field = node.data.componentFields?.find(
    (candidate) => candidate.componentFieldId === 'name'
  )
  const values = field?.data as Array<{ value: string }>

  return values[0].value
}

describe('a C4 component diagram saved from the canvas', () => {
  const mermaid = convertReactFlowToC4Mermaid(nodes, edges)
  const parsed = parseC4Diagram(mermaid)

  it('is recognised as a C4 canvas', () => {
    expect(isC4ReactFlowDiagram(nodes)).toBe(true)
    expect(elementNodes).toHaveLength(22)
    expect(boundaryNodes).toHaveLength(1)
    expect(edges).toHaveLength(28)
  })

  it('keeps the diagram type', () => {
    expect(parsed.type).toBe('C4Component')
  })

  it('keeps the container boundary and every component nested inside it', () => {
    expect(mermaid).toContain(
      'Container_Boundary(engine, "Fraud Detection Engine") {'
    )

    expect(parsed.boundaries).toHaveLength(1)
    expect(parsed.boundaries[0]).toMatchObject({
      id: 'engine',
      label: 'Fraud Detection Engine',
      kind: 'container',
      parentId: undefined,
    })

    const nested = parsed.elements.filter(
      (element) => element.parentId === 'engine'
    )

    expect(nested.map((element) => element.id).sort()).toEqual(
      elementNodes
        .filter((node) => node.parentId === 'engine')
        .map((node) => node.id)
        .sort()
    )
    expect(nested).toHaveLength(13)
  })

  it('keeps every element with its name, kind, shape, technology and description', () => {
    expect(parsed.elements.map((element) => element.id).sort()).toEqual(
      elementNodes.map((node) => node.id).sort()
    )

    for (const node of elementNodes) {
      const element = parsed.elements.find((entry) => entry.id === node.id)

      expect(element).toBeDefined()
      expect(element).toMatchObject({
        label: nodeName(node),
        kind: node.data.c4Kind,
        shape: node.data.c4Shape,
        isExternal: node.data.isExternal,
        parentId: node.parentId,
      })
      expect(element?.technology).toBe(node.data.technology)
      expect(element?.description).toBe(node.data.description)
    }
  })

  it('emits the shape and external keyword suffixes', () => {
    expect(mermaid).toContain('Person(analyst, "Fraud Analyst"')
    expect(mermaid).toContain('Person_Ext(dataScientist, "Data Scientist"')
    expect(mermaid).toContain(
      'System_Ext(deviceIntel, "Device Intelligence Provider"'
    )
    expect(mermaid).toContain(
      'ContainerQueue(transactionStream, "Transaction Stream", "Kafka"'
    )
    expect(mermaid).toContain(
      'ContainerDb(featureStore, "Feature Store", "Redis and Cassandra"'
    )
    expect(mermaid).toContain(
      'ComponentDb(entityGraph, "Entity Graph", "JanusGraph"'
    )
    expect(mermaid).toContain(
      'ComponentQueue(decisionLog, "Decision Log", "Kafka"'
    )
  })

  it('splits the technology back out of the fused canvas label', () => {
    expect(mermaid).toContain(
      'Rel(authorisationApi, ingestGateway, "Requests a decision from", "gRPC")'
    )
    expect(mermaid).toContain(
      'Rel(ingestGateway, featureResolver, "Requests the feature vector from")'
    )
    expect(mermaid).not.toContain('[gRPC]')
  })

  it('keeps every relationship with its label, technology and direction', () => {
    expect(parsed.relationships).toHaveLength(edges.length)

    for (const edge of edges) {
      const relationship = parsed.relationships.find(
        (entry) => entry.from === edge.source && entry.to === edge.target
      )

      const technology = edge.data?.c4RelTechnology
      const label = edge.label as string
      const expectedLabel = technology
        ? label.slice(0, -` [${technology}]`.length)
        : label

      expect(relationship).toBeDefined()
      expect(relationship).toMatchObject({
        label: expectedLabel,
        direction: edge.data?.c4RelDirection,
      })
      expect(relationship?.technology).toBe(technology)
    }
  })

  it('keeps the one relationship that was redirected on the canvas', () => {
    expect(mermaid).toContain(
      'Rel_U(shadowRunner, dataScientist, "Reports candidate performance to", "HTTPS")'
    )
  })

  it('is stable across a second trip back through the canvas', () => {
    const reimported = convertC4ToReactFlow(parsed)

    expect(
      convertReactFlowToC4Mermaid(reimported.nodes, reimported.edges)
    ).toBe(mermaid)
  })

  it('restores every node position and parent from the exported context', async () => {
    const exported = convertReactFlowToC4UiGraph(nodes, edges)
    const reimported = await convertMermaidToReactFlowWithContext(
      exported.mermaid,
      exported.context,
      { repositionNodes: true }
    )

    for (const node of nodes) {
      const restored = reimported.nodes.find((entry) => entry.id === node.id)

      expect(restored).toBeDefined()
      expect(restored?.position).toEqual(node.position)
      expect(restored?.parentId).toBe(node.parentId)
    }
  })
})
