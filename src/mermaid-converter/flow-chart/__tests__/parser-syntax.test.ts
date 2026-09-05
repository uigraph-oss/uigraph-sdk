import { describe, expect, it } from 'vitest'
import { parseMermaidCode } from '../parser'

describe('node shapes beyond the common three', () => {
  it('reads a double parenthesis node as a circle', () => {
    const { nodes } = parseMermaidCode('flowchart LR\n  A((Cache)) --> B')

    expect(nodes.find((node) => node.id === 'A')?.shape).toBe('circle')
  })

  it('reads a bracket inside parentheses as a stadium and strips both delimiter layers from the label', () => {
    const { nodes } = parseMermaidCode('flowchart LR\n  A([Start]) --> B')

    const nodeA = nodes.find((node) => node.id === 'A')
    expect(nodeA?.shape).toBe('stadium')
    expect(nodeA?.label).toBe('Start')
  })

  it('reads a quoted bracket inside parentheses as a stadium with a clean label', () => {
    const { nodes } = parseMermaidCode(
      'flowchart LR\n  user(["User"]) --> portal'
    )

    const user = nodes.find((node) => node.id === 'user')
    expect(user?.shape).toBe('stadium')
    expect(user?.label).toBe('User')
  })

  it('reads a parenthesis inside brackets as a cylinder with a clean label', () => {
    const { nodes } = parseMermaidCode(
      'flowchart LR\n  db[("Proposals DB")] --> api'
    )

    const db = nodes.find((node) => node.id === 'db')
    expect(db?.shape).toBe('cylinder')
    expect(db?.label).toBe('Proposals DB')
  })

  it('reads a double bracket as a subroutine with a clean label', () => {
    const { nodes } = parseMermaidCode(
      'flowchart LR\n  proc[["Process"]] --> next'
    )

    const proc = nodes.find((node) => node.id === 'proc')
    expect(proc?.shape).toBe('subroutine')
    expect(proc?.label).toBe('Process')
  })

  it('falls back to a rectangle for a node that carries no brackets', () => {
    const { nodes } = parseMermaidCode('flowchart LR\n  Solo')

    expect(nodes).toHaveLength(1)
    expect(nodes[0].shape).toBe('rect')
    expect(nodes[0].label).toBe('Solo')
  })

  it('drops a node whose bracket is never closed', () => {
    const { nodes, edges } = parseMermaidCode('flowchart LR\n  A[Unclosed')

    expect(nodes).toHaveLength(0)
    expect(edges).toHaveLength(0)
  })
})

describe('label cleaning', () => {
  it('turns a break tag into a real line break', () => {
    const { nodes } = parseMermaidCode(
      'flowchart LR\n  A[First<br/>Second] --> B'
    )

    expect(nodes.find((node) => node.id === 'A')?.label).toBe('First\nSecond')
  })

  it('drops markup tags but keeps the text they wrap', () => {
    const { nodes } = parseMermaidCode(
      'flowchart LR\n  A[<b>Bold</b> and plain] --> B'
    )

    expect(nodes.find((node) => node.id === 'A')?.label).toBe('Bold and plain')
  })

  it('resolves a unicode escape into the character it names', () => {
    const { nodes } = parseMermaidCode('flowchart LR\n  A[Caf\\u00e9] --> B')

    expect(nodes.find((node) => node.id === 'A')?.label).toBe('Café')
  })

  it('turns an escaped newline into a real line break', () => {
    const { nodes } = parseMermaidCode('flowchart LR\n  A[Top\\nBottom] --> B')

    expect(nodes.find((node) => node.id === 'A')?.label).toBe('Top\nBottom')
  })

  it('cleans an edge label the same way it cleans a node label', () => {
    const { edges } = parseMermaidCode('flowchart LR\n  A -->|yes<br/>no| B')

    expect(edges[0].label).toBe('yes\nno')
  })
})

describe('connectors', () => {
  it('connects two nodes with a line that has no arrow head at all', () => {
    const { nodes, edges } = parseMermaidCode('flowchart LR\n  A --- B')

    expect(nodes.map((node) => node.id)).toEqual(['A', 'B'])
    expect(edges).toHaveLength(1)
    expect(edges[0].source).toBe('A')
    expect(edges[0].target).toBe('B')
    expect(edges[0].label).toBe('')
  })

  it('reads a two headed arrow as a single forward edge', () => {
    const { edges } = parseMermaidCode('flowchart LR\n  A <-> B')

    expect(edges).toHaveLength(1)
    expect(edges[0].source).toBe('A')
    expect(edges[0].target).toBe('B')
    expect(edges[0].type).toBe('<->')
  })

  it('refuses a line that names two nodes with nothing between them', () => {
    const { edges } = parseMermaidCode('flowchart LR\n  A B')

    expect(edges).toHaveLength(0)
  })

  it('reads every hop of a chained arrow line, not just the first', () => {
    // A --> B --> C on one line is common, idiomatic Mermaid for a simple
    // linear flow. The edge parser used to return only the first hop,
    // silently dropping every node/edge after it.
    const { nodes, edges } = parseMermaidCode(
      'flowchart LR\n  A --> B --> C --> D'
    )

    expect(nodes.map((n) => n.id)).toEqual(['A', 'B', 'C', 'D'])
    expect(edges).toHaveLength(3)
    expect(edges.map((e) => `${e.source}->${e.target}`)).toEqual([
      'A->B',
      'B->C',
      'C->D',
    ])
  })

  it('reads a chained arrow line where each hop carries its own label', () => {
    const { edges } = parseMermaidCode('flowchart LR\n  A -->|yes| B -->|no| C')

    expect(edges.map((e) => e.label)).toEqual(['yes', 'no'])
  })

  it('reads a chained arrow line mixing compound shapes without leaking delimiters into labels', () => {
    // Regression for a real generate output: a stadium node followed by a
    // subroutine node followed by a cylinder node in one chained line used
    // to both drop the later hops AND leak a stray "]" from the doubled
    // subroutine bracket into the next edge's label.
    const code =
      'flowchart LR\n  start(["Start"]) --> etl[["ETL subroutine"]] --> dwh[("Data warehouse")] --> stop(["End"])'
    const { nodes, edges } = parseMermaidCode(code)

    expect(nodes.map((n) => n.id)).toEqual(['start', 'etl', 'dwh', 'stop'])
    expect(edges).toHaveLength(3)
    edges.forEach((e) => expect(e.label).toBe(''))
  })
})

describe('edge labels', () => {
  it('takes a pipe label that was written before the arrow', () => {
    const { edges } = parseMermaidCode('flowchart LR\n  A --|maybe|--> B')

    expect(edges[0].label).toBe('maybe')
  })

  it('prefers the pipe label after the arrow over the inline one before it', () => {
    const { edges } = parseMermaidCode(
      'flowchart LR\n  A -- before -->|after| B'
    )

    expect(edges[0].label).toBe('after')
  })

  it('reads a class suffix as styling rather than as an edge label', () => {
    const { edges } = parseMermaidCode('flowchart LR\n  A --> B:::highlight')

    expect(edges).toHaveLength(1)
    expect(edges[0].label).toBe('')
  })
})
