import { Edge, Node } from '@xyflow/react'
import {
  C4BoundaryKind,
  C4DiagramType,
  C4ElementKind,
  C4ElementShape,
  C4NodeType,
  C4RelDirection,
} from '../../types/c4'
import { CustomData } from '../../types/rf'
import { buildValidatedContext } from '../../uig-converter/context'
import { UigOutput } from '../../uig-converter/types'

/**
 * Turns a C4 diagram on the canvas back into mermaid `C4*` source — the inverse
 * of `convertC4ToReactFlow`, inverting the same argument slots `parseC4Diagram`
 * reads.
 */

function nodeData(node: Node): CustomData {
  return (node.data ?? {}) as CustomData
}

function edgeData(edge: Edge): CustomData {
  return (edge.data ?? {}) as CustomData
}

export function isC4ReactFlowDiagram(nodes: Node[]): boolean {
  return nodes.some((node) => node.type === 'c4' || node.type === 'c4Boundary')
}

function isC4Element(node: Node): boolean {
  if (node.type !== 'c4' && node.type !== 'subDiagram') return false

  const kind = nodeData(node).c4Kind

  return (
    kind === 'person' ||
    kind === 'system' ||
    kind === 'container' ||
    kind === 'component'
  )
}

function isC4Boundary(node: Node): boolean {
  return node.type === 'c4Boundary'
}

