import { ServerComponentField } from '@/types'
import Quill, { Delta } from 'quill'
import { z } from 'zod'
import { ComponentInputType } from './component-type'

export function buildDynamicZodSchema(fields: ServerComponentField[]) {
  const shape: Record<string, z.ZodTypeAny> = {}

  fields.forEach((field) => {
    let zodType: z.ZodTypeAny
    const id = field.componentFieldId
    if (!id) return

    switch (field.type) {
      case ComponentInputType.TextInput:
      case ComponentInputType.TextBox:
      case ComponentInputType.DropdownSelect:
      case ComponentInputType.DatePicker: {
        const stringSchema = z.string()
        zodType = field.required
          ? stringSchema.min(1, {
              message: `${field.label ?? 'Field'} is required`,
            })
          : stringSchema.optional()

        break
      }

      case ComponentInputType.FileUpload:
      case ComponentInputType.LinkOrFileUpload:
        const stringSchema = z.string()
        const fileSchema = z.instanceof(File)

        const unionSchema = z.union([
          field.required ? fileSchema : fileSchema.optional(),

          field.required
            ? stringSchema.min(1, {
                message: `${field.label ?? 'Field'} is required`,
              })
            : stringSchema.optional(),
        ])

        zodType = field.required ? unionSchema : unionSchema.optional()
        break

      case ComponentInputType.URLInput: {
        const urlSchema = z.string({ message: 'Invalid URL' })
        zodType = field.required
          ? urlSchema.min(1, {
              message: `${field.label ?? 'Field'} is required`,
            })
          : urlSchema.optional().or(z.literal(''))

        break
      }

      case ComponentInputType.NumberInput: {
        let numberSchema = z.number()
        const min = (field as Partial<{ min: number }>).min
        const max = (field as Partial<{ max: number }>).max
        if (typeof min === 'number') {
          numberSchema = numberSchema.min(min, {
            message: `Must be ≥ ${min}`,
          })
        }
        if (typeof max === 'number') {
          numberSchema = numberSchema.max(max, {
            message: `Must be ≤ ${max}`,
          })
        }
        zodType = field.required
          ? numberSchema.nullable().refine((value) => value !== null, {
              message: `${field.label ?? 'Field'} is required`,
            })
          : numberSchema.nullable().optional()

        break
      }

      case ComponentInputType.CheckboxGroup:
      case ComponentInputType.MultiSelect:
      case ComponentInputType.TagInput: {
        const arraySchema = z.array(z.string())
        zodType = field.required
          ? arraySchema.min(1, {
              message: `${field.label ?? 'Field'} is required`,
            })
          : arraySchema.optional()

        break
      }

      case ComponentInputType.BooleanToggle: {
        const boolSchema = z.boolean()
        zodType = field.required ? boolSchema : boolSchema.optional()

        break
      }

      default: {
        if (field.required) {
          zodType = z.any().refine(
            (value) => {
              if (
                field.type === ComponentInputType.RichTextEditor &&
                value instanceof Delta
              ) {
                if (!value.ops.length) return false

                const container = document.createElement('div')
                const quill = new Quill(container)

                quill.setContents(value)
                const text = quill.getText().trim()

                return text.length > 0
              }

              if (Array.isArray(value)) {
                return value.length > 0
              }

              return value !== null && value !== undefined && value !== ''
            },
            { message: `${field.label ?? 'Field'} is required` }
          )
        } else {
          zodType = z.any().optional()
        }

        break
      }
    }

    shape[id] = zodType
  })

  return z.object(shape)
}
