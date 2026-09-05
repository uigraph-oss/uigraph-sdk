export const SHAPE_IDS = [
  'rectangle',
  'rounded-rect',
  'ellipse',
  'diamond',
  'triangle',
  'parallelogram',
  'trapezoid',
  'hexagon',
  'document',
  'cylinder',
  'delay',
  'off-page-connector',
  'display',
  'collate',
  'sort',
  'terminator',
  'or',
  'database',
  'multiple-documents',
  'subroutine',
  'manual-input',
  'summing-junction',
  'internal-storage',
] as const

export type ShapeId = (typeof SHAPE_IDS)[number]

export const STROKE_STYLES = ['solid', 'dashed', 'dotted'] as const

export type StrokeStyleId = (typeof STROKE_STYLES)[number]

export type DiagramTypeId = 'flowchart' | 'sequence' | 'c4'

/** Style fields a beautify-style patch may carry, independent of node tag. */
export type NodeStylePatchInput = {
  fill?: string
  stroke?: string
  strokeWidth?: number
  strokeStyle?: StrokeStyleId
  cornerRadius?: number
  textColor?: string
  textFontSize?: number
  shape?: ShapeId
}

export type NodeTypeSpec = {
  tag: string
  diagramTypes: DiagramTypeId[]
  isContainer: boolean
  /** Whether AI/beautify is allowed to resize this node type directly. */
  geometryEditable: boolean
  /** Valid `data.shape` values for this tag, if it supports shapes. */
  shapes?: readonly ShapeId[]
  /** Maps a generic style patch onto this node type's own `data` field names. */
  mapStylePatch: (patch: NodeStylePatchInput) => Record<string, unknown>
}

function clampNum(
  value: number | undefined,
  min: number,
  max: number
): number | undefined {
  if (value === undefined || !Number.isFinite(value)) return undefined
  return Math.min(max, Math.max(min, value))
}

function dropUndefined(
  input: Record<string, unknown>
): Record<string, unknown> {
  const output: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue
    output[key] = value
  }
  return output
}

function mapShapeStylePatch(patch: NodeStylePatchInput) {
  return dropUndefined({
    fill: patch.fill,
    stroke: patch.stroke,
    strokeWidth: clampNum(patch.strokeWidth, 0, 10),
    strokeStyle: patch.strokeStyle,
    cornerRadius: clampNum(patch.cornerRadius, 0, 64),
    textColor: patch.textColor,
    textFontSize: clampNum(patch.textFontSize, 8, 48),
    shape: patch.shape,
  })
}

function mapCloudStylePatch(patch: NodeStylePatchInput) {
  return dropUndefined({
    fill: patch.fill,
    stroke: patch.stroke,
    strokeWidth: clampNum(patch.strokeWidth, 0, 10),
    strokeStyle: patch.strokeStyle,
  })
}

function mapTextStylePatch(patch: NodeStylePatchInput) {
  return dropUndefined({
    fill: patch.fill,
    stroke: patch.stroke,
    strokeWidth: clampNum(patch.strokeWidth, 0, 10),
    strokeStyle: patch.strokeStyle,
    borderRadius: clampNum(patch.cornerRadius, 0, 64),
    color: patch.textColor,
    fontSize: clampNum(patch.textFontSize, 8, 48),
  })
}

function mapGroupStylePatch(patch: NodeStylePatchInput) {
  return dropUndefined({
    backgroundColor: patch.fill,
    borderColor: patch.stroke,
  })
}

function mapC4StylePatch(patch: NodeStylePatchInput) {
  return dropUndefined({
    fill: patch.fill,
    stroke: patch.stroke,
    fontColor: patch.textColor,
  })
}

function mapC4BoundaryStylePatch(patch: NodeStylePatchInput) {
  return dropUndefined({
    backgroundColor: patch.fill,
    borderColor: patch.stroke,
    fontColor: patch.textColor,
  })
}

function mapSequenceParticipantStylePatch(patch: NodeStylePatchInput) {
  return dropUndefined({
    color: patch.stroke,
    textColor: patch.textColor,
  })
}

/**
 * Canonical per-node-tag registry, shared by generate, beautify, and (later)
 * MCP tools, so node-type vocabulary and style-field mapping live in exactly
 * one place instead of being re-declared per consumer.
 */
export const NODE_TYPE_REGISTRY: Record<string, NodeTypeSpec> = {
  shape: {
    tag: 'shape',
    diagramTypes: ['flowchart'],
    isContainer: false,
    geometryEditable: true,
    shapes: SHAPE_IDS,
    mapStylePatch: mapShapeStylePatch,
  },
  default: {
    tag: 'default',
    diagramTypes: ['flowchart'],
    isContainer: false,
    geometryEditable: true,
    shapes: SHAPE_IDS,
    mapStylePatch: mapShapeStylePatch,
  },
  cloud: {
    tag: 'cloud',
    diagramTypes: ['flowchart'],
    isContainer: false,
    geometryEditable: true,
    mapStylePatch: mapCloudStylePatch,
  },
  text: {
    tag: 'text',
    diagramTypes: ['flowchart'],
    isContainer: false,
    geometryEditable: true,
    mapStylePatch: mapTextStylePatch,
  },
  group: {
    tag: 'group',
    diagramTypes: ['flowchart'],
    isContainer: true,
    geometryEditable: false,
    mapStylePatch: mapGroupStylePatch,
  },
  c4: {
    tag: 'c4',
    diagramTypes: ['c4'],
    isContainer: false,
    geometryEditable: true,
    mapStylePatch: mapC4StylePatch,
  },
  c4Boundary: {
    tag: 'c4Boundary',
    diagramTypes: ['c4'],
    isContainer: true,
    geometryEditable: false,
    mapStylePatch: mapC4BoundaryStylePatch,
  },
  sequenceParticipant: {
    tag: 'sequenceParticipant',
    diagramTypes: ['sequence'],
    isContainer: false,
    geometryEditable: false,
    mapStylePatch: mapSequenceParticipantStylePatch,
  },
}

export function getNodeTypeSpec(
  type: string | undefined
): NodeTypeSpec | undefined {
  if (type === undefined) return undefined
  return NODE_TYPE_REGISTRY[type]
}

/** Replaces the old per-route `buildNodeDataPatch` switch statement. */
export function buildNodeStyleDataPatch(
  type: string | undefined,
  patch: NodeStylePatchInput
): Record<string, unknown> {
  return getNodeTypeSpec(type)?.mapStylePatch(patch) ?? {}
}

export function isGeometryEditableNodeType(type: string | undefined): boolean {
  return getNodeTypeSpec(type)?.geometryEditable ?? false
}
