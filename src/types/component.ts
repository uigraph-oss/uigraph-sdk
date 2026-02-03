export type ServerComponentField = {
  componentFieldId: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any
  isReadonly?: boolean | null
  label?: string | null
  options?: string[] | null
  order?: number | null
  required?: boolean | null
  type?: string | null
}
