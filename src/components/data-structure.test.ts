import { describe, expect, it } from 'vitest'
import { ComponentInputType } from './component-type'
import { buildMetaData, flattenMetaData } from './data-structure'

function field(
  componentFieldId: string,
  type: ComponentInputType,
  label = 'Field'
) {
  return {
    componentFieldId,
    type,
    label,
  }
}

describe('buildMetaData', () => {
  it('builds string data for text inputs', () => {
    const fields = [field('name', ComponentInputType.TextInput, 'Name')]
    const result = buildMetaData(fields, { name: 'Alice' })
    expect(result[0].data).toEqual([{ value: 'Alice' }])
  })

  it('builds number data for number inputs', () => {
    const fields = [field('count', ComponentInputType.NumberInput, 'Count')]
    const result = buildMetaData(fields, { count: '3' })
    expect(result[0].data).toEqual([{ value: 3 }])
  })

  it('builds boolean data for toggles', () => {
    const fields = [field('flag', ComponentInputType.BooleanToggle, 'Flag')]
    const result = buildMetaData(fields, { flag: true })
    expect(result[0].data).toEqual([{ value: true }])
  })

  it('builds list data for multi select', () => {
    const fields = [field('tags', ComponentInputType.TagInput, 'Tags')]
    const result = buildMetaData(fields, { tags: ['a', 'b'] })
    expect(result[0].data).toEqual([{ value: ['a', 'b'] }])
  })

  it('builds rich text data as a single entry', () => {
    const fields = [field('rt', ComponentInputType.RichTextEditor, 'Rich')]
    const result = buildMetaData(fields, { rt: { ops: [] } })
    expect(result[0].data).toEqual([{ ops: [] }])
  })
})

describe('flattenMetaData', () => {
  it('flattens text input to string', () => {
    const fields = [field('name', ComponentInputType.TextInput, 'Name')]
    const input = buildMetaData(fields, { name: 'Alice' })
    expect(flattenMetaData(fields, input)).toEqual({ name: 'Alice' })
  })

  it('flattens number input to number', () => {
    const fields = [field('count', ComponentInputType.NumberInput, 'Count')]
    const input = buildMetaData(fields, { count: 4 })
    expect(flattenMetaData(fields, input)).toEqual({ count: 4 })
  })

  it('flattens boolean toggle to boolean', () => {
    const fields = [field('flag', ComponentInputType.BooleanToggle, 'Flag')]
    const input = buildMetaData(fields, { flag: true })
    expect(flattenMetaData(fields, input)).toEqual({ flag: true })
  })

  it('flattens key value list to array', () => {
    const fields = [
      field('kv', ComponentInputType.KeyValueList, 'Key-Value List'),
    ]
    const input = buildMetaData(fields, { kv: [{ key: 'a', value: '1' }] })
    expect(flattenMetaData(fields, input)).toEqual({
      kv: [{ key: 'a', value: '1' }],
    })
  })

  it('flattens rich text editor to object', () => {
    const fields = [field('rt', ComponentInputType.RichTextEditor, 'Rich')]
    const input = buildMetaData(fields, { rt: { ops: [] } })
    expect(flattenMetaData(fields, input)).toEqual({ rt: { ops: [] } })
  })
})
