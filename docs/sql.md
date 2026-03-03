---
title: SQL SDK Guide
description: Use the SDK to parse SQL into AST and render database diagrams in React Flow.
slug: /sdk/sql
---

# SQL SDK Guide

Use the SQL SDK to parse SQL, convert schema AST into diagram data, update diagrams, and generate SQL. This page covers only: `SchemaDialect`, `SqlToAstParser`, `AstToUiConverter`, and `AstToSqlGenerator`.

## SchemaDialect

Supported dialect values used across parsing and generation.

- `mysql` — MySQL schemas
- `postgresql` — PostgreSQL schemas
- `sqlite` — SQLite schemas
- `json` — JSON schema mode
- `mongodb` — MongoDB schema mode
- `dynamodb` — DynamoDB schema mode

## SqlToAstParser

Parses SQL into a structured schema AST. Use this as the entry point for any SQL input.

### API

- `SqlToAstParser.detectDialect(sql: string): SchemaDialect`
- `new SqlToAstParser(dialect: SchemaDialect)`
- `parse(sql: string): SchemaAST`

### Example: Detect Dialect and Parse

```ts
const dialect = SqlToAstParser.detectDialect(sql)
const parser = new SqlToAstParser(dialect)
const ast = parser.parse(sql)
```

### Example: Parse With Explicit Dialect

```ts
const parser = new SqlToAstParser('postgresql')
const ast = parser.parse(sql)
```

### Example: Parse With Basic Error Handling

```ts
try {
  const dialect = SqlToAstParser.detectDialect(sql)
  const ast = new SqlToAstParser(dialect).parse(sql)
} catch (error) {
  console.error('Invalid SQL', error)
}
```

## AstToUiConverter

Converts a schema AST into diagram data, or updates existing diagram data after SQL changes.

### API

- `AstToUiConverter.toReactFlow(schemaAst: SchemaAST, sourceId: string)`
- `AstToUiConverter.updateReactFlow(options)`

### Example: Convert AST to Diagram Data

```ts
const diagram = AstToUiConverter.toReactFlow(ast, sourceId)
// diagram: { nodes: [...], edges: [...] }
```

### Example: Update Diagram After SQL Edits

```ts
const dialect = SqlToAstParser.detectDialect(editedSql)
const newAst = new SqlToAstParser(dialect).parse(editedSql)

const updated = AstToUiConverter.updateReactFlow({
  nodes: existingNodes,
  edges: existingEdges,
  sourceId,
  schema: newAst,
  oldDataSources,
})
// updated: { nodes: [...], edges: [...] }
```

### Example: Parse and Convert in One Flow

```ts
const dialect = SqlToAstParser.detectDialect(sql)
const ast = new SqlToAstParser(dialect).parse(sql)
const diagram = AstToUiConverter.toReactFlow(ast, sourceId)
```

## AstToSqlGenerator

Generates SQL output from a schema AST.

### API

- `new AstToSqlGenerator(dialect: SchemaDialect)`
- `generate(schemaAst: SchemaAST): string`

### Example: Generate SQL

```ts
const generator = new AstToSqlGenerator(ast.dialect)
const sqlOut = generator.generate(ast)
```

### Example: Generate SQL With Explicit Dialect

```ts
const generator = new AstToSqlGenerator('postgresql')
const sqlOut = generator.generate(ast)
```

## Practical Examples

### Example: Raw SQL to Diagram Data

```ts
const dialect = SqlToAstParser.detectDialect(sql)
const ast = new SqlToAstParser(dialect).parse(sql)
const diagram = AstToUiConverter.toReactFlow(ast, sourceId)
// diagram: { nodes: [...], edges: [...] }
```

### Example: Diagram Data to SQL

This requires a `SchemaAST`. If your diagram already has a schema source, use that AST directly.

```ts
const generator = new AstToSqlGenerator(dialect)
const sqlOut = generator.generate(schemaAst)
```
