import {
  convertDynamoSchemaToAst,
  convertJsonSchemaToAst,
  convertMongoSchemaToAst,
} from './convert-ast'
import {
  DynamoEditorSchema,
  JsonEditorSchema,
  MongoEditorSchema,
} from './nosql-schema'

export * from './convert-ast'
export * from './nosql-schema'

export function convertNoSQLToAst(input: unknown) {
  const dynamoDbSchema = DynamoEditorSchema.safeParse(input)
  if (dynamoDbSchema.success) {
    return convertDynamoSchemaToAst(dynamoDbSchema.data)
  }

  const mongoDbSchema = MongoEditorSchema.safeParse(input)
  if (mongoDbSchema.success) {
    return convertMongoSchemaToAst(mongoDbSchema.data)
  }

  const jsonSchema = JsonEditorSchema.safeParse(input)
  if (jsonSchema.success) {
    return convertJsonSchemaToAst(jsonSchema.data)
  }

  throw new Error('Input does not match any supported NoSQL schema format')
}
