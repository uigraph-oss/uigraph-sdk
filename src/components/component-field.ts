import { ServerComponentField } from '../types'
import { buildMetaData } from './data-structure'

type GenerateComponentFieldOptions = Partial<ServerComponentField>

export function generateComponentFieldInput(
  options: GenerateComponentFieldOptions
) {
  const componentId = options.componentFieldId ?? String(Math.random())

  const field = {
    ...options,
    componentFieldId: componentId,
  }

  const [metaData] = buildMetaData([field], {
    [componentId]: options.data,
  })

  return metaData
}

export function getComponentFieldByLabel(
  fields: ServerComponentField[],
  label: string
) {
  return fields.find(
    (field) => field.label?.toLowerCase() === label.toLowerCase()
  )
}
