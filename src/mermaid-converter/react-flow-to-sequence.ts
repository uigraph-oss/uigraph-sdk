import { Edge, Node } from '@xyflow/react'
import {
  SequenceArrowHead,
  SequenceBlockType,
  SequenceNote,
  SequenceParticipantType,
} from '../types'
import { findArrowTokenFor } from './sequence-parser'

/**
 * Turns a sequence diagram on the canvas back into mermaid
 * `sequenceDiagram` source — the inverse of
 * `convertSequenceDiagramToReactFlow`, reading the same node/edge shape it
 * produces (and the same shape `createMessage` authors by hand).
 */

type ParticipantEntry = {
  nodeId: string
  mermaidId: string
  name: string
  type: SequenceParticipantType
  links: Array<{ label: string; url: string }>
  createdRow?: number
  destroyedRow?: number
  activations: Array<{ startRow: number; endRow: number }>
  x: number
}

type MessageEntry = {
  kind: 'message'
  nodeId: string
  fromNodeId: string
  toNodeId: string
  label: string
  token: string
  centralSource: boolean
  centralTarget: boolean
  sequenceNumber?: number
}

type NoteEntry = {
  kind: 'note'
  nodeId: string
  text: string
  placement: SequenceNote['placement']
  participantNodeIds: string[]
}

type RowItem = MessageEntry | NoteEntry

export function isSequenceDiagram(nodes: Node[]): boolean {
  return nodes.some((node) => node.type === 'sequenceParticipant')
}

function fieldValue(node: Node, componentFieldId: string): string | undefined {
  const fields = node.data?.componentFields as
    | Array<{
        componentFieldId?: string
        data?: Array<{ value?: unknown } | undefined | null>
      } | null>
    | undefined
  if (!Array.isArray(fields)) return undefined

  const field = fields.find(
    (candidate) => candidate?.componentFieldId === componentFieldId
  )
  const value = field?.data?.[0]?.value
  if (typeof value !== 'string') return undefined
  if (!value.trim()) return undefined
  return value
}

function nodeLabel(node: Node): string {
  const fromField = fieldValue(node, 'name')
  if (fromField !== undefined) return fromField

  const label = node.data?.label
  if (typeof label === 'string') return label

  return ''
}

