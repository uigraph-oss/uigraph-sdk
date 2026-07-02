import z from 'zod'
import { SchemaAST, SchemaDialect } from '../../sql-parser'
import {
  DynamoEditorSchema,
  JsonEditorSchema,
  MongoEditorSchema,
} from './nosql-schema'

export interface DataSource {
  id: string
  name: string
  sourceType: 'file' | 'manual' | 'editor'
  sourceContent?:
    | z.infer<typeof JsonEditorSchema>
    | z.infer<typeof DynamoEditorSchema>
    | z.infer<typeof MongoEditorSchema>

  dialect: SchemaDialect
  schemaAst: SchemaAST

  createdAt: number
  modifiedAt: number | null
}
