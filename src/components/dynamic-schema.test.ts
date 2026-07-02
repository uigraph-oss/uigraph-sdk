import { Delta } from 'quill'
import { describe, expect, it, vi } from 'vitest'
import { ComponentInputType } from './component-type'
import { buildDynamicZodSchema } from './dynamic-schema'

vi.mock('quill', () => ({
  default: class MockQuill {
    text = ''
    setContents(value: { ops?: Array<{ insert?: string }> }) {
      this.text = value.ops?.map((op) => op.insert ?? '').join('') ?? ''
    }
    getText() {
      return this.text
    }
  },
  Delta: class MockDelta {
    ops: Array<{ insert: string }>
    constructor(ops: Array<{ insert: string }>) {
      this.ops = ops
    }
  },
}))

describe('buildDynamicZodSchema', () => {
  it('requires text input when required', () => {
    const schema = buildDynamicZodSchema([
      {
        componentFieldId: 'name',
        type: ComponentInputType.TextInput,
        label: 'Name',
        required: true,
      },
    ])

    expect(() => schema.parse({ name: '' })).toThrow('Name is required')
    expect(schema.parse({ name: 'Ok' })).toEqual({ name: 'Ok' })
  })

  it('accepts optional url input when empty string', () => {
    const schema = buildDynamicZodSchema([
      {
        componentFieldId: 'url',
        type: ComponentInputType.URLInput,
        label: 'URL',
        required: false,
      },
    ])

    expect(schema.parse({ url: '' })).toEqual({ url: '' })
  })

  it('validates number input with min and max', () => {
    const numberField = {
      componentFieldId: 'count',
      type: ComponentInputType.NumberInput,
      label: 'Count',
      required: true,
      min: 2,
      max: 4,
    } as const
    const schema = buildDynamicZodSchema([numberField])

    const tooSmall = schema.safeParse({ count: 1 })
    expect(tooSmall.success).toBe(false)
    if (!tooSmall.success) {
      expect(tooSmall.error.issues[0].message).toContain('Must be')
      expect(tooSmall.error.issues[0].message).toContain('2')
    }

    const tooLarge = schema.safeParse({ count: 5 })
    expect(tooLarge.success).toBe(false)
    if (!tooLarge.success) {
      expect(tooLarge.error.issues[0].message).toContain('Must be')
      expect(tooLarge.error.issues[0].message).toContain('4')
    }

    expect(schema.parse({ count: 3 })).toEqual({ count: 3 })
  })

  it('validates required multi select with min length', () => {
    const schema = buildDynamicZodSchema([
      {
        componentFieldId: 'tags',
        type: ComponentInputType.TagInput,
        label: 'Tags',
        required: true,
      },
    ])

    expect(() => schema.parse({ tags: [] })).toThrow('Tags is required')
    expect(schema.parse({ tags: ['a'] })).toEqual({ tags: ['a'] })
  })

  it('validates required rich text editor with Delta text', () => {
    const schema = buildDynamicZodSchema([
      {
        componentFieldId: 'rt',
        type: ComponentInputType.RichTextEditor,
        label: 'Rich',
        required: true,
      },
    ])

    vi.stubGlobal('document', {
      createElement: () => ({}),
    })

    const delta = new Delta([{ insert: 'Hello' }])
    expect(schema.parse({ rt: delta })).toEqual({ rt: delta })
  })
})
