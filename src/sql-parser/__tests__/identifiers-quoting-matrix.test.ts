import { describe, expect, it } from 'vitest'
import { SqlToAstParser } from '../ast-parser'
import type { ForeignKeyConstraintAST, PrimaryKeyConstraintAST } from '../types'

describe('identifiers and quoting matrix', () => {
  it('backticks for mysql', () => {
    const sql = `
      CREATE TABLE \`User Accounts\` (
        \`User Id\` INT PRIMARY KEY,
        \`E-mail\` VARCHAR(200) UNIQUE
      );
    `
    const ast = new SqlToAstParser('mysql').parse(sql)
    expect(ast.tables[0].name).toBe('User Accounts')
    expect(ast.tables[0].columns.map((c) => c.name)).toEqual([
      'User Id',
      'E-mail',
    ])
  })

  it('brackets for sqlite/sqlserver-like', () => {
    const sql = `
      CREATE TABLE [S].[Employees] (
        [Emp Id] INT,
        [Dept] INT,
        CONSTRAINT [PK_Employees] PRIMARY KEY ([Emp Id]),
        CONSTRAINT [FK_Dept] FOREIGN KEY ([Dept]) REFERENCES [S].[Departments]([Id])
      );
    `
    const ast = new SqlToAstParser('sqlite').parse(sql)
    const t = ast.tables[0]
    expect(t.name).toBe('Employees')
    const pk = t.constraints.find((c) => c.type === 'primary_key') as
      | PrimaryKeyConstraintAST
      | undefined
    expect(pk?.name).toBe('PK_Employees')
    const fk = t.constraints.find((c) => c.type === 'foreign_key') as
      | ForeignKeyConstraintAST
      | undefined
    expect(fk?.name).toBe('FK_Dept')
    expect(fk?.referencedTable).toBe('Departments')
  })

  it('mixed quoting styles together', () => {
    const sql = `
      CREATE TABLE "A"."B" (
        \`K\` INT PRIMARY KEY,
        'C' TEXT
      );
    `
    const ast = new SqlToAstParser('postgresql').parse(sql)
    expect(ast.tables[0].name).toBe('B')
    const cols = ast.tables[0].columns.map((c) => c.name).sort()
    expect(cols).toEqual(['C', 'K'].sort())
  })

  it('schema-qualified references resolve to table name', () => {
    const sql = `
      CREATE TABLE child (
        pid INT,
        CONSTRAINT fk FOREIGN KEY (pid) REFERENCES "a"."parent"("id")
      );
    `
    const ast = new SqlToAstParser('postgresql').parse(sql)
    const fk = ast.tables[0].constraints.find(
      (c) => c.type === 'foreign_key'
    ) as ForeignKeyConstraintAST | undefined
    expect(fk?.referencedTable).toBe('parent')
  })

  it('case sensitivity preserved in names', () => {
    const sql = `
      CREATE TABLE "MiXeD" (
        "ColA" INT,
        "ColB" INT
      );
    `
    const ast = new SqlToAstParser('postgresql').parse(sql)
    expect(ast.tables[0].name).toBe('MiXeD')
    expect(ast.tables[0].columns.map((c) => c.name)).toEqual(['ColA', 'ColB'])
  })
})
