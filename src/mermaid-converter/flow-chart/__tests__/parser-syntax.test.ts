import { describe, expect, it } from 'vitest'
import { parseMermaidCode } from '../parser'

describe('node shapes beyond the common three', () => {
  it('reads a double parenthesis node as a circle', () => {
    const { nodes } = parseMermaidCode('flowchart LR\n  A((Cache)) --> B')

    expect(nodes.find((node) => node.id === 'A')?.shape).toBe('circle')
  })

  it('reads a bracket inside parentheses as a stadium', () => {
    const { nodes } = parseMermaidCode('flowchart LR\n  A([Start]) --> B')

    expect(nodes.find((node) => node.id === 'A')?.shape).toBe('stadium')
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
