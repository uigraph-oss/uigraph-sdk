import { describe, expect, it } from 'vitest'
import { convertMermaidToReactFlow } from '../../index'
import { parseSequenceDiagram } from '../../sequence-diagram/parser'
import { parseMermaidCode } from '../parser'
import { debugConvertMermaid } from '../to-react-flow'

describe('parseMermaidCode', () => {
  it('parses simple flowchart with two nodes and one edge', () => {
    const code = 'flowchart LR\n  A --> B'
    const result = parseMermaidCode(code)
    expect(result.nodes).toHaveLength(2)
    expect(result.edges).toHaveLength(1)
    expect(result.subgraphs).toHaveLength(0)
    expect(result.direction).toBe('LR')
    const ids = result.nodes.map((n) => n.id).sort()
    expect(ids).toEqual(['A', 'B'])
    expect(result.edges[0].source).toBe('A')
    expect(result.edges[0].target).toBe('B')
  })

  it('sets direction TB for flowchart TB', () => {
    const code = 'flowchart TB\nA --> B'
    const result = parseMermaidCode(code)
    expect(result.direction).toBe('TB')
  })

  it('normalizes TD to TB', () => {
    const code = 'flowchart TD\nA --> B'
    const result = parseMermaidCode(code)
    expect(result.direction).toBe('TB')
  })

  it('strips comment lines', () => {
    const code = '%% comment\nflowchart LR\nA --> B'
    const result = parseMermaidCode(code)
    expect(result.nodes).toHaveLength(2)
    expect(result.edges).toHaveLength(1)
    expect(result.direction).toBe('LR')
  })

  it('parses subgraph with id and nodes', () => {
    const code = 'flowchart LR\n  subgraph S1\n    A\n  end\n  A --> B'
    const result = parseMermaidCode(code)
    expect(result.subgraphs).toHaveLength(1)
    expect(result.subgraphs[0].id).toBe('S1')
    expect(result.subgraphs[0].nodes).toContain('A')
    expect(result.nodes).toHaveLength(2)
    const nodeA = result.nodes.find((n) => n.id === 'A')
    expect(nodeA?.subgraph).toBe('S1')
  })

  it('returns empty nodes and edges for diagram with no node definitions', () => {
    const code = 'flowchart LR'
    const result = parseMermaidCode(code)
    expect(result.nodes).toHaveLength(0)
    expect(result.edges).toHaveLength(0)
    expect(result.subgraphs).toHaveLength(0)
    expect(result.direction).toBe('LR')
  })

  it('merges multi-line node label', () => {
    const code = 'flowchart LR\n  A["Line1\n  Line2"] --> B'
    const result = parseMermaidCode(code)
    expect(result.nodes).toHaveLength(2)
    const nodeA = result.nodes.find((n) => n.id === 'A')
    expect(nodeA?.label).toContain('Line1')
    expect(nodeA?.label).toContain('Line2')
  })

  it('parses graph (not flowchart) and detects direction', () => {
    const code = 'graph LR\n  A --> B'
    const result = parseMermaidCode(code)
    expect(result.direction).toBe('LR')
    expect(result.nodes).toHaveLength(2)
    expect(result.edges).toHaveLength(1)
  })

  it('parses BT and RL directions', () => {
    expect(parseMermaidCode('flowchart BT\nA --> B').direction).toBe('BT')
    expect(parseMermaidCode('flowchart RL\nA --> B').direction).toBe('RL')
  })

  it('parses edge with pipe label', () => {
    const code = 'flowchart LR\n  A -->|yes| B'
    const result = parseMermaidCode(code)
    expect(result.edges).toHaveLength(1)
    expect(result.edges[0].label).toBe('yes')
    expect(result.edges[0].source).toBe('A')
    expect(result.edges[0].target).toBe('B')
  })

  it('parses chain of edges A --> B --> C', () => {
    const code = 'flowchart LR\n  A --> B --> C'
    const result = parseMermaidCode(code)
    expect(result.nodes.map((n) => n.id)).toEqual(['A', 'B', 'C'])
    expect(result.edges).toHaveLength(2)
    expect(result.edges[0].source).toBe('A')
    expect(result.edges[0].target).toBe('B')
    expect(result.edges[1].source).toBe('B')
    expect(result.edges[1].target).toBe('C')
  })

  it('parses node shapes: rect, round, diamond', () => {
    const code = 'flowchart LR\n  A[rect] --> B(round)\n  B --> C{diamond}'
    const result = parseMermaidCode(code)
    expect(result.nodes).toHaveLength(3)
    const nodeA = result.nodes.find((n) => n.id === 'A')
    const nodeB = result.nodes.find((n) => n.id === 'B')
    const nodeC = result.nodes.find((n) => n.id === 'C')
    expect(nodeA?.shape).toBe('rect')
    expect(nodeB?.shape).toBe('round')
    expect(nodeC?.shape).toBe('diamond')
  })

  it('parses nested subgraphs with parent and child', () => {
    const code = `flowchart LR
  subgraph outer
    subgraph inner
      A
    end
    A --> B
  end`
    const result = parseMermaidCode(code)
    expect(result.subgraphs.length).toBeGreaterThanOrEqual(2)
    const inner = result.subgraphs.find((s) => s.id === 'inner')
    const outer = result.subgraphs.find((s) => s.id === 'outer')
    expect(inner).toBeDefined()
    expect(outer).toBeDefined()
    expect(inner?.parentId).toBe('outer')
    expect(outer?.childrenIds).toContain('inner')
    expect(inner?.nodes).toContain('A')
  })

  it('parses subgraph with quoted title', () => {
    const code = 'flowchart LR\n  subgraph "My Module"\n    A\n  end\n  A --> B'
    const result = parseMermaidCode(code)
    expect(result.subgraphs).toHaveLength(1)
    expect(result.subgraphs[0].title).toContain('My Module')
    expect(result.subgraphs[0].nodes).toContain('A')
  })

  it('parses multiple subgraphs and edges between them', () => {
    const code = `flowchart LR
  subgraph S1
    A
  end
  subgraph S2
    B
  end
  A --> B`
    const result = parseMermaidCode(code)
    expect(result.subgraphs).toHaveLength(2)
    expect(result.nodes).toHaveLength(2)
    expect(result.edges).toHaveLength(1)
    expect(result.edges[0].source).toBe('A')
    expect(result.edges[0].target).toBe('B')
    const sg1 = result.subgraphs.find((s) => s.id === 's1' || s.id === 'S1')
    const sg2 = result.subgraphs.find((s) => s.id === 's2' || s.id === 'S2')
    expect(sg1?.nodes).toContain('A')
    expect(sg2?.nodes).toContain('B')
  })

  it('parses node with explicit rectangle label', () => {
    const code = 'flowchart LR\n  Start[Start node] --> End[End node]'
    const result = parseMermaidCode(code)
    expect(result.nodes).toHaveLength(2)
    const start = result.nodes.find((n) => n.id === 'Start')
    const end = result.nodes.find((n) => n.id === 'End')
    expect(start?.label).toBe('Start node')
    expect(end?.label).toBe('End node')
  })

  it('parses multiple comments and blank lines', () => {
    const code = '%% first\n\nflowchart LR\n%% second\n  A --> B\n%% third'
    const result = parseMermaidCode(code)
    expect(result.nodes).toHaveLength(2)
    expect(result.edges).toHaveLength(1)
  })

  it('parses edge with hyphen arrow -.->', () => {
    const code = 'flowchart LR\n  A -.-> B'
    const result = parseMermaidCode(code)
    expect(result.edges).toHaveLength(1)
    expect(result.edges[0].type).toBeDefined()
  })

  it('parses reverse arrow <- with correct source and target', () => {
    const code = 'flowchart LR\n  A <- B'
    const result = parseMermaidCode(code)
    expect(result.edges).toHaveLength(1)
    expect(result.edges[0].source).toBe('B')
    expect(result.edges[0].target).toBe('A')
    expect(result.edges[0].type).toBe('->')
  })

  it('parses state diagram transition labels with colon syntax', () => {
    const code = `stateDiagram-v2
  A --> B : submit_credentials
  B --> C : auth_success && !mfa_enabled`
    const result = parseMermaidCode(code)

    expect(result.edges).toHaveLength(2)
    expect(result.edges[0]).toMatchObject({
      source: 'A',
      target: 'B',
      label: 'submit_credentials',
    })
    expect(result.edges[1]).toMatchObject({
      source: 'B',
      target: 'C',
      label: 'auth_success && !mfa_enabled',
    })
  })

  it('ignores pseudo-state [*] transitions in state diagrams', () => {
    const code = `stateDiagram-v2
  [*] --> Unauthenticated
  Unauthenticated --> Authenticated : auth_success
  Authenticated --> [*]`
    const result = parseMermaidCode(code)

    expect(result.nodes.some((node) => node.id === '[*]')).toBe(false)
    expect(
      result.edges.some(
        (edge) => edge.source === '[*]' || edge.target === '[*]'
      )
    ).toBe(false)
    expect(result.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: 'Unauthenticated',
          target: 'Authenticated',
          label: 'auth_success',
        }),
      ])
    )
  })
})

