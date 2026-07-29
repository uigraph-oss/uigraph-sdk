import { Edge, MarkerType, Node } from '@xyflow/react'
import { generateComponentFieldNameInput } from '../components/component-field'
import {
  C4DiagramData,
  C4Element,
  C4ElementStyle,
  C4RelDirection,
} from '../types/c4'
import { ReactFlowData } from '../types/rf'
import { parseC4Diagram } from './c4-parser'

/** Mirrors mermaid's `c4` config block so imports land at a familiar scale. */
export const C4_LAYOUT = {
  WIDTH: 240,
  MIN_HEIGHT: 80,
  SHAPE_MARGIN: 90,
  ROW_MARGIN: 80,
  SHAPE_PADDING: 24,
  BOUNDARY_HEADER: 72,
  BOUNDARY_PADDING: 48,
  BOUNDARY_MARGIN: 60,
  DIAGRAM_MARGIN_X: 60,
  DIAGRAM_MARGIN_Y: 40,
}

export const C4_COLORS = {
  person: { fill: '#08427B', stroke: '#052E56' },
  personExternal: { fill: '#686868', stroke: '#4D4D4D' },
  system: { fill: '#1168BD', stroke: '#0B4884' },
  systemExternal: { fill: '#999999', stroke: '#6B6B6B' },
  container: { fill: '#438DD5', stroke: '#2E6295' },
  containerExternal: { fill: '#B3B3B3', stroke: '#8A8A8A' },
  component: { fill: '#85BBF0', stroke: '#5D82A8' },
  componentExternal: { fill: '#CCCCCC', stroke: '#A6A6A6' },
  node: { fill: '#1F2937', stroke: '#4B5563' },
  nodeExternal: { fill: '#374151', stroke: '#6B7280' },
}

const BOUNDARY_BORDER = '#828DA3'

export function getC4ElementColors(element: C4Element) {
  const key = element.isExternal
    ? (`${element.kind}External` as keyof typeof C4_COLORS)
    : (element.kind as keyof typeof C4_COLORS)

  return C4_COLORS[key] ?? C4_COLORS.system
}

type Box = { width: number; height: number }
type Placement = { x: number; y: number; width: number; height: number }

const NAME_LINE_HEIGHT = 22
const SMALL_LINE_HEIGHT = 18
const PERSON_GLYPH = 30
/** The cylinder's top and bottom ellipses eat into the usable text band. */
const CYLINDER_LIPS = 34
/** The queue's rounded caps do the same horizontally. */
const QUEUE_CAPS = 68

function wrappedLines(
  text: string | undefined,
  usableWidth: number,
  charWidth: number
): number {
  if (!text) return 0

  const charsPerLine = Math.max(6, Math.floor(usableWidth / charWidth))

  return text
    .split('\n')
    .reduce(
      (total, line) =>
        total + Math.max(1, Math.ceil(line.length / charsPerLine)),
      0
    )
}

/**
 * Shapes keep a fixed width and grow vertically to fit the stereotype, name,
 * technology and description stack. Widths are deliberately generous — a shape
 * that under-measures clips its text, which is far worse than extra whitespace.
 */
function measureElement(element: C4Element): Box {
  let usableWidth = C4_LAYOUT.WIDTH - C4_LAYOUT.SHAPE_PADDING * 2
  if (element.shape === 'queue') usableWidth -= QUEUE_CAPS

  let height = C4_LAYOUT.SHAPE_PADDING * 2
  height += SMALL_LINE_HEIGHT
  if (element.kind === 'person') height += PERSON_GLYPH
  height += wrappedLines(element.label, usableWidth, 8.6) * NAME_LINE_HEIGHT
  if (element.technology) height += SMALL_LINE_HEIGHT
  height +=
    wrappedLines(element.description, usableWidth, 5.9) * SMALL_LINE_HEIGHT
  if (element.shape === 'db') height += CYLINDER_LIPS

  return {
    width: C4_LAYOUT.WIDTH,
    height: Math.max(C4_LAYOUT.MIN_HEIGHT, height),
  }
}

/**
 * Lays out one container the way mermaid's C4 renderer does: shapes flow into
 * rows of `c4ShapeInRow`, then nested boundaries flow below in rows of
 * `c4BoundaryInRow`. Child boundaries are measured bottom-up first.
 */
