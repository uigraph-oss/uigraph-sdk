import { ServerComponentField, ServerComponentFieldInput } from '@/types'
import { ComponentInputType } from './component-type'

export function flattenMetaData(
  fields: ServerComponentField[],
  fieldsValues: ServerComponentField[]
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const output: Record<string, any | null> = {}

  fields.forEach((field) => {
    const data = fieldsValues.find(
      (f) => f?.componentFieldId === field.componentFieldId
    )?.data

    const id = field.componentFieldId!
    if (!id) return

    switch (field.type) {
      case ComponentInputType.TextInput:
      case ComponentInputType.TextBox:
      case ComponentInputType.DropdownSelect:
      case ComponentInputType.SearchSelect:
      case ComponentInputType.CodeEditor:
      case ComponentInputType.URLInput:
      case ComponentInputType.ColorPicker:
      case ComponentInputType.DatePicker:
        output[id] = String(data?.[0]?.value ?? '')
        break

      case ComponentInputType.MultiSelect:
      case ComponentInputType.CheckboxGroup:
      case ComponentInputType.TagInput:
        output[id] = data?.[0]?.value ?? []
        break

      case ComponentInputType.NumberInput:
      case ComponentInputType.Slider:
        output[id] = data?.[0]?.value ? Number(data[0].value) : null
        break

      case ComponentInputType.FileUpload:
      case ComponentInputType.LinkOrFileUpload:
        output[id] = data?.[0]?.value ?? ''
        break

      case ComponentInputType.RichTextEditor:
        output[id] = data?.[0] ?? undefined
        break

      case ComponentInputType.KeyValueList:
        output[id] = data ?? []
        break

      case ComponentInputType.BooleanToggle:
        output[id] = data?.[0]?.value ?? false
        break

      case ComponentInputType.DateRangePicker:
        output[id] = data?.[0]
        break
    }
  })

  return output
}

export function buildMetaData(
  fields: ServerComponentField[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any | null>
): ServerComponentFieldInput[] {
  return fields.map((field) => {
    let localData
    const value = data[field.componentFieldId!]

    switch (field.type) {
      case ComponentInputType.TextInput:
      case ComponentInputType.TextBox:
      case ComponentInputType.DropdownSelect:
      case ComponentInputType.SearchSelect:
      case ComponentInputType.CodeEditor:
      case ComponentInputType.URLInput:
      case ComponentInputType.ColorPicker:
      case ComponentInputType.DatePicker:
        localData = [{ value: String(value ?? '') }]
        break

      case ComponentInputType.MultiSelect:
      case ComponentInputType.CheckboxGroup:
      case ComponentInputType.TagInput:
        localData = [{ value: value ?? [] }]
        break

      case ComponentInputType.NumberInput:
      case ComponentInputType.Slider:
        localData = [{ value: value != null ? Number(value) : null }]
        break

      case ComponentInputType.FileUpload:
      case ComponentInputType.LinkOrFileUpload:
        localData = [{ value: value ?? '' }]
        break

      case ComponentInputType.RichTextEditor:
        localData = [value]
        break

      case ComponentInputType.KeyValueList:
        localData = value ?? []
        break

      case ComponentInputType.BooleanToggle:
        localData = [{ value: value ?? false }]
        break

      case ComponentInputType.DateRangePicker:
        localData = [value]
        break

      default:
        localData = value ?? null
        break
    }

    return {
      ...field,

      componentFieldId: field.componentFieldId!,
      type: field.type ?? ComponentInputType.TextInput,
      required: field.required ?? false,
      label: field.label ?? '',
      order: field.order ?? 0,

      data: localData ?? [],
    }
  })
}
