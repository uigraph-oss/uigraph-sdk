import { Edge, Node } from '@xyflow/react'
import { describe, expect, it } from 'vitest'
import { ComponentInputType } from '../../components/component-type'
import {
  buildMermaidEdgeLines,
  buildMermaidNodeLines,
} from '../mermaid/build-lines'

function shapeNamed(id: string, name: string): Node {
  return {
    id,
    type: 'shape',
    position: { x: 0, y: 0 },
    data: {
      componentFields: [
        {
          label: 'Name',
          type: ComponentInputType.TextInput,
          data: [{ value: name }],
        },
      ],
    },
  }
}

function edgeWithLabel(label: string): Edge {
  return { id: 'e1', source: 'a', target: 'b', label }
}

describe('writing node lines', () => {
  it('writes a node under its own id when the map has never heard of it', () => {
    const lines = buildMermaidNodeLines(
      [shapeNamed('untracked', 'Gateway')],
      new Map(),
      false
    )

    expect(lines).toEqual(['untracked["Gateway"]'])
  })
})

describe('writing edge lines', () => {
  it('leaves out an edge that reaches a node not on the diagram', () => {
    const lines = buildMermaidEdgeLines(
      [{ id: 'e1', source: 'a', target: 'grouped-away' }],
      new Map([['a', 'A']]),
      false
    )

    expect(lines).toEqual([])
  })

  it('turns a pipe in a labelled edge into a slash and squeezes the gaps', () => {
    const lines = buildMermaidEdgeLines(
      [edgeWithLabel('  reads |  writes ')],
      new Map([
        ['a', 'A'],
        ['b', 'B'],
      ]),
      true
    )

    expect(lines).toEqual(['A -->|reads / writes| B'])
  })

  it('draws a plain arrow for a detailed edge that carries no label', () => {
    const lines = buildMermaidEdgeLines(
      [{ id: 'e1', source: 'a', target: 'b' }],
      new Map([
        ['a', 'A'],
        ['b', 'B'],
      ]),
      true
    )

    expect(lines).toEqual(['A --> B'])
  })
})