/** `unquote` only reverses `\"`, and turns `<br/>` back into a line break. */
function quoteC4Value(value: string): string {
  const encoded = value
    .replace(/"/g, '\\"')
    .replace(/\r\n?/g, '\n')
    .replace(/\n/g, '<br/>')
    .trim()

  return `"${encoded}"`
}

function nodeName(node: Node): string {
  const fields = node.data?.componentFields as
    | Array<{
        componentFieldId?: string
        data?: Array<{ value?: unknown } | undefined | null>
      } | null>
    | undefined

  if (Array.isArray(fields)) {
    const field = fields.find(
      (candidate) => candidate?.componentFieldId === 'name'
    )
    const value = field?.data?.[0]?.value

    if (typeof value === 'string' && value.trim()) return value
  }

  const diagramName = nodeData(node).diagramName
  if (typeof diagramName === 'string' && diagramName) return diagramName

  return node.id
}

function c4ElementKeyword(
  kind: C4ElementKind | undefined,
  shape: C4ElementShape | undefined,
  isExternal: boolean
): string {
  let keyword: string

  if (kind === 'person') keyword = 'Person'
  else if (kind === 'system') keyword = 'System'
  else if (kind === 'container') keyword = 'Container'
  else if (kind === 'component') keyword = 'Component'
  else throw new Error(`Unsupported C4 element kind: ${String(kind)}`)

  if (shape === 'db') keyword += 'Db'
  if (shape === 'queue') keyword += 'Queue'
  if (isExternal) keyword += '_Ext'

  return keyword
}

function c4BoundaryKeyword(
  kind: C4BoundaryKind | undefined,
  nodeType: C4NodeType | undefined
): string {
  if (kind === 'enterprise') return 'Enterprise_Boundary'
  if (kind === 'system') return 'System_Boundary'
  if (kind === 'container') return 'Container_Boundary'

  if (kind === 'node') {
    if (nodeType === 'nodeL') return 'Node_L'
    if (nodeType === 'nodeR') return 'Node_R'
    return 'Deployment_Node'
  }

  return 'Boundary'
}

function c4RelationshipKeyword(direction: C4RelDirection): string {
  if (direction === 'default') return 'Rel'
  if (direction === 'bi') return 'BiRel'
  if (direction === 'back') return 'Rel_Back'
  if (direction === 'up') return 'Rel_U'
  if (direction === 'down') return 'Rel_D'
  if (direction === 'left') return 'Rel_L'
  if (direction === 'right') return 'Rel_R'

  throw new Error(`Unsupported C4 relationship direction: ${String(direction)}`)
}

/**
 * Imported edges carry the parsed direction; edges drawn on the canvas have no
 * mermaid origin, so their handles are the only signal available.
 */
function resolveRelDirection(edge: Edge): C4RelDirection {
  const stored = edgeData(edge).c4RelDirection
  if (stored) return stored

  if (edge.markerStart) return 'bi'
  if (edge.sourceHandle === 'source-top') return 'up'
  if (edge.sourceHandle === 'source-bottom') return 'down'
  if (edge.sourceHandle === 'source-left') return 'left'
  if (edge.sourceHandle === 'source-right') return 'right'

  return 'default'
}

/** `to-react-flow` renders the technology into the label as `label [techn]`. */
function relationshipLabel(edge: Edge, technology: string | undefined): string {
  const label = typeof edge.label === 'string' ? edge.label : ''
  if (!technology) return label

  const suffix = ` [${technology}]`
  if (label.endsWith(suffix)) return label.slice(0, -suffix.length)

  return label
}

function resolveDiagramType(c4Nodes: Node[]): C4DiagramType {
  for (const node of c4Nodes) {
    const stored = nodeData(node).c4DiagramType
    if (stored) return stored
  }

  if (c4Nodes.some((node) => nodeData(node).c4Kind === 'component')) {
    return 'C4Component'
  }

  if (c4Nodes.some((node) => nodeData(node).c4Kind === 'container')) {
    return 'C4Container'
  }

  return 'C4Context'
}

/** An omitted trailing argument reads as absent; an inner one needs its comma. */
function trimTrailingSlots(values: string[], keep: number): string[] {
  const trimmed = [...values]

  while (trimmed.length > keep && trimmed[trimmed.length - 1] === '') {
    trimmed.pop()
  }

  return trimmed
}

function emitC4Mermaid(
  nodes: Node[],
  edges: Edge[]
): { mermaid: string; nodeIdMap: Map<string, string> } {
  const c4Nodes = nodes.filter(
    (node) => isC4Element(node) || isC4Boundary(node)
  )
  const c4NodeIds = new Set(c4Nodes.map((node) => node.id))
  const boundaryIds = new Set(
    c4Nodes.filter((node) => isC4Boundary(node)).map((node) => node.id)
  )

  /**
   * Only a boundary nests its children in the mermaid source. A C4 node
   * parented to anything else — a group node drawn on the canvas — still has to
   * be declared, or the relationships that reference it point at nothing.
   */
  function parentOf(node: Node): string | undefined {
    if (node.parentId && boundaryIds.has(node.parentId)) return node.parentId

    return undefined
  }

  function renderNode(node: Node, indentation: string): string {
    const data = nodeData(node)
    const name = quoteC4Value(nodeName(node))

    if (isC4Element(node)) {
      const values = [node.id, name]

      if (data.c4Kind === 'container' || data.c4Kind === 'component') {
        values.push(data.technology ? quoteC4Value(data.technology) : '')
      }

      values.push(data.description ? quoteC4Value(data.description) : '')

      const trimmed = trimTrailingSlots(values, 2)
      const link = data.diagramId ? `uig:${data.diagramId}` : data.link
      if (link) trimmed.push(`$link=${quoteC4Value(link)}`)

      const keyword = c4ElementKeyword(
        data.c4Kind,
        data.c4Shape,
        data.isExternal === true
      )

      return `${indentation}${keyword}(${trimmed.join(', ')})`
    }

    const keyword = c4BoundaryKeyword(data.c4BoundaryKind, data.c4NodeType)
    const values = [node.id, name]

    if (keyword === 'Boundary' && data.boundaryType) {
      values.push(quoteC4Value(data.boundaryType))
    }

    if (data.c4BoundaryKind === 'node') {
      values.push(
        data.boundaryType ? quoteC4Value(data.boundaryType) : '"node"'
      )
      values.push(data.description ? quoteC4Value(data.description) : '')
    }

    const trimmed = trimTrailingSlots(values, 2)
    if (data.link) trimmed.push(`$link=${quoteC4Value(data.link)}`)

    return `${indentation}${keyword}(${trimmed.join(', ')}) {`
  }

  function renderChildren(
    parentId: string | undefined,
    indentation: string
  ): string[] {
    const lines: string[] = []

    for (const node of c4Nodes) {
      if (parentOf(node) !== parentId) continue

      lines.push(renderNode(node, indentation))

      if (isC4Boundary(node)) {
        lines.push(...renderChildren(node.id, `${indentation}  `))
        lines.push(`${indentation}}`)
      }
    }

    return lines
  }

  const relationships = edges.flatMap((edge) => {
    if (!c4NodeIds.has(edge.source) || !c4NodeIds.has(edge.target)) return []

    const data = edgeData(edge)
    const direction = resolveRelDirection(edge)
    const isBack = direction === 'back'

    const values = [
      isBack ? edge.target : edge.source,
      isBack ? edge.source : edge.target,
      quoteC4Value(relationshipLabel(edge, data.c4RelTechnology)),
      data.c4RelTechnology ? quoteC4Value(data.c4RelTechnology) : '',
      data.c4RelDescription ? quoteC4Value(data.c4RelDescription) : '',
    ]

    return `${c4RelationshipKeyword(direction)}(${trimTrailingSlots(values, 3).join(', ')})`
  })

  const mermaid = [
    resolveDiagramType(c4Nodes),
    ...renderChildren(undefined, ''),
    ...relationships,
  ].join('\n')

  return {
    mermaid,
    nodeIdMap: new Map(c4Nodes.map((node) => [node.id, node.id])),
  }
}

export function convertReactFlowToC4Mermaid(
  nodes: Node[],
  edges: Edge[]
): string {
  return emitC4Mermaid(nodes, edges).mermaid
}

export function convertReactFlowToC4UiGraph(
  nodes: Node[],
  edges: Edge[]
): UigOutput {
  const { mermaid, nodeIdMap } = emitC4Mermaid(nodes, edges)

  return {
    mermaid,
    context: buildValidatedContext(nodes, edges, [], nodeIdMap),
  }
}
