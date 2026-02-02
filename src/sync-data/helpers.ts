import { ComponentField } from '@/types'

export function mergeComponentFields(
  prev?: ComponentField[],
  next?: ComponentField[]
): ComponentField[] | undefined {
  if (prev === undefined && next === undefined) return

  const prevFields = prev ?? []
  const nextFields = next ?? []

  const prevFieldsMap = getFieldDataMap(prevFields)
  const updated: ComponentField[] = nextFields.map((field) => {
    const prevData = prevFieldsMap[field.label]
    if (!prevData) return field

    return { ...field, data: prevData }
  })

  const missingFields = prevFields.filter(
    (field) => !nextFields.some((f) => f.label === field.label)
  )

  return [...updated, ...missingFields]
}

function getFieldDataMap(fields: ComponentField[]): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const field of fields) {
    result[field.label] = field.data
  }

  return result
}
