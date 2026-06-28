export type LinkOrFileValue = {
  fileId?: string
  url?: string
  file?: File
}

export type ServerComponentField = {
  componentFieldId?: string | null
  isReadonly?: boolean | null
  label?: string | null
  options?: (string | null)[] | null
  order?: number | null
  required?: boolean | null
  type?: string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any | null
}

export type ServerComponentFieldInput = {
  componentFieldId: string
  type: string
  label: string
  order: number
  required: boolean

  isReadonly?: boolean | null
  options?: (string | null)[] | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any | null
}
