import { ComponentInputType } from '../components/component-type'
import {
  COMPONENT_INPUT_TYPES,
  INLINE_MERMAID_LABEL_MAX_LENGTH,
} from './constants'

export function isComponentInputType(
  value: string
): value is ComponentInputType {
  return COMPONENT_INPUT_TYPES.has(value as ComponentInputType)
}

export function toRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return
  return value as Record<string, unknown>
}

export function pickString(value: unknown): string | undefined {
  if (typeof value !== 'string') return
  const trimmed = value.trim()
  if (!trimmed) return
  return trimmed
}

export function pickPosition(
  value: unknown
): { x: number; y: number } | undefined {
  const position = toRecord(value)
  if (!position) return

  if (typeof position.x !== 'number' || !Number.isFinite(position.x)) return
  if (typeof position.y !== 'number' || !Number.isFinite(position.y)) return

  return {
    x: position.x,
    y: position.y,
  }
}

export function getFieldValue(fieldData: unknown): unknown {
  if (!Array.isArray(fieldData) || fieldData.length !== 1) return fieldData
  const first = toRecord(fieldData[0])
  if (!first) return fieldData
  if (!('value' in first)) return first
  return first.value
}

export function getFieldByLabel(
  fields: Record<string, unknown>[],
  label: string
): Record<string, unknown> | undefined {
  return fields.find(
    (field) =>
      pickString(field.label)?.toLowerCase() === label.toLowerCase() &&
      pickString(field.type)
  )
}

export function getFieldString(
  fields: Record<string, unknown>[],
  label: string
): string | undefined {
  const field = getFieldByLabel(fields, label)
  if (!field) return
  return pickString(getFieldValue(field.data))
}

export function isEmptyFieldValue(value: unknown): boolean {
  if (typeof value === 'string') return value.trim().length === 0
  return value === undefined || value === null
}

export function parseStrokeStyle(
  dashArray: unknown
): 'solid' | 'dashed' | 'dotted' | undefined {
  if (typeof dashArray !== 'string' || !dashArray.trim()) return
  const normalized = dashArray.replaceAll(',', ' ').replace(/\s+/g, ' ').trim()
  if (normalized === '1 2') return 'dotted'
  if (normalized === '4 2' || normalized === '4 4' || normalized === '8 4') {
    return 'dashed'
  }
  return 'solid'
}

export function normalizeMarker(
  marker: unknown
): { type: string; color?: string } | undefined {
  if (typeof marker === 'string') {
    return { type: marker }
  }

  const markerRecord = toRecord(marker)
  if (!markerRecord) return
  const type = pickString(markerRecord.type)
  if (!type) return

  const color = pickString(markerRecord.color)
  if (color) return { type, color }
  return { type }
}

export function escapeMermaidText(value: string): string {
  return value.replaceAll('"', '\\"')
}

export function canInlineMermaidLabel(value: string): boolean {
  if (value.length > INLINE_MERMAID_LABEL_MAX_LENGTH) return false
  if (value.includes('\n') || value.includes('\r')) return false
  return true
}

export function normalizeDetailedMermaidLabel(value: string): string {
  return value
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line.length > 0)
    .join('\n')
}

export function toComponentFields(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return []
  return value
    .map((field) => toRecord(field))
    .filter((field) => field !== undefined)
}