describe('convertMermaidToReactFlow', () => {
  it('returns ReactFlowData with nodes and edges for simple flowchart', async () => {
    const code = 'flowchart LR\n  A --> B'
    const result = await convertMermaidToReactFlow(code)
    expect(result.nodes.length).toBeGreaterThanOrEqual(1)
    expect(result.edges.length).toBeGreaterThanOrEqual(1)
    const nodeIds = result.nodes.map((n) => n.id)
    expect(nodeIds).toContain('A')
    expect(nodeIds).toContain('B')
    expect(result.nodes[0]).toHaveProperty('id')
    expect(result.nodes[0]).toHaveProperty('position')
    expect(result.nodes[0]).toHaveProperty('data')
    expect(result.edges[0]).toHaveProperty('source')
    expect(result.edges[0]).toHaveProperty('target')
    expect(result.edges[0]).not.toHaveProperty('animated')
  })

  it('returns empty nodes and edges for diagram with no nodes', async () => {
    const code = 'flowchart LR'
    const result = await convertMermaidToReactFlow(code)
    expect(result).toEqual({ nodes: [], edges: [] })
  })

  it('returns empty nodes and edges on invalid input', async () => {
    const result = await convertMermaidToReactFlow('not mermaid {{{')
    expect(result).toEqual({ nodes: [], edges: [] })
  })

  it('converts diagram with subgraphs to ReactFlowData', async () => {
    const code = `flowchart LR
  subgraph S1
    A
  end
  subgraph S2
    B
  end
  A --> B`
    const result = await convertMermaidToReactFlow(code)
    expect(result.nodes.length).toBeGreaterThanOrEqual(2)
    expect(result.edges.length).toBeGreaterThanOrEqual(1)
    const nodeIds = result.nodes.map((n) => n.id)
    expect(nodeIds).toContain('A')
    expect(nodeIds).toContain('B')
    const withParent = result.nodes.filter(
      (n) => 'parentNode' in n && n.parentNode
    )
    expect(withParent.length).toBeGreaterThanOrEqual(0)
  })

  it('converts diagram with edge labels', async () => {
    const code = 'flowchart LR\n  A -->|step 1| B -->|step 2| C'
    const result = await convertMermaidToReactFlow(code)
    expect(result.nodes.length).toBeGreaterThanOrEqual(2)
    expect(result.edges.length).toBeGreaterThanOrEqual(1)
  })

  it('renders edges with orthogonal (smoothstep) routing, not free-curving bezier', async () => {
    const code = 'flowchart TB\n  A --> B\n  A --> C'
    const result = await convertMermaidToReactFlow(code)
    result.edges.forEach((edge) => {
      expect(edge.type).toBe('smoothstep')
    })
  })

  it('converts diagram with node shapes to positioned nodes', async () => {
    const code = 'flowchart TB\n  A[rect] --> B(round) --> C{diamond}'
    const result = await convertMermaidToReactFlow(code)
    expect(result.nodes.length).toBeGreaterThanOrEqual(2)
    result.nodes.forEach((node) => {
      expect(node).toHaveProperty('position')
      expect(node.position).toHaveProperty('x')
      expect(node.position).toHaveProperty('y')
      expect(node.data).toBeDefined()
    })
  })

  it('converts graph BT direction', async () => {
    const code = 'graph BT\n  A --> B'
    const result = await convertMermaidToReactFlow(code)
    expect(result.nodes).toHaveLength(2)
    expect(result.edges).toHaveLength(1)
  })

  it('strips quote delimiters from a piped edge label', async () => {
    // -->|"label"| is common LLM output (mirrors the quoted-string edge
    // label syntax Mermaid also accepts) — the quotes are delimiters, not
    // part of the text, and previously leaked through as literal characters.
    const code = 'flowchart TB\n  A -->|"POST /reset"| B'
    const result = await convertMermaidToReactFlow(code)
    expect(result.edges[0].label).toBe('POST /reset')
  })

  it('drops an edge from a node to the subgraph it already lives inside', async () => {
    // A member node pointing at its own parent subgraph's id is a
    // degenerate edge: the node is already visually inside that boundary,
    // so the "connection" has no real second endpoint and only produced a
    // stray line looping back into the same box.
    const code = `flowchart TB
  subgraph S1
    A
  end
  B --> S1
  A --> S1`
    const result = await convertMermaidToReactFlow(code)
    const targetsOwnParent = result.edges.filter(
      (e) => e.source === 'A' && e.target === 'subgraph-S1'
    )
    expect(targetsOwnParent).toHaveLength(0)
    // The edge from outside the subgraph into it is still meaningful and
    // must survive the filter.
    expect(
      result.edges.some((e) => e.source === 'B' && e.target === 'subgraph-S1')
    ).toBe(true)
  })

  it('flips edge handles when the target ends up above the source in a TB layout', async () => {
    // Every edge previously got a fixed source-bottom/target-top handle
    // pair regardless of where the nodes actually ended up. Nodes living
    // inside a subgraph are positioned by a separate layout pass from
    // standalone nodes, so their relative rank can diverge from the
    // nominal top-to-bottom flow — when that happens the fixed handles
    // forced the edge to loop below its source and curl back up to reach
    // a target it could only approach from above. This reproduces that
    // layout shape (mirrors a real "Stripe checkout" generate output that
    // hit it): two subgraphs side by side, a fan-out/fan-in pair of
    // standalone nodes below them, and edges from those standalone nodes
    // back up into a subgraph member.
    const code = `flowchart TB
  u[User]
  subgraph client [Client]
    app[App]
  end
  subgraph backend [Backend]
    api[API]
    wh[Handler]
    db[(Database)]
  end
  subgraph stripe [Stripe]
    checkout[Checkout]
  end
  provision[Activate]
  failnode[Reject]

  u --> app
  app --> api
  api --> stripe
  stripe --> api
  api --> app
  app --> checkout
  checkout --> stripe
  stripe --> app
  stripe --> wh
  wh --> provision
  wh --> failnode
  provision --> db
  failnode --> db`
    const result = await convertMermaidToReactFlow(code)
    const provisionToDb = result.edges.find(
      (e) => e.source === 'provision' && e.target === 'db'
    )
    const failnodeToDb = result.edges.find(
      (e) => e.source === 'failnode' && e.target === 'db'
    )
    expect(provisionToDb).toMatchObject({
      sourceHandle: 'source-top',
      targetHandle: 'target-bottom',
    })
    expect(failnodeToDb).toMatchObject({
      sourceHandle: 'source-top',
      targetHandle: 'target-bottom',
    })
  })
})

