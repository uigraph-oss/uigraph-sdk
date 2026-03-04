import { generateUUID } from 'daily-code'
import { z } from 'zod'
import { SchemaAST, TableAST } from '../sql-parser'
import {
  DynamoEditorSchema,
  JsonEditorSchema,
  MongoEditorSchema,
  MongoNestedFieldSchema,
  NestedFieldSchema,
  NoSqlFieldSchema,
} from './nosql-schema'

function mapDynamoTypeToAstType(dynamoType: string): string {
  switch (dynamoType) {
    case 'S':
      return 'string'
    case 'N':
      return 'number'
    case 'B':
      return 'binary'
    default:
      return 'string'
  }
}

export function convertDynamoSchemaToAst(
  schema: z.infer<typeof DynamoEditorSchema>
): SchemaAST {
  const pkName = schema.primaryKey.partitionKey
  const pkType = schema.primaryKey.partitionKeyType
  const skName = schema.primaryKey.sortKey
  const skType = schema.primaryKey.sortKeyType

  const mergedAttributes: Array<{
    id: string
    name: string
    type: string
    required: boolean
    notes?: string
    fields?: typeof mergedAttributes
    itemType?: string
    itemFields?: typeof mergedAttributes
  }> = []
  const attributeByName = new Map<string, (typeof mergedAttributes)[number]>()

  ;(schema.attributes || []).forEach((attribute) => {
    const key = attribute.name.trim()
    if (!key || attributeByName.has(key)) return
    attributeByName.set(key, attribute)
    mergedAttributes.push(attribute)
  })

  const tableName = schema.name?.trim() || 'dynamodb_table'

  const baseColumns: TableAST['columns'] = [
    {
      type: 'column' as const,
      name: pkName,
      dataType: { name: mapDynamoTypeToAstType(pkType || 'string') },
      nullable: false,
      comment: undefined,
    },
  ]

  if (skName) {
    baseColumns.push({
      type: 'column' as const,
      name: skName,
      dataType: { name: mapDynamoTypeToAstType(skType || 'string') },
      nullable: false,
      comment: undefined,
    })
  }

  const attributeColumns = mergedAttributes.map((attribute) => ({
    type: 'column' as const,
    name: attribute.name,
    dataType: { name: attribute.type },
    nullable: !attribute.required,
    comment: attribute.notes,
  }))

  const indexes = schema.globalSecondaryIndexes.map((gsi) => ({
    type: 'index' as const,
    name: gsi.name || 'gsi',
    columns: [
      { name: gsi.partitionKey || pkName },
      ...(gsi.sortKey ? [{ name: gsi.sortKey }] : []),
    ],
    unique: false,
  }))

  const table: TableAST = {
    type: 'table',
    id: generateUUID(),
    name: tableName,
    columns: [...baseColumns, ...attributeColumns],
    constraints: [
      {
        type: 'primary_key',
        columns: skName ? [pkName, skName] : [pkName],
      },
    ],
    indexes,
    options: {
      comment: schema.description,
    },
  }

  return {
    dialect: 'dynamodb',
    tables: [table],
    metadata: {
      createdAt: new Date(),
    },
  }
}

