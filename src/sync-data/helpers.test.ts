import { describe, expect, it } from 'vitest'
import { ComponentInputType } from '../components/component-type'
import type { RFComponentField } from '../types'
import { mergeComponentFields } from './helpers'

function makeField(
  label: string,
  data: unknown,
  componentFieldId: string = label
): RFComponentField {
  return {
    componentFieldId,
    type: ComponentInputType.TextInput,
    label,
    data,
  }
}

describe('mergeComponentFields', () => {
  it('returns undefined when both inputs are undefined', () => {
    expect(mergeComponentFields()).toBeUndefined()
  })

  it('returns next when prev is undefined', () => {
    const next = [makeField('Name', [{ value: 'Next' }])]
    expect(mergeComponentFields(undefined, next)).toEqual(next)
  })

  it('keeps prev data for matching labels', () => {
    const prev = [makeField('Name', [{ value: 'Prev' }])]
    const next = [makeField('Name', [{ value: 'Next' }])]
    const merged = mergeComponentFields(prev, next)
    expect(merged).toHaveLength(1)
    expect(merged?.[0].data).toEqual([{ value: 'Prev' }])
  })

  it('appends missing prev fields after updated next fields', () => {
    const prev = [makeField('A', [{ value: 'prev-a' }])]
    const next = [makeField('B', [{ value: 'next-b' }])]
    const merged = mergeComponentFields(prev, next)
    expect(merged?.map((field) => field.label)).toEqual(['B', 'A'])
    expect(merged?.[0].data).toEqual([{ value: 'next-b' }])
    expect(merged?.[1].data).toEqual([{ value: 'prev-a' }])
  })
})
