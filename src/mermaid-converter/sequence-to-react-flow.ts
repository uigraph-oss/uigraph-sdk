import { Edge, MarkerType, Node } from '@xyflow/react'
import {
  generateComponentFieldInput,
  generateComponentFieldNameInput,
} from '../components/component-field'
import { ComponentInputType } from '../components/component-type'
import {
  ReactFlowData,
  SequenceBlock,
  SequenceDiagramData,
  SequenceMessage,
  SequenceNote,
} from '../types'
import { SEQUENCE_LAYOUT, SEQUENCE_PARTICIPANT_COLOR } from './constants/layout'
import { estimateSequenceMessageBoxSize } from './sequence-layout'
import { parseSequenceDiagram } from './sequence-parser'

const BLOCK_STYLES: Record<string, { border: string; background: string }> = {
  loop: { border: '#64748B', background: 'rgba(100, 116, 139, 0.06)' },
  alt: { border: '#6366F1', background: 'rgba(99, 102, 241, 0.06)' },
  opt: { border: '#0EA5E9', background: 'rgba(14, 165, 233, 0.06)' },
  par: { border: '#22C55E', background: 'rgba(34, 197, 94, 0.06)' },
  critical: { border: '#F97316', background: 'rgba(249, 115, 22, 0.06)' },
  break: { border: '#EF4444', background: 'rgba(239, 68, 68, 0.06)' },
  rect: { border: 'transparent', background: 'rgba(148, 163, 184, 0.10)' },
}

function participantX(index: number): number {
  const { COLUMN_WIDTH } = SEQUENCE_LAYOUT
  return index * COLUMN_WIDTH + COLUMN_WIDTH / 2
}

export function rowHandleId(
  rowIndex: number,
  side: 'left' | 'right',
  handleType: 'source' | 'target'
): string {
  return `row-${rowIndex}-${side}-${handleType}`
}

type Item =
  | { kind: 'message'; parserRow: number; message: SequenceMessage }
  | { kind: 'note'; parserRow: number; note: SequenceNote }

/**
 * Vertical grid for a parsed sequence diagram.
 *
 * Two things make this more than `row * rowHeight`: a self-message needs two
 * rows (it leaves its lifeline and returns to it), and every block frame
 * (`loop`, `alt`, `rect`, …) needs room for its label above its first row and
 * a margin below its last, which pushes every row after it down. The resulting
 * per-row Y values are handed to the participant nodes so their edge handles
 * land exactly on the message boxes rather than on a uniform grid that no
 * longer matches.
 */
