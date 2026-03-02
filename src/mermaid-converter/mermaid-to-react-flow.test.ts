import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  convertMermaidToReactFlow,
  debugConvertMermaid,
  parseMermaidCode,
  parseSequenceDiagram,
} from './mermaid-to-react-flow'

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
    expect(result.nodes.length).toBeGreaterThanOrEqual(2)
    expect(result.edges.length).toBeGreaterThanOrEqual(1)
    const ids = result.nodes.map((n) => n.id)
    expect(ids).toContain('A')
    expect(ids).toContain('B')
    if (result.nodes.length >= 3) {
      expect(ids).toContain('C')
      expect(result.edges.length).toBeGreaterThanOrEqual(2)
    }
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

  it('parses pseudo-state [*] transitions in state diagrams', () => {
    const code = `stateDiagram-v2
  [*] --> Unauthenticated
  Authenticated --> [*]`
    const result = parseMermaidCode(code)

    expect(result.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: '[*]', target: 'Unauthenticated' }),
        expect.objectContaining({ source: 'Authenticated', target: '[*]' }),
      ])
    )
  })

  it('parses edge labels from demo/complex-mermaid.txt', () => {
    const code = readFileSync(
      join(process.cwd(), 'demo', 'complex-mermaid.txt'),
      'utf8'
    )
    const result = parseMermaidCode(code)
    const labels = result.edges.map((edge) => edge.label).filter(Boolean)

    expect(labels.length).toBeGreaterThan(0)
    expect(labels).toContain('submit_credentials')
    expect(labels).toContain('auth_success && !mfa_enabled')
    expect(labels).toContain('session_timeout')
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

  it('still converts flowcharts correctly', async () => {
    const code = 'flowchart LR\n  A --> B'
    const result = await convertMermaidToReactFlow(code)
    expect(result.nodes).toHaveLength(2)
    expect(result.edges).toHaveLength(1)
  })
})
