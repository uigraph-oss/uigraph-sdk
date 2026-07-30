import { Node } from '@xyflow/react'
import { describe, expect, it } from 'vitest'
import { convertFlowChartToReactFlow } from '../to-react-flow'

function nodeById(nodes: Node[], id: string) {
  return nodes.find((node) => node.id === id)!
}

describe('image nodes', () => {
  it('turns a label that carries an image url into an image node', async () => {
    const { nodes } = await convertFlowChartToReactFlow(
      'flowchart LR\n  A[https://cdn.example.com/logo.png Logo] --> B'
    )
    const image = nodeById(nodes, 'A')

    expect(image.type).toBe('image')
    expect(image.data.src).toBe('https://cdn.example.com/logo.png')
  })

  it('sizes an image node the same however much text sits beside the url', async () => {
    const short = await convertFlowChartToReactFlow(
      'flowchart LR\n  A[https://cdn.example.com/logo.png x] --> B'
    )
    const long = await convertFlowChartToReactFlow(
      'flowchart LR\n  A[https://cdn.example.com/logo.png a much much longer caption] --> B'
    )

    expect(nodeById(long.nodes, 'A').style).toEqual(
      nodeById(short.nodes, 'A').style
    )
    expect(nodeById(long.nodes, 'A').style!.width).toBe(
      nodeById(long.nodes, 'A').style!.height
    )
  })
})

describe('shape nodes', () => {
  it('maps each mermaid shape onto the shape the canvas draws', async () => {
    const { nodes } = await convertFlowChartToReactFlow(
      'flowchart LR\n  A[box] --> B{choice}\n  B --> C((round))'
    )

    expect(nodeById(nodes, 'A').data.shape).toBe('rectangle')
    expect(nodeById(nodes, 'B').data.shape).toBe('diamond')
    expect(nodeById(nodes, 'C').data.shape).toBe('ellipse')
  })

  it('hands the label over as the name of the component', async () => {
    const { nodes } = await convertFlowChartToReactFlow(
      'flowchart LR\n  A[Load orders] --> B'
    )
    const fields = nodeById(nodes, 'A').data.componentFields as {
      componentFieldId: string
      data: { value: string }[]
    }[]

    expect(fields[0].componentFieldId).toBe('name')
    expect(fields[0].data[0].value).toBe('Load orders')
  })

  it('widens the box for a longer label', async () => {
    const { nodes } = await convertFlowChartToReactFlow(
      'flowchart LR\n  A[hi] --> B[a considerably longer label than hi]'
    )

    expect(nodeById(nodes, 'B').style!.width).toBeGreaterThan(
      nodeById(nodes, 'A').style!.width as number
    )
  })

  it('heightens the box when the label breaks onto a second line', async () => {
    const { nodes } = await convertFlowChartToReactFlow(
      'flowchart LR\n  A[one] --> B[one<br/>two]'
    )

    expect(nodeById(nodes, 'B').style!.height).toBeGreaterThan(
      nodeById(nodes, 'A').style!.height as number
    )
  })

  it('gives a decision more room than a plain box holding the same label', async () => {
    const { nodes } = await convertFlowChartToReactFlow(
      'flowchart LR\n  A[same] --> B{same}'
    )

    expect(nodeById(nodes, 'B').style!.height).toBeGreaterThan(
      nodeById(nodes, 'A').style!.height as number
    )
    expect(nodeById(nodes, 'B').style!.width).toBeGreaterThanOrEqual(
      nodeById(nodes, 'A').style!.width as number
    )
  })

  it('keeps a circle square', async () => {
    const { nodes } = await convertFlowChartToReactFlow(
      'flowchart LR\n  A((a wide label in a circle)) --> B'
    )

    expect(nodeById(nodes, 'A').style!.width).toBe(
      nodeById(nodes, 'A').style!.height
    )
  })

  it('faces the node handles along the direction of the diagram', async () => {
    const sideways = await convertFlowChartToReactFlow(
      'flowchart LR\n  A --> B'
    )
    const downwards = await convertFlowChartToReactFlow(
      'flowchart TB\n  A --> B'
    )

    expect(nodeById(sideways.nodes, 'A').sourcePosition).toBe('right')
    expect(nodeById(sideways.nodes, 'A').targetPosition).toBe('left')
    expect(nodeById(downwards.nodes, 'A').sourcePosition).toBe('bottom')
    expect(nodeById(downwards.nodes, 'A').targetPosition).toBe('top')
  })
})