function buildGrid(data: SequenceDiagramData) {
  const { ROW_HEIGHT, ROW_VERTICAL_PADDING, HEADER_HEIGHT } = SEQUENCE_LAYOUT
  const {
    BLOCK_TOP_PADDING,
    BLOCK_BOTTOM_PADDING,
    BLOCK_SECTION_PADDING,
    BLOCK_FRAME_GAP,
  } = SEQUENCE_LAYOUT

  const items: Item[] = [
    ...data.messages.map(
      (message): Item => ({
        kind: 'message',
        parserRow: message.rowIndex,
        message,
      })
    ),
    ...data.notes.map(
      (note): Item => ({ kind: 'note', parserRow: note.rowIndex, note })
    ),
  ].sort((a, b) => a.parserRow - b.parserRow)

  const sizes = new Map<number, { width: number; height: number }>()
  const layoutRowByParserRow = new Map<number, number>()
  const rowSpan = new Map<number, number>()

  let cursor = 0
  for (const item of items) {
    const text = item.kind === 'message' ? item.message.label : item.note.text
    sizes.set(item.parserRow, estimateSequenceMessageBoxSize(text))
    layoutRowByParserRow.set(item.parserRow, cursor)
    const span =
      item.kind === 'message' && item.message.from === item.message.to ? 2 : 1
    rowSpan.set(item.parserRow, span)
    cursor += span
  }

  const totalRows = Math.max(cursor, 1)
  const rowHeight = Math.max(
    ROW_HEIGHT,
    ...[...sizes.values()].map((size) => size.height + ROW_VERTICAL_PADDING)
  )

  /** Parser rows without an item (`activate` lines) borrow the next item's row. */
  function toLayoutRow(parserRow: number): number {
    for (let row = parserRow; row < parserRow + items.length + 1; row++) {
      const layoutRow = layoutRowByParserRow.get(row)
      if (layoutRow !== undefined) return layoutRow
    }
    return totalRows
  }

  function toLastLayoutRow(parserRow: number): number {
    for (let row = parserRow; row >= 0; row--) {
      const layoutRow = layoutRowByParserRow.get(row)
      if (layoutRow !== undefined) return layoutRow + rowSpan.get(row)! - 1
    }
    return 0
  }

  const padBefore = new Array<number>(totalRows + 1).fill(0)
  const padAfter = new Array<number>(totalRows + 1).fill(0)

  for (const block of data.blocks) {
    if (block.endRow < block.startRow) continue
    // The frame itself only claims BLOCK_TOP_PADDING of this, so the extra gap
    // is space no frame draws over — without it a block ending on one row and
    // the next block starting on the following row share an edge.
    padBefore[toLayoutRow(block.startRow)] +=
      BLOCK_TOP_PADDING + BLOCK_FRAME_GAP
    padAfter[toLastLayoutRow(block.endRow)] += BLOCK_BOTTOM_PADDING
    for (const section of block.sections.slice(1)) {
      if (section.endRow < section.startRow) continue
      padBefore[toLayoutRow(section.startRow)] += BLOCK_SECTION_PADDING
    }
  }

  const rowTops: number[] = []
  let y = HEADER_HEIGHT
  for (let row = 0; row < totalRows; row++) {
    y += padBefore[row]
    rowTops.push(y)
    y += rowHeight + padAfter[row]
  }
  const contentHeight = y

  const rowCenters = rowTops.map((top) => top + rowHeight / 2)

  return {
    items,
    sizes,
    rowHeight,
    totalRows,
    rowTops,
    rowCenters,
    contentHeight,
    padBefore,
    padAfter,
    toLayoutRow,
    toLastLayoutRow,
    layoutRowByParserRow,
  }
}

type Grid = ReturnType<typeof buildGrid>

/**
 * Self-message boxes hang to the right of their own lifeline rather than
 * straddling it — a centered box wide enough to cover the lifeline forces its
 * own edges to wrap around the outside to reach the top/bottom handles.
 */
function messageBoxX(
  fromIndex: number,
  toIndex: number,
  width: number
): number {
  const { SELF_LOOP_OFFSET } = SEQUENCE_LAYOUT
  if (fromIndex === toIndex) return participantX(fromIndex) + SELF_LOOP_OFFSET
  return (participantX(fromIndex) + participantX(toIndex)) / 2 - width / 2
}

function noteBox(
  note: SequenceNote,
  grid: Grid,
  indexById: Map<string, number>
): { x: number; width: number } | undefined {
  const { NOTE_OFFSET, COLUMN_WIDTH } = SEQUENCE_LAYOUT
  const indices = note.participants
    .map((id) => indexById.get(id))
    .filter((index): index is number => index !== undefined)
  if (indices.length === 0) return undefined

  const size = grid.sizes.get(note.rowIndex)!
  const first = participantX(indices[0])
  const last = participantX(indices[indices.length - 1])

  if (note.placement === 'right of') {
    return { x: first + NOTE_OFFSET, width: size.width }
  }
  if (note.placement === 'left of') {
    return { x: first - NOTE_OFFSET - size.width, width: size.width }
  }
  if (indices.length > 1) {
    const width = Math.max(size.width, last - first + COLUMN_WIDTH / 2)
    return { x: (first + last) / 2 - width / 2, width }
  }
  return { x: first - size.width / 2, width: size.width }
}

