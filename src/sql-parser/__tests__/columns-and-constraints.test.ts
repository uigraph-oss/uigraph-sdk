import { describe, expect, it } from 'vitest'
import { SqlToAstParser } from '../ast-parser'
import type {
  ColumnAST,
  DataTypeAST,
  ForeignKeyConstraintAST,
  PrimaryKeyConstraintAST,
  SchemaAST,
  TableAST,
  UniqueConstraintAST,
} from '../types'

describe('columns and constraints - inline parsing', () => {
  it('parses simple table with one column', () => {
    const sql = `
      CREATE TABLE users (
        id INT
      );
    `
    const parser = new SqlToAstParser('mysql')
    const ast: SchemaAST = parser.parse(sql)
    expect(ast.tables.length).toBe(1)
    const table: TableAST = ast.tables[0]
    expect(table.name).toBe('users')
    expect(table.columns.length).toBe(1)
    const idCol: ColumnAST = table.columns[0]
    expect(idCol.name).toBe('id')
    expect(idCol.dataType.name).toBe('INT')
    expect(idCol.nullable).toBe(true)
  })

  it('parses quoted identifiers', () => {
    const sql = `
      CREATE TABLE "Accounts" (
        "UserId" INTEGER NOT NULL,
        "Name" VARCHAR(50)
      );
    `
    const parser = new SqlToAstParser('postgresql')
    const ast = parser.parse(sql)
    expect(ast.tables[0].name).toBe('Accounts')
    expect(ast.tables[0].columns.map((c) => c.name)).toEqual(['UserId', 'Name'])
  })

  it('parses primary key constraint inline', () => {
    const sql = `
      CREATE TABLE t1 (
        id INT PRIMARY KEY,
        name TEXT
      );
    `
    const parser = new SqlToAstParser()
    const ast = parser.parse(sql)
    const t = ast.tables[0]
    const pk = t.constraints.find((c) => c.type === 'primary_key') as
      | PrimaryKeyConstraintAST
      | undefined
    expect(pk?.columns).toEqual(['id'])
    const idCol = t.columns.find((c) => c.name === 'id')!
    expect(idCol.nullable).toBe(false)
  })

  it('parses primary key constraint as separate clause', () => {
    const sql = `
      CREATE TABLE t2 (
        id INT,
        name TEXT,
        PRIMARY KEY (id, name)
      );
    `
    const parser = new SqlToAstParser()
    const ast = parser.parse(sql)
    const pk = ast.tables[0].constraints.find(
      (c) => c.type === 'primary_key'
    ) as PrimaryKeyConstraintAST | undefined
    expect(pk?.columns).toEqual(['id', 'name'])
  })

  it('parses unique constraint inline and as table constraint', () => {
    const sql = `
      CREATE TABLE t3 (
        email VARCHAR(255) UNIQUE,
        username VARCHAR(64),
        CONSTRAINT uq_user UNIQUE (username)
      );
    `
    const parser = new SqlToAstParser()
    const ast = parser.parse(sql)
    const uniques = ast.tables[0].constraints.filter(
      (c) => c.type === 'unique'
    ) as UniqueConstraintAST[]
    expect(uniques.length).toBe(2)
    const cols = uniques.flatMap((u) => u.columns)
    expect(cols.sort()).toEqual(['email', 'username'].sort())
  })

  it('parses foreign key inline on single column', () => {
    const sql = `
      CREATE TABLE orders (
        id INT PRIMARY KEY,
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE ON UPDATE RESTRICT
      );
    `
    const parser = new SqlToAstParser()
    const ast = parser.parse(sql)
    const t = ast.tables[0]
    const fk = t.constraints.find((c) => c.type === 'foreign_key') as
      | ForeignKeyConstraintAST
      | undefined
    expect(fk?.columns).toEqual(['user_id'])
    expect(fk?.referencedTable).toBe('users')
    expect(fk?.referencedColumns).toEqual(['id'])
    expect(fk?.onDelete).toBe('CASCADE')
    expect(fk?.onUpdate).toBe('RESTRICT')
  })

  it('parses foreign key as table constraint with name', () => {
    const sql = `
      CREATE TABLE order_items (
        order_id INT,
        product_id INT,
        CONSTRAINT fk_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
      );
    `
    const parser = new SqlToAstParser()
    const ast = parser.parse(sql)
    const fk = ast.tables[0].constraints.find(
      (c) => c.type === 'foreign_key'
    ) as ForeignKeyConstraintAST | undefined
    expect(fk?.name).toBe('fk_order')
    expect(fk?.onDelete).toBe('SET NULL')
  })

  it('parses multiple constraints and columns with commas inside parentheses', () => {
    const sql = `
      CREATE TABLE metrics (
        id INT PRIMARY KEY,
        payload JSON,
        value NUMERIC(12, 5) NOT NULL,
        UNIQUE (value)
      );
    `
    const parser = new SqlToAstParser('postgresql')
    const ast = parser.parse(sql)
    const t = ast.tables[0]
    expect(
      t.columns.find((c) => c.name === 'value')?.dataType.parameters
    ).toEqual([12, 5])
    expect(t.constraints.some((c) => c.type === 'unique')).toBe(true)
  })

  it('parses auto increment and nullability rules', () => {
    const sql = `
      CREATE TABLE seqs (
        id SERIAL,
        id2 BIGSERIAL,
        id3 INTEGER AUTOINCREMENT,
        id4 INTEGER AUTO_INCREMENT
      );
    `
    const parser = new SqlToAstParser('postgresql')
    const ast = parser.parse(sql)
    const t = ast.tables[0]
    const names = ['id', 'id2', 'id3', 'id4']
    for (const n of names) {
      const col = t.columns.find((c) => c.name === n)!
      expect(col.autoIncrement).toBe(true)
      expect(col.nullable).toBe(false)
    }
  })

  it('parses default values: number, string, function, null, expression', () => {
    const sql = `
      CREATE TABLE defaults (
        a INT DEFAULT 0,
        b VARCHAR(10) DEFAULT 'x',
        c TIMESTAMP DEFAULT now(),
        d TEXT DEFAULT NULL,
        e TEXT DEFAULT CURRENT_DATE,
        f TEXT DEFAULT 123.45
      );
    `
    const parser = new SqlToAstParser('postgresql')
    const ast = parser.parse(sql)
    const t = ast.tables[0]
    const a = t.columns.find((c) => c.name === 'a')!
    const b = t.columns.find((c) => c.name === 'b')!
    const c = t.columns.find((c) => c.name === 'c')!
    const d = t.columns.find((c) => c.name === 'd')!
    const e = t.columns.find((c) => c.name === 'e')!
    const f = t.columns.find((c) => c.name === 'f')!
    expect(a.defaultValue?.type).toBe('literal')
    expect(b.defaultValue?.type).toBe('literal')
    expect(c.defaultValue?.type).toBe('function')
    expect(d.defaultValue?.type).toBe('literal')
    expect(e.defaultValue?.type).toBe('expression')
    expect(f.defaultValue?.type).toBe('literal')
  })

  it('parses collate and charset attributes', () => {
    const sql = `
      CREATE TABLE attrs (
        name VARCHAR(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci
      ) ENGINE=InnoDB;
    `
    const parser = new SqlToAstParser('mysql')
    const ast = parser.parse(sql)
    const col = ast.tables[0].columns[0]
    expect(col.charset).toBe('utf8mb4')
    expect(col.collation).toBe('utf8mb4_general_ci')
  })

  it('parses comment on column and table options', () => {
    const sql = `
      CREATE TABLE comments (
        id INT COMMENT 'primary id'
      ) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin COMMENT='hello';
    `
    const parser = new SqlToAstParser('mysql')
    const ast = parser.parse(sql)
    const t = ast.tables[0]
    expect(t.columns[0].comment).toBe('primary id')
    expect(t.options?.engine).toBe('InnoDB')
    expect(t.options?.autoIncrement).toBe(10)
    expect(t.options?.charset).toBe('utf8mb4')
    expect(t.options?.collation).toBe('utf8mb4_bin')
    expect(t.options?.comment).toBe('hello')
  })

  it('handles schema-qualified and bracketed identifiers', () => {
    const sql = `
      CREATE TABLE [dbo].[Things] (
        [Key] INT PRIMARY KEY,
        [Val] NVARCHAR(100)
      );
    `
    const parser = new SqlToAstParser('sqlite')
    const ast = parser.parse(sql)
    expect(ast.tables[0].name).toBe('Things')
    const pk = ast.tables[0].constraints.find(
      (c) => c.type === 'primary_key'
    ) as PrimaryKeyConstraintAST | undefined
    expect(pk?.columns).toEqual(['Key'])
  })

  it('parses mixed quoting in foreign key reference', () => {
    const sql = `
      CREATE TABLE child (
        parent_id INT,
        CONSTRAINT fk_p FOREIGN KEY (parent_id) REFERENCES "Parent"([Id])
      );
    `
    const parser = new SqlToAstParser('postgresql')
    const ast = parser.parse(sql)
    const fk = ast.tables[0].constraints.find(
      (c) => c.type === 'foreign_key'
    ) as ForeignKeyConstraintAST | undefined
    expect(fk?.referencedTable).toBe('Parent')
    expect(fk?.referencedColumns).toEqual(['Id'])
  })

  it('detects dialect automatically for mysql characteristics', () => {
    const sql = `
      CREATE TABLE t (
        id INT AUTO_INCREMENT PRIMARY KEY
      ) ENGINE=InnoDB;
    `
    const dialect = SqlToAstParser.detectDialect(sql)
    expect(dialect).toBe('mysql')
  })

  it('defaults to mysql when unknown dialect markers are not present', () => {
    const sql = `
      CREATE TABLE t ( id INT );
    `
    const dialect = SqlToAstParser.detectDialect(sql)
    expect(dialect).toBe('mysql')
  })

  it('detects postgresql via serial and casts', () => {
    const sql = `
      CREATE TABLE t (
        id SERIAL PRIMARY KEY,
        price NUMERIC(10,2)::NUMERIC
      );
    `
    const dialect = SqlToAstParser.detectDialect(sql)
    expect(dialect).toBe('postgresql')
  })
})

