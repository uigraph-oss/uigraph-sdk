import { Edge, MarkerType, Node } from '@xyflow/react'
import { describe, expect, it } from 'vitest'
import { ComponentInputType } from '../../components/component-type'
import { convertUiGraphToMermaid } from '../../uig-converter'
import { convertMermaidToReactFlowWithContext } from '../context/convert-with-context'
import { convertMermaidToReactFlow } from '../index'

async function tripThroughCanvas(
  exported: ReturnType<typeof convertUiGraphToMermaid>
) {
  const canvas = await convertMermaidToReactFlowWithContext(
    exported.mermaid,
    exported.context
  )

  return { canvas, exported: convertUiGraphToMermaid(canvas) }
}

function shapeNode(id: string, name: string, x: number): Node {
  return {
    id,
    type: 'shape',
    position: { x, y: 40 },
    data: {
      shape: 'rounded-rect',
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

const CANVAS_NODES: Node[] = [
  shapeNode('7f1e-aaa', 'Collect', 0),
  shapeNode('7f1e-bbb', 'Publish', 320),
  {
    id: 'zone-1',
    type: 'group',
    position: { x: -20, y: 0 },
    data: {
      childNodes: ['7f1e-aaa', '7f1e-bbb'],
      componentFields: [
        {
          label: 'Name',
          type: ComponentInputType.TextInput,
          data: [{ value: 'Ingest Zone' }],
        },
      ],
    },
  },
]

const CANVAS_EDGES: Edge[] = [
  {
    id: 'edge-1',
    source: '7f1e-aaa',
    target: '7f1e-bbb',
    type: 'smoothstep',
    label: 'batches',
    sourceHandle: 'source-right',
    targetHandle: 'target-left',
    style: { stroke: '#334455', strokeWidth: 3, strokeDasharray: '1 2' },
    markerEnd: { type: MarkerType.ArrowClosed },
    animated: true,
  },
]

describe('a flowchart that starts out as mermaid', () => {
  it('comes back as mermaid with every node and arrow it went in with', async () => {
    const canvas = await convertMermaidToReactFlow(
      'flowchart TB\n  A[Start] --> B{Ready?}\n  B -->|yes| C[Ship it]\n  B -->|no| A'
    )

    expect(convertUiGraphToMermaid(canvas).mermaid).toBe(
      'flowchart TB\nA["Start"]\nB["Ready?"]\nC["Ship it"]\nA --> B\nB --> C\nB --> A'
    )
  })

  it('settles into a fixed point after one trip through the canvas', async () => {
    const first = convertUiGraphToMermaid(
      await convertMermaidToReactFlow(
        'flowchart TB\n  A[Start] --> B{Ready?}\n  B -->|yes| C[Ship it]'
      )
    )
    const second = await tripThroughCanvas(first)

    expect(second.exported.mermaid).toBe(first.mermaid)
    expect(second.exported.context).toEqual(first.context)
  })

  it('carries an arrow label the plain mermaid line has no room for', async () => {
    const first = convertUiGraphToMermaid(
      await convertMermaidToReactFlow(
        'flowchart LR\n  A[Start] -->|yes| B[Ship it]'
      )
    )
    const { canvas } = await tripThroughCanvas(first)

    expect(first.mermaid).toContain('A --> B')
    expect(first.context.edges?.['A-B']?.label).toBe('yes')
    expect(canvas.edges[0].label).toBe('yes')
  })

  it('keeps a subgraph as a group holding the same nodes', async () => {
    const first = convertUiGraphToMermaid(
      await convertMermaidToReactFlow(
        'flowchart LR\n  subgraph S1 [Edge Layer]\n    A[Gateway]\n  end\n  A --> B[Core]'
      )
    )
    const { canvas } = await tripThroughCanvas(first)

    expect(first.context.groups?.['subgraph-S1']).toEqual({
      name: 'Edge Layer',
      nodes: ['A'],
    })
    expect(canvas.nodes.find((node) => node.id === 'A')?.parentId).toBe(
      'subgraph-S1'
    )
  })
})

describe('a flowchart that starts out on the canvas', () => {
  it('rebuilds every node where it stood, with the shape and name it had', async () => {
    const first = convertUiGraphToMermaid({
      nodes: CANVAS_NODES,
      edges: CANVAS_EDGES,
    })
    const { canvas } = await tripThroughCanvas(first)
    const collect = canvas.nodes.find((node) => node.id === 'A')

    expect(collect).toMatchObject({
      type: 'shape',
      parentId: 'zone-1',
      position: { x: 0, y: 40 },
    })
    expect(collect?.data.shape).toBe('rounded-rect')
    expect(collect?.data.componentFields?.[0].data).toEqual([
      { value: 'Collect' },
    ])
  })

  it('rebuilds the arrow with its line, its ends and its marker', async () => {
    const first = convertUiGraphToMermaid({
      nodes: CANVAS_NODES,
      edges: CANVAS_EDGES,
    })
    const { canvas } = await tripThroughCanvas(first)

    expect(canvas.edges[0]).toMatchObject({
      source: 'A',
      target: 'B',
      type: 'smoothstep',
      label: 'batches',
      sourceHandle: 'source-right',
      targetHandle: 'target-left',
      animated: true,
      markerEnd: { type: MarkerType.ArrowClosed },
    })
    expect(canvas.edges[0].style).toMatchObject({
      stroke: '#334455',
      strokeWidth: 3,
      strokeDasharray: '1 2',
    })
  })

  it('settles into a fixed point once the canvas has been through mermaid', async () => {
    const first = convertUiGraphToMermaid({
      nodes: CANVAS_NODES,
      edges: CANVAS_EDGES,
    })
    const second = await tripThroughCanvas(first)
    const third = await tripThroughCanvas(second.exported)

    expect(second.exported.mermaid).toBe(first.mermaid)
    expect(third.exported.context).toEqual(second.exported.context)
  })
})