function blockFrameNode(
  block: SequenceBlock,
  data: SequenceDiagramData,
  grid: Grid,
  indexById: Map<string, number>
): Node | undefined {
  if (block.endRow < block.startRow) return undefined

  const {
    BLOCK_SIDE_PADDING,
    BLOCK_TOP_PADDING,
    BLOCK_BOTTOM_PADDING,
    BLOCK_CONTENT_INSET,
  } = SEQUENCE_LAYOUT

  const involved = new Set<number>()
  // A self-message's box sits beside its lifeline and a `right of` note sits
  // beyond the last one, so the frame has to be measured against the boxes it
  // contains — bounding only the lifelines leaves them hanging outside it.
  const lefts: number[] = []
  const rights: number[] = []

  // Every frame between this one and the box gets its own inset, or a parent
  // lands on the exact edge of the child that wraps the same box.
  function boxInset(parserRow: number): number {
    const between = data.blocks.filter(
      (other) =>
        other.depth > block.depth &&
        other.endRow >= other.startRow &&
        other.startRow <= parserRow &&
        other.endRow >= parserRow
    ).length
    return BLOCK_CONTENT_INSET * (between + 1)
  }

  for (const message of data.messages) {
    if (message.rowIndex < block.startRow || message.rowIndex > block.endRow) {
      continue
    }
    const from = indexById.get(message.from)
    const to = indexById.get(message.to)
    if (from !== undefined) involved.add(from)
    if (to !== undefined) involved.add(to)
    if (from === undefined || to === undefined) continue
    const width = grid.sizes.get(message.rowIndex)!.width
    const x = messageBoxX(from, to, width)
    const inset = boxInset(message.rowIndex)
    lefts.push(x - inset)
    rights.push(x + width + inset)
  }
  for (const note of data.notes) {
    if (note.rowIndex < block.startRow || note.rowIndex > block.endRow) continue
    note.participants.forEach((id) => {
      const index = indexById.get(id)
      if (index !== undefined) involved.add(index)
    })
    const box = noteBox(note, grid, indexById)
    if (box === undefined) continue
    const inset = boxInset(note.rowIndex)
    lefts.push(box.x - inset)
    rights.push(box.x + box.width + inset)
  }
  if (involved.size === 0) {
    data.participants.forEach((p) => involved.add(p.index))
  }

  const minIndex = Math.min(...involved)
  const maxIndex = Math.max(...involved)
  const startRow = grid.toLayoutRow(block.startRow)
  const endRow = grid.toLastLayoutRow(block.endRow)

  // Nested frames share the same rows as their parent, so each one has to be
  // inset from it on every side — otherwise `loop` directly wrapping `par`
  // draws two rectangles exactly on top of each other.
  const sidePadding = Math.max(
    BLOCK_CONTENT_INSET,
    BLOCK_SIDE_PADDING - block.depth * BLOCK_CONTENT_INSET
  )
  const nested = data.blocks.filter(
    (other) => other.id !== block.id && other.depth > block.depth
  )
  const deeperAtTop = nested.filter(
    (other) =>
      other.endRow >= other.startRow &&
      grid.toLayoutRow(other.startRow) === startRow
  ).length
  const deeperAtBottom = nested.filter(
    (other) =>
      other.endRow >= other.startRow &&
      grid.toLastLayoutRow(other.endRow) === endRow
  ).length

  const x = Math.min(participantX(minIndex) - sidePadding, ...lefts)
  const right = Math.max(participantX(maxIndex) + sidePadding, ...rights)
  const width = right - x
  const top = grid.rowTops[startRow] - BLOCK_TOP_PADDING * (deeperAtTop + 1)
  const height =
    grid.rowTops[endRow] +
    grid.rowHeight +
    BLOCK_BOTTOM_PADDING * (deeperAtBottom + 1) -
    top

  const style = BLOCK_STYLES[block.type]

  return {
    id: `sequence-block-${block.id}`,
    type: 'group',
    position: { x, y: top },
    width,
    height,
    // A nested block sits inside its parent's rectangle, so it has to paint on
    // top of it — while every frame stays behind the message boxes (z 0) and
    // in front of the box groups (z -20).
    zIndex: Math.min(-1, -10 + block.depth),
    selectable: true,
    data: {
      source: 'mermaid',
      backgroundColor: style.background,
      borderColor: style.border,
      autoLayout: false,
      sequenceBlock: {
        type: block.type,
        label: block.label,
        color: block.color,
        depth: block.depth,
        startRow,
        endRow,
        sections: block.sections.map((section) => ({
          label: section.label,
          startRow: grid.toLayoutRow(section.startRow),
          endRow: grid.toLastLayoutRow(section.endRow),
        })),
      },
      componentFields: [
        generateComponentFieldNameInput(
          block.label ? `${block.type} ${block.label}` : block.type
        ),
      ],
    },
    style: { width, height },
  }
}

