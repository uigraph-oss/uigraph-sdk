import { describe, expect, it, vi } from 'vitest'
import {
  generateComponentFieldInput,
  generateComponentFieldNameInput,
  getComponentFieldByLabel,
} from './component-field'
import { ComponentInputType } from './component-type'

vi.mock('markdown-to-quill-delta', () => ({
  default: (value: string) => ({ ops: [{ insert: value }] }),
}))

describe('generateComponentFieldInput', () => {
  it('generates field with provided id', () => {
    const field = generateComponentFieldInput({
      componentFieldId: 'my-id',
      label: 'Name',
      type: ComponentInputType.TextInput,
      data: 'Hello',
    })

    expect(field.componentFieldId).toBe('my-id')
    expect(field.label).toBe('Name')
    expect(field.data).toEqual([{ value: 'Hello' }])
  })

  it('uses markdown converter for rich text editor strings', () => {
    const field = generateComponentFieldInput({
      componentFieldId: 'rt',
      label: 'Rich',
      type: ComponentInputType.RichTextEditor,
      data: '## Title',
    })

    expect(field.data).toEqual([{ ops: [{ insert: '## Title' }] }])
  })
})

describe('generateComponentFieldNameInput', () => {
  it('returns name field with text input type', () => {
    const field = generateComponentFieldNameInput('Group')
    expect(field.componentFieldId).toBe('name')
    expect(field.label).toBe('Name')
    expect(field.type).toBe(ComponentInputType.TextInput)
    expect(field.data).toEqual([{ value: 'Group' }])
  })
})

describe('getComponentFieldByLabel', () => {
  it('matches label case-insensitively', () => {
    const fields = [
      {
        componentFieldId: 'a',
        type: ComponentInputType.TextInput,
        label: 'Name',
        data: [],
      },
    ]
    const result = getComponentFieldByLabel(fields, 'name')
    expect(result?.componentFieldId).toBe('a')
  })
})