function layoutContainer(
  containerId: string | undefined,
  data: C4DiagramData,
  childrenOf: Map<string | undefined, string[]>,
  elementById: Map<string, C4Element>,
  placements: Map<string, Placement>
): Box {
  const childIds = childrenOf.get(containerId) ?? []

  const shapeIds = childIds.filter((id) => elementById.has(id))
  const boundaryIds = childIds.filter((id) => !elementById.has(id))

  const originX = containerId
    ? C4_LAYOUT.BOUNDARY_PADDING
    : C4_LAYOUT.DIAGRAM_MARGIN_X
  const originY = containerId
    ? C4_LAYOUT.BOUNDARY_HEADER
    : C4_LAYOUT.DIAGRAM_MARGIN_Y

  let cursorY = originY
  let maxX = originX
  let lastMargin = 0

  // Shapes: fixed-width columns, row height driven by the tallest shape.
  const perRow = Math.max(1, data.layout.c4ShapeInRow)
  for (let index = 0; index < shapeIds.length; index += perRow) {
    const row = shapeIds.slice(index, index + perRow)
    let rowHeight = 0

    row.forEach((id, column) => {
      const size = measureElement(elementById.get(id)!)
      const x = originX + column * (C4_LAYOUT.WIDTH + C4_LAYOUT.SHAPE_MARGIN)

      placements.set(id, {
        x,
        y: cursorY,
        width: size.width,
        height: size.height,
      })
      rowHeight = Math.max(rowHeight, size.height)
      maxX = Math.max(maxX, x + size.width)
    })

    cursorY += rowHeight + C4_LAYOUT.ROW_MARGIN
    lastMargin = C4_LAYOUT.ROW_MARGIN
  }

  // Boundaries: measured first, then packed into rows of variable width.
  const boundarySizes = new Map<string, Box>()
  for (const id of boundaryIds) {
    boundarySizes.set(
      id,
      layoutContainer(id, data, childrenOf, elementById, placements)
    )
  }

  const boundariesPerRow = Math.max(1, data.layout.c4BoundaryInRow)
  for (let index = 0; index < boundaryIds.length; index += boundariesPerRow) {
    const row = boundaryIds.slice(index, index + boundariesPerRow)
    let rowHeight = 0
    let cursorX = originX

    for (const id of row) {
      const size = boundarySizes.get(id)!

      placements.set(id, {
        x: cursorX,
        y: cursorY,
        width: size.width,
        height: size.height,
      })

      cursorX += size.width + C4_LAYOUT.BOUNDARY_MARGIN
      rowHeight = Math.max(rowHeight, size.height)
      maxX = Math.max(maxX, cursorX - C4_LAYOUT.BOUNDARY_MARGIN)
    }

    cursorY += rowHeight + C4_LAYOUT.BOUNDARY_MARGIN
    lastMargin = C4_LAYOUT.BOUNDARY_MARGIN
  }

  const hasChildren = shapeIds.length > 0 || boundaryIds.length > 0
  const trailing = containerId
    ? C4_LAYOUT.BOUNDARY_PADDING
    : C4_LAYOUT.DIAGRAM_MARGIN_Y

  if (!hasChildren) {
    return {
      width: C4_LAYOUT.WIDTH + originX + trailing,
      height: C4_LAYOUT.MIN_HEIGHT + originY + trailing,
    }
  }

  return {
    width: maxX + originX,
    // The last row already appended a full margin; swap it for the padding.
    height: cursorY - lastMargin + trailing,
  }
}

type Side = 'top' | 'bottom' | 'left' | 'right'

/**
 * Mermaid's `Rel_U/D/L/R` pin a side; everything else picks the pair of handles
 * facing each other so straight lines never cut back through a shape.
 */
function resolveSide(
  direction: C4RelDirection,
  from: { x: number; y: number },
  to: { x: number; y: number }
): { source: Side; target: Side } {
  if (direction === 'up') return { source: 'top', target: 'bottom' }
  if (direction === 'down') return { source: 'bottom', target: 'top' }
  if (direction === 'left') return { source: 'left', target: 'right' }
  if (direction === 'right') return { source: 'right', target: 'left' }

  const dx = to.x - from.x
  const dy = to.y - from.y

  if (Math.abs(dx) > Math.abs(dy)) {
    if (dx >= 0) return { source: 'right', target: 'left' }
    return { source: 'left', target: 'right' }
  }

  if (dy >= 0) return { source: 'bottom', target: 'top' }
  return { source: 'top', target: 'bottom' }
}

/** `UpdateElementStyle` overrides win over the canonical C4 palette. */
function applyElementStyle(
  base: { fill: string; stroke: string },
  style: C4ElementStyle | undefined
) {
  return {
    fill: style?.bgColor ?? base.fill,
    stroke: style?.borderColor ?? base.stroke,
    fontColor: style?.fontColor,
  }
}