function noteNode(
  note: SequenceNote,
  grid: Grid,
  indexById: Map<string, number>
): Node | undefined {
  const box = noteBox(note, grid, indexById)
  if (box === undefined) return undefined

  const { x, width } = box
  const size = grid.sizes.get(note.rowIndex)!
  const row = grid.toLayoutRow(note.rowIndex)

  return {
    id: `note-${note.rowIndex}`,
    type: 'shape',
    position: { x, y: grid.rowCenters[row] - size.height / 2 },
    width,
    height: size.height,
    data: {
      source: 'mermaid',
      shape: 'rectangle',
      fill: '#FEF3C7',
      stroke: '#F59E0B',
      strokeWidth: 1,
      textColor: '#1F2937',
      sequenceNote: {
        placement: note.placement,
        participants: note.participants,
        row,
      },
      componentFields: [generateComponentFieldNameInput(note.text)],
    },
    style: { width, height: size.height },
  }
}

function messageMarkers(message: SequenceMessage, color: string) {
  const arrow = { width: 16, height: 16, color }

  if (message.arrowType === 'none') return {}
  if (message.arrowType === 'filled') {
    return { markerEnd: { type: MarkerType.ArrowClosed, ...arrow } }
  }
  if (message.arrowType === 'bidirectional') {
    return {
      markerStart: { type: MarkerType.ArrowClosed, ...arrow },
      markerEnd: { type: MarkerType.ArrowClosed, ...arrow },
    }
  }
  // `open`, `cross`, `half` and `stick` all draw a single unfilled head; the
  // exact glyph differs but React Flow only ships one open marker.
  if (message.reversed) {
    return { markerStart: { type: MarkerType.Arrow, ...arrow } }
  }
  return { markerEnd: { type: MarkerType.Arrow, ...arrow } }
}

