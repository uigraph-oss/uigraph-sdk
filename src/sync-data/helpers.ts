import { ComponentField } from '@/types'

export function mergeComponentFields(
  prev?: ComponentField[],
  next?: ComponentField[]
): ComponentField[] | undefined {
  if (prev === undefined && next === undefined) return

  const prevFields = prev ?? []
  const nextFields = next ?? []

  const updated: ComponentField[] = [...nextFields]

  const missingFields = prevFields.filter(
    (field) => !nextFields.some((f) => f.label === field.label)
  )

  return [...updated, ...missingFields]
}
