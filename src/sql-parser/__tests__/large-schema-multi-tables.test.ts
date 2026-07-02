import { describe, expect, it } from 'vitest'
import { SqlToAstParser } from '../ast-parser'
import type { ForeignKeyConstraintAST, PrimaryKeyConstraintAST } from '../types'

describe('large schema with multiple tables', () => {
  it('parses many related tables', () => {
    const sql = `
      CREATE TABLE users (
        id INT PRIMARY KEY,
        email VARCHAR(200) UNIQUE,
        created_at TIMESTAMP DEFAULT now()
      );
      CREATE TABLE teams (
        id INT PRIMARY KEY,
        name VARCHAR(100) UNIQUE
      );
      CREATE TABLE user_teams (
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        team_id INT REFERENCES teams(id) ON DELETE CASCADE,
        role VARCHAR(50),
        PRIMARY KEY (user_id, team_id)
      );
      CREATE TABLE projects (
        id INT PRIMARY KEY,
        team_id INT,
        name VARCHAR(200),
        CONSTRAINT fk_team FOREIGN KEY (team_id) REFERENCES teams(id)
      );
      CREATE TABLE tasks (
        id INT PRIMARY KEY,
        project_id INT,
        assignee INT,
        CONSTRAINT fk_proj FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
        CONSTRAINT fk_user FOREIGN KEY (assignee) REFERENCES users(id)
      );
    `
    const ast = new SqlToAstParser('postgresql').parse(sql)
    expect(ast.tables.length).toBe(5)
    const users = ast.tables.find((t) => t.name === 'users')!
    const teams = ast.tables.find((t) => t.name === 'teams')!
    const userTeams = ast.tables.find((t) => t.name === 'user_teams')!
    const projects = ast.tables.find((t) => t.name === 'projects')!
    const tasks = ast.tables.find((t) => t.name === 'tasks')!

    expect(
      (
        users.constraints.find((c) => c.type === 'primary_key') as
          | PrimaryKeyConstraintAST
          | undefined
      )?.columns
    ).toEqual(['id'])
    expect(
      (
        teams.constraints.find((c) => c.type === 'primary_key') as
          | PrimaryKeyConstraintAST
          | undefined
      )?.columns
    ).toEqual(['id'])
    expect(
      (
        userTeams.constraints.find((c) => c.type === 'primary_key') as
          | PrimaryKeyConstraintAST
          | undefined
      )?.columns.sort()
    ).toEqual(['team_id', 'user_id'].sort())

    const utFks = userTeams.constraints.filter(
      (c) => c.type === 'foreign_key'
    ) as ForeignKeyConstraintAST[]
    expect(utFks.length).toBe(2)
    const projFk = projects.constraints.find(
      (c) => c.type === 'foreign_key'
    ) as ForeignKeyConstraintAST | undefined
    expect(projFk?.referencedTable).toBe('teams')
    const taskFks = tasks.constraints.filter(
      (c) => c.type === 'foreign_key'
    ) as ForeignKeyConstraintAST[]
    expect(taskFks.map((f) => f.referencedTable).sort()).toEqual(
      ['projects', 'users'].sort()
    )
  })

  it('handles indexes across many tables', () => {
    const sql = `
      CREATE TABLE a ( id INT, x INT );
      CREATE TABLE b ( id INT, y INT );
      CREATE TABLE c ( id INT, z INT );
      ALTER TABLE a ADD INDEX i_x (x);
      ALTER TABLE b ADD INDEX i_y (y);
      ALTER TABLE c ADD INDEX i_z (z);
    `
    const ast = new SqlToAstParser('mysql').parse(sql)
    expect(ast.tables.find((t) => t.name === 'a')!.indexes[0].name).toBe('i_x')
    expect(ast.tables.find((t) => t.name === 'b')!.indexes[0].name).toBe('i_y')
    expect(ast.tables.find((t) => t.name === 'c')!.indexes[0].name).toBe('i_z')
  })
})