export function convertC4ToReactFlow(data: C4DiagramData): ReactFlowData {
  const elementById = new Map(data.elements.map((el) => [el.id, el]))
  const boundaryById = new Map(data.boundaries.map((b) => [b.id, b]))

  const childrenOf = new Map<string | undefined, string[]>()

  function attach(id: string, parentId: string | undefined) {
    const siblings = childrenOf.get(parentId) ?? []
    siblings.push(id)
    childrenOf.set(parentId, siblings)
  }

  for (const boundary of data.boundaries) attach(boundary.id, boundary.parentId)
  for (const element of data.elements) attach(element.id, element.parentId)

  const placements = new Map<string, Placement>()
  layoutContainer(undefined, data, childrenOf, elementById, placements)

  const nodes: Node[] = []

  // Boundaries first so React Flow paints them behind their children.
  for (const boundary of data.boundaries) {
    const placement = placements.get(boundary.id)
    if (!placement) continue

    // Mermaid's `UpdateElementStyle` resolves against boundaries too.
    const style =
      data.boundaryStyles[boundary.id] ?? data.elementStyles[boundary.id]

    nodes.push({
      id: boundary.id,
      type: 'c4Boundary',
      position: { x: placement.x, y: placement.y },
      data: {
        source: 'mermaid',
        c4BoundaryKind: boundary.kind,
        boundaryType: boundary.type,
        description: boundary.description,
        c4NodeType: boundary.nodeType,
        link: boundary.link,
        backgroundColor: style?.bgColor ?? 'transparent',
        borderColor: style?.borderColor ?? BOUNDARY_BORDER,
        fontColor: style?.fontColor,
        componentFields: [generateComponentFieldNameInput(boundary.label)],
      },
      style: {
        width: placement.width,
        height: placement.height,
      },
      width: placement.width,
      height: placement.height,
      parentId: boundary.parentId,
      extent: boundary.parentId ? 'parent' : undefined,
      selectable: true,
      draggable: true,
    })
  }

  for (const element of data.elements) {
    const placement = placements.get(element.id)
    if (!placement) continue

    const colors = applyElementStyle(
      getC4ElementColors(element),
      data.elementStyles[element.id]
    )

    nodes.push({
      id: element.id,
      type: element.subDiagramId ? 'subDiagram' : 'c4',
      position: { x: placement.x, y: placement.y },
      width: placement.width,
      height: placement.height,
      data: {
        source: 'mermaid',
        diagramId: element.subDiagramId,
        diagramName: element.label,
        c4Kind: element.kind,
        c4Shape: element.shape,
        isExternal: element.isExternal,
        technology: element.technology,
        description: element.description,
        link: element.link,
        fill: colors.fill,
        stroke: colors.stroke,
        fontColor: colors.fontColor,
        componentFields: [generateComponentFieldNameInput(element.label)],
      },
      style: { width: placement.width, height: placement.height },
      parentId: element.parentId,
      extent: element.parentId ? 'parent' : undefined,
    })
  }

  const parentOf = new Map<string, string | undefined>()
  for (const boundary of data.boundaries) {
    parentOf.set(boundary.id, boundary.parentId)
  }
  for (const element of data.elements)
    parentOf.set(element.id, element.parentId)

  /** Placements are parent-relative, so walk up to compare across boundaries. */
  function absoluteCenter(id: string) {
    const placement = placements.get(id)!
    let x = placement.x + placement.width / 2
    let y = placement.y + placement.height / 2
    let parentId = parentOf.get(id)

    while (parentId) {
      const parent = placements.get(parentId)!
      x += parent.x
      y += parent.y
      parentId = parentOf.get(parentId)
    }

    return { x, y }
  }

  const edges: Edge[] = data.relationships
    .filter(
      (rel) =>
        (elementById.has(rel.from) || boundaryById.has(rel.from)) &&
        (elementById.has(rel.to) || boundaryById.has(rel.to))
    )
    .map((rel) => {
      const isBack = rel.direction === 'back'
      const source = isBack ? rel.to : rel.from
      const target = isBack ? rel.from : rel.to
      const style = data.relStyles[`${rel.from}->${rel.to}`]

      const lineColor = style?.lineColor ?? BOUNDARY_BORDER
      const label = [rel.label, rel.technology ? `[${rel.technology}]` : '']
        .filter(Boolean)
        .join(' ')

      const side = resolveSide(
        rel.direction,
        absoluteCenter(source),
        absoluteCenter(target)
      )

      return {
        id: `c4-rel-${rel.from}-${rel.to}-${rel.index}`,
        source,
        target,
        sourceHandle: `source-${side.source}`,
        targetHandle: `target-${side.target}`,
        label,
        type: 'simplebezier',
        style: { stroke: lineColor, strokeWidth: style?.lineWidth ?? 1.5 },
        data: {
          source: 'mermaid',
          labelColor: style?.textColor,
          labelOffsetX: style?.offsetX,
          labelOffsetY: style?.offsetY,
        },
        // An explicit color keeps React Flow from generating a black marker.
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 14,
          height: 14,
          color: lineColor,
        },
        markerStart:
          rel.direction === 'bi'
            ? {
                type: MarkerType.ArrowClosed,
                width: 14,
                height: 14,
                color: lineColor,
              }
            : undefined,
      }
    })

  return { nodes, edges }
}

export function convertC4MermaidToReactFlow(code: string): ReactFlowData {
  return convertC4ToReactFlow(parseC4Diagram(code))
}