function encodeLabel(text: string): string {
  return text
    .replace(/#/g, '&#35;')
    .replace(/\r\n?/g, '\n')
    .replace(/\n/g, '<br/>')
    .trim()
}

function toMermaidId(name: string, index: number, used: Set<string>): string {
  const base = name.replace(/[^A-Za-z0-9_]/g, '') || `P${index}`

  let candidate = base
  let suffix = 2
  while (used.has(candidate)) {
    candidate = `${base}_${suffix}`
    suffix++
  }
  used.add(candidate)

  return candidate
}

function collectParticipants(nodes: Node[]): ParticipantEntry[] {
  const used = new Set<string>()

  return nodes
    .filter((node) => node.type === 'sequenceParticipant')
    .sort((a, b) => a.position.x - b.position.x)
    .map((node, index) => {
      const name = nodeLabel(node) || `Participant ${index + 1}`
      const rawType = node.data?.participantType
      const activations = node.data?.activations
      const links = node.data?.links
      const createdRow = node.data?.lifelineStartRow
      const destroyedRow = node.data?.lifelineEndRow

      return {
        nodeId: node.id,
        mermaidId: toMermaidId(name, index, used),
        name,
        type:
          typeof rawType === 'string'
            ? (rawType as SequenceParticipantType)
            : 'participant',
        links: Array.isArray(links)
          ? (links as Array<{ label: string; url: string }>)
          : [],
        activations: Array.isArray(activations)
          ? (activations as Array<{ startRow: number; endRow: number }>)
          : [],
        ...(typeof createdRow === 'number' ? { createdRow } : {}),
        ...(typeof destroyedRow === 'number' ? { destroyedRow } : {}),
        x: node.position.x,
      }
    })
}

function buildMessageLinks(edges: Edge[], participantNodeIds: Set<string>) {
  const links = new Map<string, { from?: string; to?: string }>()

  for (const edge of edges) {
    if (participantNodeIds.has(edge.source)) {
      links.set(edge.target, { ...links.get(edge.target), from: edge.source })
    }
    if (participantNodeIds.has(edge.target)) {
      links.set(edge.source, { ...links.get(edge.source), to: edge.target })
    }
  }

  return links
}

function arrowTokenOf(
  edgeFrom: Edge | undefined,
  edgeTo: Edge | undefined
): string {
  const arrowType = (edgeTo?.data?.arrowType ?? edgeFrom?.data?.arrowType) as
    | SequenceArrowHead
    | undefined
  const half = (edgeTo?.data?.half ?? edgeFrom?.data?.half) as
    | 'top'
    | 'bottom'
    | undefined
  const reversed = edgeFrom?.data?.reversed === true

  const dashed =
    (edgeTo?.style as { strokeDasharray?: string } | undefined)
      ?.strokeDasharray !== undefined ||
    (edgeFrom?.style as { strokeDasharray?: string } | undefined)
      ?.strokeDasharray !== undefined

  return findArrowTokenFor({
    lineStyle: dashed ? 'dashed' : 'solid',
    arrowType: arrowType ?? 'filled',
    ...(half ? { half } : {}),
    reversed,
  })
}

function noteParticipantNodeIds(
  note: { participants?: unknown },
  participants: ParticipantEntry[],
  noteNode: Node
): string[] {
  const raw = Array.isArray(note.participants)
    ? (note.participants as unknown[]).filter(
        (value): value is string => typeof value === 'string'
      )
    : []

  const byImportedId = raw
    .map((id) =>
      participants.find(
        (participant) => participant.nodeId === `participant-${id}`
      )
    )
    .filter((participant): participant is ParticipantEntry =>
      Boolean(participant)
    )

  if (byImportedId.length > 0) {
    return byImportedId.map((participant) => participant.nodeId)
  }

  if (participants.length === 0) return []

  const noteCenter = noteNode.position.x + (Number(noteNode.width) || 0) / 2
  const nearest = [...participants].sort(
    (a, b) => Math.abs(a.x - noteCenter) - Math.abs(b.x - noteCenter)
  )[0]

  return [nearest.nodeId]
}

function collectRowItems(
  nodes: Node[],
  edges: Edge[],
  participants: ParticipantEntry[]
): RowItem[] {
  const participantNodeIds = new Set(participants.map((p) => p.nodeId))
  const links = buildMessageLinks(edges, participantNodeIds)

  const items: Array<{ item: RowItem; y: number }> = []

  for (const node of nodes) {
    if (participantNodeIds.has(node.id)) continue

    const note = node.data?.sequenceNote as
      | { placement?: string; participants?: unknown }
      | undefined

    if (note) {
      items.push({
        item: {
          kind: 'note',
          nodeId: node.id,
          text: nodeLabel(node),
          placement: (note.placement ?? 'over') as SequenceNote['placement'],
          participantNodeIds: noteParticipantNodeIds(note, participants, node),
        },
        y: node.position.y,
      })
      continue
    }

    const link = links.get(node.id)
    if (!link?.from || !link.to) continue

    const edgeFrom = edges.find(
      (edge) => edge.target === node.id && edge.source === link.from
    )
    const edgeTo = edges.find(
      (edge) => edge.source === node.id && edge.target === link.to
    )
    const sequenceNumber = node.data?.sequenceNumber

    items.push({
      item: {
        kind: 'message',
        nodeId: node.id,
        fromNodeId: link.from,
        toNodeId: link.to,
        label: nodeLabel(node),
        token: arrowTokenOf(edgeFrom, edgeTo),
        centralSource: edgeFrom?.data?.centralSource === true,
        centralTarget: edgeTo?.data?.centralTarget === true,
        ...(typeof sequenceNumber === 'number' ? { sequenceNumber } : {}),
      },
      y: node.position.y,
    })
  }

  return items.sort((a, b) => a.y - b.y).map((entry) => entry.item)
}

type BlockEntry = {
  type: SequenceBlockType
  label: string
  color?: string
  depth: number
  startRow: number
  endRow: number
  sections: Array<{ label: string; startRow: number; endRow: number }>
}

function collectBlocks(nodes: Node[]): BlockEntry[] {
  const blocks: BlockEntry[] = []

  for (const node of nodes) {
    const block = node.data?.sequenceBlock as
      | {
          type?: string
          label?: string
          color?: string
          depth?: number
          startRow?: number
          endRow?: number
          sections?: Array<{
            label?: string
            startRow?: number
            endRow?: number
          }>
        }
      | undefined
    if (!block) continue
    if (typeof block.startRow !== 'number') continue
    if (typeof block.endRow !== 'number') continue

    blocks.push({
      type: (block.type ?? 'rect') as SequenceBlockType,
      label: block.label ?? '',
      ...(block.color ? { color: block.color } : {}),
      depth: block.depth ?? 0,
      startRow: block.startRow,
      endRow: block.endRow,
      sections: (block.sections ?? [])
        .filter(
          (section) =>
            typeof section.startRow === 'number' &&
            typeof section.endRow === 'number'
        )
        .map((section) => ({
          label: section.label ?? '',
          startRow: section.startRow!,
          endRow: section.endRow!,
        })),
    })
  }

  return blocks
}

type BoxEntry = { label: string; color?: string; participantNodeIds: string[] }

function collectBoxes(
  nodes: Node[],
  participants: ParticipantEntry[]
): BoxEntry[] {
  const boxes: BoxEntry[] = []

  for (const node of nodes) {
    const box = node.data?.sequenceBox as
      | { label?: string; participants?: unknown }
      | undefined
    if (!box) continue

    const raw = Array.isArray(box.participants)
      ? (box.participants as unknown[]).filter(
          (value): value is string => typeof value === 'string'
        )
      : []

    const byImportedId = raw
      .map((id) =>
        participants.find(
          (participant) => participant.nodeId === `participant-${id}`
        )
      )
      .filter((participant): participant is ParticipantEntry =>
        Boolean(participant)
      )

    const left = node.position.x
    const right = node.position.x + (Number(node.width) || 0)
    const contained =
      byImportedId.length > 0
        ? byImportedId
        : participants.filter(
            (participant) => participant.x >= left && participant.x <= right
          )

    if (contained.length === 0) continue

    const backgroundColor = node.data?.backgroundColor

    boxes.push({
      label: box.label ?? '',
      ...(typeof backgroundColor === 'string'
        ? { color: backgroundColor }
        : {}),
      participantNodeIds: contained.map((participant) => participant.nodeId),
    })
  }

  return boxes
}

function participantDeclaration(
  participant: ParticipantEntry,
  keyword: 'participant' | 'actor'
): string {
  const stereotype =
    participant.type === 'participant' || participant.type === 'actor'
      ? ''
      : `@{ "type": "${participant.type}" }`
  const alias =
    participant.mermaidId === participant.name
      ? ''
      : ` as ${encodeLabel(participant.name)}`

  return `${keyword} ${participant.mermaidId}${stereotype}${alias}`
}

export function convertReactFlowToSequenceMermaid(
  nodes: Node[],
  edges: Edge[]
): string {
  const participants = collectParticipants(nodes)
  const items = collectRowItems(nodes, edges, participants)
  const blocks = collectBlocks(nodes)
  const boxes = collectBoxes(nodes, participants)

  const participantByNodeId = new Map(
    participants.map((participant) => [participant.nodeId, participant])
  )

  const rowByItemId = new Map<string, number>()
  const lastRowByItemId = new Map<string, number>()
  let row = 0
  for (const item of items) {
    rowByItemId.set(item.nodeId, row)
    const isSelf = item.kind === 'message' && item.fromNodeId === item.toNodeId
    lastRowByItemId.set(item.nodeId, isSelf ? row + 1 : row)
    row += isSelf ? 2 : 1
  }
  const rowCount = row

  const lines: string[] = ['sequenceDiagram']

  const titleNode = nodes.find((node) => node.id === 'sequence-title')
  if (titleNode) {
    const text = fieldValue(titleNode, 'text') ?? nodeLabel(titleNode)
    if (text) lines.push(`  title ${encodeLabel(text)}`)
  }

  const boxByFirstParticipant = new Map<string, BoxEntry>()
  const boxEndByParticipant = new Map<string, number>()
  for (const box of boxes) {
    const ordered = participants.filter((participant) =>
      box.participantNodeIds.includes(participant.nodeId)
    )
    if (ordered.length === 0) continue
    boxByFirstParticipant.set(ordered[0].nodeId, box)
    boxEndByParticipant.set(
      ordered[ordered.length - 1].nodeId,
      (boxEndByParticipant.get(ordered[ordered.length - 1].nodeId) ?? 0) + 1
    )
  }

  for (const participant of participants) {
    const box = boxByFirstParticipant.get(participant.nodeId)
    if (box) {
      const color = box.color ? `${box.color} ` : ''
      lines.push(`  box ${color}${encodeLabel(box.label)}`.trimEnd())
    }

    if (participant.createdRow === undefined) {
      const keyword = participant.type === 'actor' ? 'actor' : 'participant'
      lines.push(`  ${participantDeclaration(participant, keyword)}`)
    }

    const boxEnds = boxEndByParticipant.get(participant.nodeId) ?? 0
    for (let index = 0; index < boxEnds; index++) lines.push('  end')
  }

  for (const participant of participants) {
    for (const link of participant.links) {
      lines.push(`  link ${participant.mermaidId}: ${link.label} @ ${link.url}`)
    }
  }

  const numbered = items.filter(
    (item): item is MessageEntry =>
      item.kind === 'message' && item.sequenceNumber !== undefined
  )
  if (numbered.length > 0) {
    const start = numbered[0].sequenceNumber!
    const step =
      numbered.length > 1
        ? numbered[1].sequenceNumber! - numbered[0].sequenceNumber!
        : 1
    lines.push(`  autonumber ${start} ${step}`)
  }

  const openBlocks: BlockEntry[] = []

  function indent(): string {
    return '  '.repeat(openBlocks.length + 1)
  }

  for (let currentRow = 0; currentRow < rowCount; currentRow++) {
    const opening = blocks
      .filter((block) => block.startRow === currentRow)
      .sort((a, b) => a.depth - b.depth)

    for (const block of opening) {
      const label = encodeLabel(block.label)
      const color =
        block.type === 'rect' && block.color ? `${block.color} ` : ''
      lines.push(`${indent()}${block.type} ${color}${label}`.trimEnd())
      openBlocks.push(block)
    }

    for (const [depth, block] of openBlocks.entries()) {
      for (const section of block.sections.slice(1)) {
        if (section.startRow !== currentRow) continue
        const keyword =
          block.type === 'par'
            ? 'and'
            : block.type === 'critical'
              ? 'option'
              : 'else'
        lines.push(
          `${'  '.repeat(depth + 1)}${keyword} ${encodeLabel(section.label)}`.trimEnd()
        )
      }
    }

    const item = items.find(
      (entry) => rowByItemId.get(entry.nodeId) === currentRow
    )

    if (item) {
      for (const participant of participants) {
        if (participant.createdRow !== currentRow) continue
        const keyword = participant.type === 'actor' ? 'actor' : 'participant'
        lines.push(
          `${indent()}create ${participantDeclaration(participant, keyword)}`
        )
      }

      for (const participant of participants) {
        if (participant.destroyedRow !== currentRow) continue
        lines.push(`${indent()}destroy ${participant.mermaidId}`)
      }

      for (const participant of participants) {
        for (const activation of participant.activations) {
          if (activation.startRow !== currentRow) continue
          lines.push(`${indent()}activate ${participant.mermaidId}`)
        }
      }

      if (item.kind === 'message') {
        const from = participantByNodeId.get(item.fromNodeId)
        const to = participantByNodeId.get(item.toNodeId)
        if (from && to) {
          const source = item.centralSource
            ? `${from.mermaidId}()`
            : from.mermaidId
          const target = item.centralTarget ? `()${to.mermaidId}` : to.mermaidId
          lines.push(
            `${indent()}${source}${item.token}${target}: ${encodeLabel(item.label)}`
          )
        }
      }

      if (item.kind === 'note') {
        const names = item.participantNodeIds
          .map((nodeId) => participantByNodeId.get(nodeId)?.mermaidId)
          .filter((id): id is string => id !== undefined)
        if (names.length > 0) {
          lines.push(
            `${indent()}Note ${item.placement} ${names.join(',')}: ${encodeLabel(item.text)}`
          )
        }
      }
    }

    const rowEnd = item ? lastRowByItemId.get(item.nodeId)! : currentRow

    for (const participant of participants) {
      for (const activation of participant.activations) {
        if (activation.endRow !== rowEnd) continue
        lines.push(`${indent()}deactivate ${participant.mermaidId}`)
      }
    }

    while (
      openBlocks.length > 0 &&
      openBlocks[openBlocks.length - 1].endRow <= rowEnd
    ) {
      openBlocks.pop()
      lines.push(`${indent()}end`)
    }
  }

  while (openBlocks.length > 0) {
    openBlocks.pop()
    lines.push(`${indent()}end`)
  }

  return lines.join('\n')
}
