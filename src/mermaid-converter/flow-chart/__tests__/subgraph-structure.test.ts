import { describe, expect, it } from 'vitest'
import { parseMermaidCode } from '../parser'

describe('how a subgraph gets its id and title', () => {
  it('keeps the id when a human title is given in brackets', () => {
    const { subgraphs } = parseMermaidCode(
      'flowchart LR\n  subgraph S1 [Human Title]\n    A\n  end'
    )

    expect(subgraphs[0].id).toBe('S1')
    expect(subgraphs[0].title).toBe('Human Title')
  })

  it('slugs an id out of a bare title that has spaces in it', () => {
    const { subgraphs } = parseMermaidCode(
      'flowchart LR\n  subgraph Component C\n    A\n  end'
    )

    expect(subgraphs[0].id).toBe('component-c')
    expect(subgraphs[0].title).toBe('Component C')
  })

  it.fails('takes a quoted title that follows an explicit id', () => {
    const { subgraphs } = parseMermaidCode(
      'flowchart LR\n  subgraph S1 "My Module"\n    A\n  end'
    )

    expect(subgraphs[0].title).toBe('My Module')
  })

  it('gives a subgraph its own direction without moving the diagram', () => {
    const { subgraphs, direction } = parseMermaidCode(
      'flowchart TB\n  subgraph S1\n    direction LR\n    A --> B\n  end'
    )

    expect(direction).toBe('TB')
    expect(subgraphs[0].direction).toBe('LR')
  })
})

describe('containment', () => {
  it('remembers the grandparent of a node buried three levels deep', () => {
    const { nodes, subgraphs } = parseMermaidCode(
      'flowchart LR\n  subgraph outer\n    subgraph middle\n      subgraph inner\n        A\n      end\n    end\n  end'
    )

    expect(nodes[0].subgraph).toBe('inner')
    expect(nodes[0].parentSubgraph).toBe('middle')
    expect(subgraphs.find((sub) => sub.id === 'middle')?.parentId).toBe('outer')
    expect(subgraphs.find((sub) => sub.id === 'outer')?.nodes).toEqual([])
  })

  it.fails(
    'adopts a node that was first mentioned outside the subgraph',
    () => {
      const { nodes } = parseMermaidCode(
        'flowchart LR\n  A --> B\n  subgraph S\n    A\n  end'
      )

      expect(nodes.find((node) => node.id === 'A')?.subgraph).toBe('S')
    }
  )

  it('carries on reading the diagram after an end that closes nothing', () => {
    const { nodes, edges, subgraphs } = parseMermaidCode(
      'flowchart LR\n  A --> B\n  end\n  B --> C'
    )

    expect(nodes.map((node) => node.id)).toEqual(['A', 'B', 'C'])
    expect(edges).toHaveLength(2)
    expect(subgraphs).toHaveLength(0)
  })
})

describe('subgraphs as edge endpoints', () => {
  it('marks both ends as containers and invents no nodes for them', () => {
    const { nodes, edges } = parseMermaidCode(
      'flowchart LR\n  subgraph S1\n    A\n  end\n  subgraph S2\n    B\n  end\n  S1 --> S2'
    )

    expect(nodes.map((node) => node.id)).toEqual(['A', 'B'])
    expect(edges[0].isSourceSubgraph).toBe(true)
    expect(edges[0].isTargetSubgraph).toBe(true)
  })
})