describe('convertMermaidToReactFlow - meta-graph spacing', () => {
  it('uses tight node spacing, not wide container spacing, for a diagram with no subgraphs', async () => {
    // A plain chain of standalone nodes was being laid out with the spacing
    // meant for arranging whole subgraph containers against each other
    // (ranksep 280), producing huge empty gaps between small boxes. With no
    // subgraphs present, it should use the much tighter node-to-node ranksep
    // (180) instead.
    const code = 'flowchart TB\n  A[Start] --> B[Middle] --> C[End]'
    const result = await convertMermaidToReactFlow(code)
    const a = result.nodes.find((n) => n.id === 'A')!
    const b = result.nodes.find((n) => n.id === 'B')!

    const rankGap = (b.position.y as number) - (a.position.y as number)
    // Old (bug) behavior produced a gap on the order of 280 + node height;
    // the fix keeps it near the 180px node-level ranksep plus node height.
    expect(rankGap).toBeLessThan(280)
  })

  it('still uses wide container spacing when top-level subgraphs are present', async () => {
    const code = `flowchart TB
  subgraph one
    A[Start]
  end
  subgraph two
    B[End]
  end
  A --> B`
    const result = await convertMermaidToReactFlow(code)
    const subgraphOne = result.nodes.find((n) => n.id === 'subgraph-one')!
    const subgraphTwo = result.nodes.find((n) => n.id === 'subgraph-two')!

    const rankGap = Math.abs(
      (subgraphTwo.position.y as number) - (subgraphOne.position.y as number)
    )
    expect(rankGap).toBeGreaterThan(180)
  })
})

