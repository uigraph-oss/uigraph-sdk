import { describe, expect, it } from 'vitest'
import {
  canInlineMermaidLabel,
  escapeMermaidText,
  getFieldByLabel,
  getFieldValue,
  isEmptyFieldValue,
  normalizeDetailedMermaidLabel,
  normalizeMarker,
  parseStrokeStyle,
  pickPosition,
  pickString,
  toComponentFields,
  toRecord,
} from '../utils'

describe('reading loose values', () => {
  it('refuses to treat an array as a record of properties', () => {
    expect(toRecord([{ x: 1 }])).toBeUndefined()
  })

  it('trims the string it hands back', () => {
    expect(pickString('  Auth Service  ')).toBe('Auth Service')
  })

  it('drops a string that is nothing but whitespace', () => {
    expect(pickString('   ')).toBeUndefined()
  })

  it('keeps only the coordinates out of a position', () => {
    expect(pickPosition({ x: 12, y: 34, z: 56 })).toEqual({ x: 12, y: 34 })
  })

  it('refuses a position whose y is not a finite number', () => {
    expect(pickPosition({ x: 0, y: Number.POSITIVE_INFINITY })).toBeUndefined()
  })
})

describe('reading a component field', () => {
  it('hands back the whole list when a field holds more than one entry', () => {
    const data = [{ value: 'first' }, { value: 'second' }]

    expect(getFieldValue(data)).toEqual(data)
  })

  it('hands back the entry itself when it carries no value key', () => {
    expect(getFieldValue([{ ops: [] }])).toEqual({ ops: [] })
  })

  it('finds a field label whatever case it was written in', () => {
    const fields = [{ label: 'NAME', type: 'Text Input' }]

    expect(getFieldByLabel(fields, 'name')).toBe(fields[0])
  })

  it('ignores a field that is labelled but has no input type', () => {
    expect(getFieldByLabel([{ label: 'Name' }], 'Name')).toBeUndefined()
  })

  it('counts a zero as a value somebody filled in', () => {
    expect(isEmptyFieldValue(0)).toBe(false)
  })

  it('keeps only the records out of a component field list', () => {
    expect(toComponentFields([{ label: 'Name' }, 'Name', null])).toEqual([
      { label: 'Name' },
    ])
  })
})

describe('reading a dash pattern', () => {
  it('reads a tight pattern as dotted', () => {
    expect(parseStrokeStyle('1 2')).toBe('dotted')
  })

  it('reads a comma separated pattern the same as a spaced one', () => {
    expect(parseStrokeStyle('4,2')).toBe('dashed')
  })

  it('calls a pattern it does not recognise solid', () => {
    expect(parseStrokeStyle('9 9 1')).toBe('solid')
  })

  it('has no opinion when there is no pattern at all', () => {
    expect(parseStrokeStyle('   ')).toBeUndefined()
  })
})

describe('reading a marker', () => {
  it('drops a marker that never says what type it is', () => {
    expect(normalizeMarker({ color: '#111111' })).toBeUndefined()
  })
})

describe('writing mermaid text', () => {
  it('escapes the quotes inside a label', () => {
    expect(escapeMermaidText('the "main" queue')).toBe('the \\"main\\" queue')
  })

  it('refuses to inline a short label that breaks across lines', () => {
    expect(canInlineMermaidLabel('one\ntwo')).toBe(false)
  })

  it('squeezes every line of a detailed label and drops the blank ones', () => {
    expect(
      normalizeDetailedMermaidLabel('Name:   Auth\n\n  \nRegion: US')
    ).toBe('Name: Auth\nRegion: US')
  })
})
