import markdownToDelta from 'markdown-to-quill-delta'
import { ServerComponentField } from '../types'
import { ComponentInputType } from './component-type'
import { buildMetaData } from './data-structure'

type GenerateComponentFieldOptions = Partial<ServerComponentField>

export function generateComponentFieldInput(
  options: GenerateComponentFieldOptions
) {
  const componentId = options.componentFieldId ?? String(Math.random())

  const field = {
    ...options,
    hidden: true,
    componentFieldId: componentId,
  }

  const [metaData] = buildMetaData([field], {
    [componentId]:
      options.type === ComponentInputType.RichTextEditor &&
      typeof options.data === 'string'
        ? markdownToDelta(options.data)
        : options.data,
  })

  return metaData
}

export function generateComponentFieldNameInput(value: string) {
  return generateComponentFieldInput({
    componentFieldId: 'name',
    label: 'Name',
    type: ComponentInputType.TextInput,
    data: value,
  })
}

export function getComponentFieldByLabel(
  fields: ServerComponentField[],
  label: string
) {
  return fields.find(
    (field) => field.label?.toLowerCase() === label.toLowerCase()
  )
}