describe('debugConvertMermaid', () => {
  it('returns object with nodes, edges, subgraphs, reactFlowData and layout fields', async () => {
    const result = await debugConvertMermaid('flowchart LR\nA-->B')
    expect(result).toHaveProperty('nodes')
    expect(result).toHaveProperty('edges')
    expect(result).toHaveProperty('subgraphs')
    expect(result).toHaveProperty('reactFlowData')
    expect(result).toHaveProperty('subgraphLayouts')
    expect(result).toHaveProperty('subgraphPositions')
    expect(result).toHaveProperty('standalonePositions')
    expect(result.reactFlowData.nodes.length).toBeGreaterThanOrEqual(1)
    expect(result.reactFlowData.edges.length).toBeGreaterThanOrEqual(1)
  })

  it('returns layout and positions for nested subgraphs', async () => {
    const code = `flowchart LR
  subgraph outer
    subgraph inner
      A
    end
    A --> B
  end`
    const result = await debugConvertMermaid(code)
    expect(result.subgraphs.length).toBeGreaterThanOrEqual(2)
    expect(result.subgraphLayouts).toBeDefined()
    expect(Object.keys(result.subgraphLayouts).length).toBeGreaterThanOrEqual(1)
    expect(result.reactFlowData.nodes.length).toBeGreaterThanOrEqual(2)
  })

  it('returns direction in debug output', async () => {
    const result = await debugConvertMermaid('flowchart RL\nA --> B')
    expect(result.direction).toBe('RL')
  })
})

