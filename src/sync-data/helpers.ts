import { RFComponentField } from '../types'

export function mergeComponentFields(
  prev?: RFComponentField[],
  next?: RFComponentField[]
): RFComponentField[] | undefined {
  if (prev === undefined && next === undefined) return

  const prevFields = prev ?? []
  const nextFields = next ?? []

  const prevFieldsMap = getFieldDataMap(prevFields)
  const updated: RFComponentField[] = nextFields.map((field) => {
    const prevData = prevFieldsMap[field.label]
    if (!prevData) return field

    return { ...field, data: prevData }
  })

  const missingFields = prevFields.filter(
    (field) => !nextFields.some((f) => f.label === field.label)
  )

  return [...updated, ...missingFields]
}

function getFieldDataMap(fields: RFComponentField[]): Record<string, unknown> {
  const result: Record<string, unknown> = {}
  for (const field of fields) {
    result[field.label] = field.data
  }

  return result
}