describe('complex bodies and splitting logic', () => {
  it('splits on top-level commas only with nested parentheses', () => {
    const sql = `
      CREATE TABLE x (
        a INT,
        b DECIMAL(10, 2),
        c VARCHAR(10),
        d CHECK ((a + (1)) > 0),
        e INT,
        PRIMARY KEY (a, e)
      );
    `
    const parser = new SqlToAstParser('postgresql')
    const ast = parser.parse(sql)
    const t = ast.tables[0]
    expect(t.columns.length).toBe(4)
    const pk = t.constraints.find((c) => c.type === 'primary_key') as
      | PrimaryKeyConstraintAST
      | undefined
    expect(pk?.columns).toEqual(['a', 'e'])
  })

  it('parses inline unique but not for UNIQUE KEY', () => {
    const sql = `
      CREATE TABLE y (
        email VARCHAR(255) UNIQUE,
        UNIQUE KEY uq_email (email)
      );
    `
    const parser = new SqlToAstParser('mysql')
    const ast = parser.parse(sql)
    const uniques = ast.tables[0].constraints.filter((c) => c.type === 'unique')
    expect(uniques.length).toBe(1)
    expect((uniques[0] as UniqueConstraintAST).columns).toEqual(['email'])
  })
})

describe('ALTER TABLE application', () => {
  it('applies added foreign key via ALTER TABLE', () => {
    const sql = `
      CREATE TABLE parent ( id INT PRIMARY KEY );
      CREATE TABLE child ( pid INT );
      ALTER TABLE child ADD CONSTRAINT fk1 FOREIGN KEY (pid) REFERENCES parent(id) ON DELETE CASCADE ON UPDATE NO ACTION;
    `
    const parser = new SqlToAstParser('mysql')
    const ast = parser.parse(sql)
    const child = ast.tables.find((t) => t.name === 'child')!
    const fk = child.constraints.find((c) => c.type === 'foreign_key') as
      | ForeignKeyConstraintAST
      | undefined
    expect(fk?.name).toBe('fk1')
    expect(fk?.onDelete).toBe('CASCADE')
    expect(fk?.onUpdate).toBe('NO ACTION')
  })

  it('applies added unique and index via ALTER TABLE', () => {
    const sql = `
      CREATE TABLE t ( a INT, b INT );
      ALTER TABLE t ADD CONSTRAINT uq_ab UNIQUE (a, b);
      ALTER TABLE t ADD INDEX idx_a (a);
    `
    const parser = new SqlToAstParser('mysql')
    const ast = parser.parse(sql)
    const t = ast.tables[0]
    const uq = t.constraints.find((c) => c.type === 'unique') as
      | UniqueConstraintAST
      | undefined
    expect(uq?.columns).toEqual(['a', 'b'])
    expect(t.indexes.some((i) => i.name === 'idx_a')).toBe(true)
  })
})

describe('data type parsing nuances', () => {
  it('parses parameters as numbers when numeric', () => {
    const sql = `
      CREATE TABLE t ( a DECIMAL(12,3), b VARCHAR(10) );
    `
    const parser = new SqlToAstParser('mysql')
    const ast = parser.parse(sql)
    const a = ast.tables[0].columns.find((c) => c.name === 'a')!.dataType
    const b = ast.tables[0].columns.find((c) => c.name === 'b')!.dataType
    expect(a.parameters).toEqual([12, 3])
    expect(b.parameters).toEqual([10])
  })

  it('parses modifiers like UNSIGNED and WITH TIME ZONE', () => {
    const sql = `
      CREATE TABLE t (
        a INT UNSIGNED,
        b TIMESTAMP WITH TIME ZONE
      );
    `
    const parser = new SqlToAstParser('postgresql')
    const ast = parser.parse(sql)
    const a: DataTypeAST = ast.tables[0].columns.find(
      (c) => c.name === 'a'
    )!.dataType
    const b: DataTypeAST = ast.tables[0].columns.find(
      (c) => c.name === 'b'
    )!.dataType
    expect(a.unsigned).toBe(true)
    expect(b.timezone).toBe(true)
  })
})