describe('parseSequenceDiagram', () => {
  it('parses participants with aliases', () => {
    const code = `sequenceDiagram
    participant A as Alice
    participant B as Bob`
    const result = parseSequenceDiagram(code)
    expect(result.participants).toHaveLength(2)
    expect(result.participants[0].name).toBe('Alice')
    expect(result.participants[1].name).toBe('Bob')
  })

  it('parses messages with labels', () => {
    const code = `sequenceDiagram
    A->>B: Hello`
    const result = parseSequenceDiagram(code)
    expect(result.messages).toHaveLength(1)
    expect(result.messages[0].label).toBe('Hello')
    expect(result.messages[0].lineStyle).toBe('solid')
    expect(result.messages[0].arrowType).toBe('filled')
  })

  it('parses dashed arrows', () => {
    const code = `sequenceDiagram
    A-->>B: Response`
    const result = parseSequenceDiagram(code)
    expect(result.messages[0].lineStyle).toBe('dashed')
  })

  it('auto-creates participants from messages', () => {
    const code = `sequenceDiagram
    Client->>Server: Request`
    const result = parseSequenceDiagram(code)
    expect(result.participants).toHaveLength(2)
  })
})

describe('convertMermaidToReactFlow - node sizing for shapes with edge insets', () => {
  it('sizes a short stadium/terminator label wide enough to clear its rounded ends', async () => {
    // A stadium's fully-rounded ends reserve `height` px of the node's total
    // width for the silhouette, not for text — a node sized only from the
    // generic text-width formula leaves too little room and the label wraps
    // mid-word (e.g. "Done" rendering as "Don" / "e").
    const code = 'flowchart TB\n  start --> done(["Done"])'
    const result = await convertMermaidToReactFlow(code)
    const done = result.nodes.find((n) => n.id === 'done')

    expect(done?.data?.shape).toBe('terminator')
    const style = done!.style as { width: number; height: number }
    const usableWidth = style.width - style.height
    expect(usableWidth).toBeGreaterThan(30)
  })

  it('sizes a cylinder tall enough to clear its elliptical caps', async () => {
    const code = 'flowchart TB\n  api --> db[("Proposals DB")]'
    const result = await convertMermaidToReactFlow(code)
    const db = result.nodes.find((n) => n.id === 'db')

    expect(db?.data?.shape).toBe('cylinder')
    const style = db!.style as { width: number; height: number }
    expect(style.height).toBeGreaterThanOrEqual(58)
  })

  it('sizes a subroutine wide enough to clear its side bars', async () => {
    const code = 'flowchart TB\n  a --> proc[["Process the incoming request"]]'
    const result = await convertMermaidToReactFlow(code)
    const proc = result.nodes.find((n) => n.id === 'proc')

    expect(proc?.data?.shape).toBe('subroutine')
    const style = proc!.style as { width: number; height: number }
    // Side inset is max(24, 20% of width) on each side; the box should be
    // comfortably larger than the generic (no-inset-awareness) formula would
    // have produced for this label (text width 224px + 60px generic padding
    // = 284px), proving the inset adjustment actually widened the box.
    expect(style.width).toBeGreaterThan(284)
  })
})

