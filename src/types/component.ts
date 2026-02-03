export type ServerComponentField = {
  componentFieldId?: string | null
  isReadonly?: boolean | null
  label?: string | null
  options?: string[] | null
  order?: number | null
  required?: boolean | null
  type?: string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any | null
}

export type ServerComponentFieldInput = {
  componentFieldId: string
  isReadonly?: boolean | null
  label?: string | null
  options?: string[] | null
  order?: number | null
  required?: boolean | null
  type?: string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any | null
}