export function convertSequenceDiagramToReactFlow(
  mermaidCode: string
): ReactFlowData {
  const data = parseSequenceDiagram(mermaidCode)
  const {
    PARTICIPANT_NODE_WIDTH,
    COLUMN_WIDTH,
    BOX_TOP_INSET,
    BOX_BOTTOM_PADDING,
    BLOCK_SIDE_PADDING,
  } = SEQUENCE_LAYOUT

  const grid = buildGrid(data)
  const indexById = new Map(data.participants.map((p) => [p.id, p.index]))
  const nodes: Node[] = []
  const edges: Edge[] = []

  for (const box of data.boxes) {
    const indices = box.participants
      .map((id) => indexById.get(id))
      .filter((index): index is number => index !== undefined)
    if (indices.length === 0) continue

    const minIndex = Math.min(...indices)
    const maxIndex = Math.max(...indices)
    const x = participantX(minIndex) - COLUMN_WIDTH / 2 + 8
    const width =
      participantX(maxIndex) - participantX(minIndex) + COLUMN_WIDTH - 16

    nodes.push({
      id: `sequence-box-${box.id}`,
      type: 'group',
      position: { x, y: -BOX_TOP_INSET },
      width,
      height: grid.contentHeight + BOX_TOP_INSET + BOX_BOTTOM_PADDING,
      zIndex: -20,
      data: {
        source: 'mermaid',
        backgroundColor: box.color ?? 'rgba(148, 163, 184, 0.08)',
        borderColor: '#94A3B8',
        autoLayout: false,
        sequenceBox: { label: box.label, participants: box.participants },
        componentFields: [generateComponentFieldNameInput(box.label)],
      },
      style: {
        width,
        height: grid.contentHeight + BOX_TOP_INSET + BOX_BOTTOM_PADDING,
      },
    })
  }

  for (const block of data.blocks) {
    const node = blockFrameNode(block, data, grid, indexById)
    if (node) nodes.push(node)
  }

  for (const participant of data.participants) {
    const activations = data.activations
      .filter((activation) => activation.participant === participant.id)
      .map((activation) => ({
        startRow: grid.toLayoutRow(activation.startRow),
        endRow: grid.toLastLayoutRow(activation.endRow),
      }))

    nodes.push({
      id: `participant-${participant.id}`,
      type: 'sequenceParticipant',
      position: {
        x: participantX(participant.index) - PARTICIPANT_NODE_WIDTH / 2,
        y: 0,
      },
      data: {
        source: 'mermaid',
        label: participant.name,
        participantType: participant.type,
        rowCount: grid.totalRows,
        rowHeight: grid.rowHeight,
        rowYs: grid.rowCenters,
        lifelineHeight: grid.contentHeight,
        activations,
        links: participant.links,
        ...(participant.createdAtRow === undefined
          ? {}
          : { lifelineStartRow: grid.toLayoutRow(participant.createdAtRow) }),
        ...(participant.destroyedAtRow === undefined
          ? {}
          : {
              lifelineEndRow: grid.toLastLayoutRow(participant.destroyedAtRow),
            }),
        componentFields: [
          generateComponentFieldNameInput(participant.name),
          generateComponentFieldInput({
            componentFieldId: 'color',
            label: 'Color',
            data: SEQUENCE_PARTICIPANT_COLOR,
            type: ComponentInputType.ColorPicker,
          }),
        ],
      },
    })
  }

  for (const note of data.notes) {
    const node = noteNode(note, grid, indexById)
    if (node) nodes.push(node)
  }

  for (const message of data.messages) {
    const fromIndex = indexById.get(message.from)
    const toIndex = indexById.get(message.to)
    if (fromIndex === undefined || toIndex === undefined) continue

    const isSelf = fromIndex === toIndex
    const goesRight = fromIndex < toIndex
    const size = grid.sizes.get(message.rowIndex)!
    const row = grid.toLayoutRow(message.rowIndex)

    const x = messageBoxX(fromIndex, toIndex, size.width)

    const messageId = `message-${message.rowIndex}`

    nodes.push({
      id: messageId,
      type: 'shape',
      position: { x, y: grid.rowCenters[row] - size.height / 2 },
      width: size.width,
      height: size.height,
      data: {
        source: 'mermaid',
        shape: 'rectangle',
        fill: '#1E293B',
        stroke: '#475569',
        strokeWidth: 1,
        ...(message.sequenceNumber === undefined
          ? {}
          : { sequenceNumber: message.sequenceNumber }),
        componentFields: [generateComponentFieldNameInput(message.label)],
      },
      style: { width: size.width, height: size.height },
    })

    const color = '#94a3b8'
    const edgeStyle = {
      stroke: color,
      strokeWidth: 2,
      ...(message.lineStyle === 'dashed'
        ? { strokeDasharray: '4 4' as const }
        : {}),
    }

    const sourceSide = goesRight || isSelf ? 'right' : 'left'
    const targetSide = isSelf ? 'right' : goesRight ? 'left' : 'right'

    edges.push({
      id: `edge-${message.rowIndex}-a`,
      source: `participant-${message.from}`,
      target: messageId,
      sourceHandle: rowHandleId(row, sourceSide, 'source'),
      targetHandle: isSelf
        ? 'target-top'
        : sourceSide === 'right'
          ? 'target-left'
          : 'target-right',
      type: 'smoothstep',
      style: edgeStyle,
      data: {
        source: 'mermaid',
        arrowType: message.arrowType,
        ...(message.half ? { half: message.half } : {}),
        ...(message.reversed ? { reversed: true } : {}),
        ...(message.centralSource ? { centralSource: true } : {}),
      },
      ...(message.reversed ? messageMarkers(message, color) : {}),
    })

    edges.push({
      id: `edge-${message.rowIndex}-b`,
      source: messageId,
      target: `participant-${message.to}`,
      sourceHandle: isSelf
        ? 'source-bottom'
        : goesRight
          ? 'source-right'
          : 'source-left',
      targetHandle: rowHandleId(row + (isSelf ? 1 : 0), targetSide, 'target'),
      type: 'smoothstep',
      style: edgeStyle,
      data: {
        source: 'mermaid',
        arrowType: message.arrowType,
        ...(message.half ? { half: message.half } : {}),
        ...(message.centralTarget ? { centralTarget: true } : {}),
      },
      ...(message.reversed ? {} : messageMarkers(message, color)),
    })
  }

  if (data.title) {
    nodes.push({
      id: 'sequence-title',
      type: 'text',
      position: {
        x: participantX(0) - COLUMN_WIDTH / 2,
        y: -BOX_TOP_INSET - BLOCK_SIDE_PADDING,
      },
      data: {
        source: 'mermaid',
        componentFields: [generateComponentFieldNameInput(data.title)],
      },
    })
  }

  return { nodes, edges }
}
