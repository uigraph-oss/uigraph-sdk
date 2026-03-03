import { z } from 'zod'

type NoSQLDialect = 'dynamodb' | 'mongodb' | 'json'

type NestedFieldInternal = {
  id: string
  name: string
  type: string
  required: boolean
  fields?: NestedFieldInternal[]
  itemType?: string
  itemFields?: NestedFieldInternal[]
}

export const DialectIdSchema = z.union([
  z.literal<NoSQLDialect>('dynamodb'),
  z.literal<NoSQLDialect>('mongodb'),
  z.literal<NoSQLDialect>('json'),
])

export const EditorSupportedDialectSchema = DialectIdSchema.or(
  z.literal('nosql')
)

export const BasicDetailsSchema = z.object({
  name: z.string(),
  description: z.string(),
})

export const NestedFieldSchema: z.ZodType<NestedFieldInternal> = z.lazy(() =>
  z.object({
    id: z.string(),
    name: z.string(),
    type: z.string(),
    required: z.boolean(),
    fields: z.array(NestedFieldSchema).optional(),
    itemType: z.string().optional(),
    itemFields: z.array(NestedFieldSchema).optional(),
  })
)

export const NoSqlFieldSchema = z.lazy(() =>
  z.object({
    id: z.string(),
    name: z.string(),
    type: z.string(),
    required: z.boolean(),
    isArray: z.boolean(),
    reference: z
      .object({
        collectionId: z.string(),
        fieldId: z.string().optional(),
      })
      .optional(),
    notes: z.string().optional(),
    fields: z.array(NestedFieldSchema).optional(),
    itemType: z.string().optional(),
    itemFields: z.array(NestedFieldSchema).optional(),
  })
)

export const DocumentIndexSchema = z.object({
  id: z.string(),
  name: z.string(),
  fields: z.array(z.string()),
  unique: z.boolean(),
  ttl: z.string().optional(),
})

export const DocumentCollectionSchema = z.object({
  id: z.string(),
  name: z.string(),
  label: z.string().optional(),
  description: z.string().optional(),
  tags: z.string().optional(),
  fields: z.array(NoSqlFieldSchema),
  indexes: z.array(DocumentIndexSchema),
  sample: z.string().optional(),
})

type MongoNestedFieldInternal = {
  id: string
  name: string
  type: string
  required: boolean
  fields?: MongoNestedFieldInternal[]
  itemType?: string
  itemFields?: MongoNestedFieldInternal[]
  refCollectionId?: string | null
}

export const MongoNestedFieldSchema: z.ZodType<MongoNestedFieldInternal> =
  z.lazy(() =>
    z.object({
      id: z.string(),
      name: z.string(),
      type: z.string(),
      required: z.boolean(),
      fields: z.array(MongoNestedFieldSchema).optional(),
      itemType: z.string().optional(),
      itemFields: z.array(MongoNestedFieldSchema).optional(),
      refCollectionId: z.string().nullable().optional(),
    })
  )

export const MongoIndexFieldSchema = z.object({
  id: z.string(),
  fieldName: z.string(),
  order: z.union([z.literal(1), z.literal(-1)]),
})

export const MongoIndexSchema = z.object({
  id: z.string(),
  name: z.string(),
  fields: z.array(MongoIndexFieldSchema),
  unique: z.boolean(),
})

export const MongoCollectionSchema = z.object({
  id: z.string(),
  name: z.string(),
  tags: z.string(),
  description: z.string(),
  fields: z.array(MongoNestedFieldSchema),
  indexes: z.array(MongoIndexSchema),
})

type DynamoAttributeInternal = {
  id: string
  name: string
  type: string
  required: boolean
  notes?: string
  fields?: DynamoAttributeInternal[]
  itemType?: string
  itemFields?: DynamoAttributeInternal[]
}

export const DynamoGsiSchema = z.object({
  id: z.string(),
  name: z.string(),
  partitionKey: z.string(),
  partitionKeyType: z.string().optional(),
  sortKey: z.string().optional(),
  sortKeyType: z.string().optional(),
})

export const DynamoAttributeSchema: z.ZodType<DynamoAttributeInternal> = z.lazy(
  () =>
    z.object({
      id: z.string(),
      name: z.string(),
      type: z.string(),
      required: z.boolean(),
      notes: z.string().optional(),
      fields: z.array(DynamoAttributeSchema).optional(),
      itemType: z.string().optional(),
      itemFields: z.array(DynamoAttributeSchema).optional(),
    })
)

export const DynamoEditorSchema = BasicDetailsSchema.extend({
  dialect: z.literal('dynamodb'),
  primaryKey: z.object({
    partitionKey: z.string(),
    partitionKeyType: z.string().optional(),
    sortKey: z.string(),
    sortKeyType: z.string().optional(),
  }),
  globalSecondaryIndexes: z.array(DynamoGsiSchema),
  attributes: z.array(DynamoAttributeSchema),
})

export const MongoEditorSchema = BasicDetailsSchema.extend({
  dialect: z.literal('mongodb'),
  collections: z.array(MongoCollectionSchema),
})

export const JsonEditorSchema = BasicDetailsSchema.extend({
  dialect: z.literal('json'),
  collections: z.array(DocumentCollectionSchema),
})