describe('tagged labels', () => {
  it('renders a table tag as a table node that already holds sample rows', async () => {
    const { nodes } = await convertFlowChartToReactFlow(
      'flowchart LR\n  A[type:table| Sprint] --> B'
    )
    const table = nodeById(nodes, 'A')
    const fields = table.data.componentFields as {
      data: { value: string }[]
    }[]

    expect(table.type).toBe('table')
    expect((table.data.columns as string[]).length).toBeGreaterThan(0)
    expect((table.data.rows as string[][]).length).toBeGreaterThan(0)
    expect(fields[0].data[0].value).toBe('Sprint')
  })

  it('renders a code tag as a code node with the code left to be filled in', async () => {
    const { nodes } = await convertFlowChartToReactFlow(
      'flowchart LR\n  A[type:code| Snippet] --> B'
    )
    const code = nodeById(nodes, 'A')
    const fields = code.data.componentFields as {
      label: string
      data: { value: string }[]
    }[]

    expect(code.type).toBe('code')
    expect(fields.find((field) => field.label === 'Code')?.data[0].value).toBe(
      ''
    )
  })
})

describe('edge rendering', () => {
  it('draws a plain line and a dotted line with different dash patterns', async () => {
    const { edges } = await convertFlowChartToReactFlow(
      'flowchart LR\n  A --- B\n  C -.- D\n  E --> F'
    )
    const plain = edges.find((edge) => edge.source === 'A')!
    const dotted = edges.find((edge) => edge.source === 'C')!
    const arrow = edges.find((edge) => edge.source === 'E')!

    expect(plain.style!.strokeDasharray).toBeDefined()
    expect(dotted.style!.strokeDasharray).toBeDefined()
    expect(plain.style!.strokeDasharray).not.toBe(dotted.style!.strokeDasharray)
    expect(arrow.style!.strokeDasharray).toBeUndefined()
  })

  it('draws a thick arrow heavier than a plain one', async () => {
    const { edges } = await convertFlowChartToReactFlow(
      'flowchart LR\n  A ==> B\n  C --> D'
    )
    const thick = edges.find((edge) => edge.source === 'A')!
    const plain = edges.find((edge) => edge.source === 'C')!

    expect(thick.style!.strokeWidth).toBeGreaterThan(
      plain.style!.strokeWidth as number
    )
  })

  it('points the edge handles along the direction of the diagram', async () => {
    const sideways = await convertFlowChartToReactFlow(
      'flowchart LR\n  A --> B'
    )
    const downwards = await convertFlowChartToReactFlow(
      'flowchart TB\n  A --> B'
    )

    expect(sideways.edges[0].sourceHandle).toBe('source-right')
    expect(sideways.edges[0].targetHandle).toBe('target-left')
    expect(downwards.edges[0].sourceHandle).toBe('source-bottom')
    expect(downwards.edges[0].targetHandle).toBe('target-top')
  })

  it('keeps two edges apart when the same pair is joined twice', async () => {
    const { edges } = await convertFlowChartToReactFlow(
      'flowchart LR\n  A -->|first| B\n  A -->|second| B'
    )

    expect(edges).toHaveLength(2)
    expect(edges[0].id).not.toBe(edges[1].id)
  })

  it('hangs an edge off the group when its endpoint is a subgraph', async () => {
    const { edges } = await convertFlowChartToReactFlow(
      'flowchart LR\n  subgraph S1\n    A\n  end\n  S1 --> B'
    )

    expect(edges[0].source).toBe('subgraph-S1')
    expect(edges[0].target).toBe('B')
  })
})