describe('convertMermaidToReactFlow - chained arrows', () => {
  it('connects every node in a single-line chain end to end', async () => {
    // Regression for a real generate output where a 4-node linear pipeline
    // written as one chained line produced only the first edge, leaving the
    // rest of the pipeline completely disconnected on the canvas.
    const code =
      'flowchart LR\n  start(["Start"]) --> etl[["ETL subroutine"]] --> dwh[("Data warehouse")] --> stop(["End"])'
    const result = await convertMermaidToReactFlow(code)

    expect(result.nodes).toHaveLength(4)
    expect(result.edges).toHaveLength(3)
    expect(result.edges.map((e) => `${e.source}->${e.target}`)).toEqual([
      'start->etl',
      'etl->dwh',
      'dwh->stop',
    ])
  })
})

describe('convertMermaidToReactFlow - sequence diagrams', () => {
  it('detects and converts sequence diagrams', async () => {
    const code = `sequenceDiagram
    participant A
    participant B
    A->>B: Hello`
    const result = await convertMermaidToReactFlow(code)
    expect(result.nodes).toHaveLength(3)
    expect(result.edges).toHaveLength(2)
  })

  it('sizes message boxes from their label instead of a fixed width', async () => {
    const code = `sequenceDiagram
    participant A
    participant B
    A->>B: Hi
    B-->>A: Return Checkout Session client secret`
    const result = await convertMermaidToReactFlow(code)
    const [short, long] = result.nodes.filter((n) => n.type === 'shape')

    expect(long.width).toBeGreaterThan(short.width!)
    expect(long.height).toBeGreaterThan(short.height!)
  })

  it('gives every message a row tall enough for the tallest box', async () => {
    const code = `sequenceDiagram
    participant A
    participant B
    A->>B: Return Checkout Session client secret
    B-->>A: Ok`
    const result = await convertMermaidToReactFlow(code)
    const [first, second] = result.nodes
      .filter((n) => n.type === 'shape')
      .sort((a, b) => a.position.y - b.position.y)

    expect(second.position.y).toBeGreaterThanOrEqual(
      first.position.y + first.height!
    )
  })

  it('gives a self-message two rows so the next message clears its return', async () => {
    const code = `sequenceDiagram
    participant A
    participant B
    A->>A: Think
    A->>B: Go`
    const result = await convertMermaidToReactFlow(code)

    const selfReturn = result.edges.find((e) => e.id === 'edge-0-b')
    const next = result.edges.find((e) => e.id === 'edge-1-a')

    expect(selfReturn?.targetHandle).toBe('row-1-right-target')
    expect(next?.sourceHandle).toBe('row-2-right-source')
  })

  it('still converts flowcharts correctly', async () => {
    const code = 'flowchart LR\n  A --> B'
    const result = await convertMermaidToReactFlow(code)
    expect(result.nodes).toHaveLength(2)
    expect(result.edges).toHaveLength(1)
  })
})