export function convertMongoSchemaToAst(
  schema: z.infer<typeof MongoEditorSchema>
): SchemaAST {
  const tables: TableAST[] = schema.collections.map((collection) => {
    function buildColumnsFromField(
      field: z.infer<typeof MongoNestedFieldSchema>,
      prefix = ''
    ): TableAST['columns'] {
      const columns: TableAST['columns'] = []
      const columnName = prefix ? `${prefix}.${field.name}` : field.name

      if (field.type === 'array') {
        const itemType = field.itemType || 'string'
        if (itemType === 'object' && field.itemFields) {
          field.itemFields.forEach(
            (itemField: z.infer<typeof MongoNestedFieldSchema>) => {
              columns.push(
                ...buildColumnsFromField(itemField, `${columnName}[]`)
              )
            }
          )
        } else {
          columns.push({
            type: 'column' as const,
            name: columnName,
            dataType: { name: `${itemType}[]` },
            nullable: !field.required,
          })
        }
      } else if (field.type === 'object' && field.fields) {
        field.fields.forEach(
          (nestedField: z.infer<typeof MongoNestedFieldSchema>) => {
            columns.push(...buildColumnsFromField(nestedField, columnName))
          }
        )
      } else {
        columns.push({
          type: 'column' as const,
          name: columnName,
          dataType: { name: field.type },
          nullable: !field.required,
        })
      }

      return columns
    }

    const columns = collection.fields.flatMap((field) =>
      buildColumnsFromField(field)
    )

    const indexes = collection.indexes.map((index) => ({
      type: 'index' as const,
      name: index.name || `idx_${collection.name}`,
      columns: index.fields.map((field) => ({
        name: field.fieldName,
      })),
      unique: index.unique,
    }))

    return {
      type: 'table',
      id: collection.id,
      name: collection.name,
      columns,
      constraints: [],
      indexes,
      options: {
        comment: collection.description,
      },
    }
  })

  return {
    dialect: 'mongodb',
    tables,
    metadata: {
      createdAt: new Date(),
    },
  }
}

export function convertJsonSchemaToAst(
  schema: z.infer<typeof JsonEditorSchema>
): SchemaAST {
  function buildColumnFromField(
    field: z.infer<typeof NoSqlFieldSchema> | z.infer<typeof NestedFieldSchema>,
    prefix = ''
  ): TableAST['columns'] {
    const columns: TableAST['columns'] = []
    const columnName = prefix ? `${prefix}.${field.name}` : field.name

    if (field.type === 'array') {
      const itemType = field.itemType || 'string'
      if (itemType === 'object' && field.itemFields) {
        field.itemFields.forEach(
          (itemField: z.infer<typeof NestedFieldSchema>) => {
            columns.push(...buildColumnFromField(itemField, `${columnName}[]`))
          }
        )
      } else {
        columns.push({
          type: 'column' as const,
          name: columnName,
          dataType: { name: `${itemType}[]` },
          nullable: !field.required,
          comment: 'notes' in field ? field.notes : undefined,
        })
      }
    } else if (field.type === 'object' && field.fields) {
      field.fields.forEach((nestedField: z.infer<typeof NestedFieldSchema>) => {
        columns.push(...buildColumnFromField(nestedField, columnName))
      })
    } else {
      columns.push({
        type: 'column' as const,
        name: columnName,
        dataType: { name: field.type },
        nullable: !field.required,
        comment: 'notes' in field ? field.notes : undefined,
      })
    }

    return columns
  }

  const tables: TableAST[] = schema.collections.map((collection) => {
    const columns = collection.fields.flatMap((field) =>
      buildColumnFromField(field)
    )

    const constraints = collection.fields
      .filter((field) => field.reference?.collectionId)
      .map((field) => {
        const target = schema.collections.find(
          (c) => c.id === field.reference?.collectionId
        )
        const targetField = target?.fields.find(
          (f) => f.id === field.reference?.fieldId
        )
        return {
          type: 'foreign_key' as const,
          columns: [field.name],
          referencedTable: target?.name || '',
          referencedColumns: targetField ? [targetField.name] : ['id'],
        }
      })

    const indexes = collection.indexes.map((index) => ({
      type: 'index' as const,
      name: index.name || `idx_${collection.name}`,
      columns: index.fields.map((field) => ({ name: field })),
      unique: index.unique,
      where: index.ttl ? `ttl:${index.ttl}` : undefined,
    }))

    return {
      type: 'table',
      id: collection.id,
      name: collection.name,
      columns,
      constraints,
      indexes,
      options: { comment: collection.description },
    }
  })

  return {
    dialect: 'json',
    tables,
    metadata: {
      createdAt: new Date(),
    },
  }
}
