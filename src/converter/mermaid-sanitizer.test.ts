import { describe, expect, it } from 'vitest'
import {
  extractMermaidFromFences,
  sanitizeMermaidLabels,
} from './mermaid-sanitizer'

describe('extractMermaidFromFences', () => {
  it('returns empty string for empty input', () => {
    expect(extractMermaidFromFences('')).toBe('')
  })

  it('extracts inner content from fenced block with mermaid language', () => {
    const content = '```mermaid\nflowchart LR\nA --> B\n```'
    expect(extractMermaidFromFences(content)).toBe('flowchart LR\nA --> B')
  })

  it('extracts inner content from generic fenced block when it contains diagram keyword', () => {
    const content = '```\nflowchart LR\nA --> B\n```'
    expect(extractMermaidFromFences(content)).toBe('flowchart LR\nA --> B')
  })

  it('returns inner content for generic fenced block without diagram keyword (first fence regex matches)', () => {
    const content = '```\nfoo bar\n```'
    expect(extractMermaidFromFences(content)).toBe('foo bar')
  })

  it('extracts from first diagram keyword when no fences (raw text), trimmed', () => {
    const content = '  flowchart LR\n  A --> B  '
    expect(extractMermaidFromFences(content)).toBe('flowchart LR\n  A --> B')
  })

  it('stops at next fence when raw text has trailing fence', () => {
    const content = 'flowchart LR\nA-->B\n```'
    expect(extractMermaidFromFences(content)).toBe('flowchart LR\nA-->B')
  })

  it('extracts sequenceDiagram from fenced block', () => {
    const content = '```mermaid\nsequenceDiagram\n  A->>B: msg\n```'
    expect(extractMermaidFromFences(content)).toBe(
      'sequenceDiagram\n  A->>B: msg'
    )
  })

  it('extracts first fenced block when multiple blocks present', () => {
    const content =
      '```mermaid\nflowchart LR\nA --> B\n```\n\n```mermaid\nflowchart TB\nC --> D\n```'
    expect(extractMermaidFromFences(content)).toBe('flowchart LR\nA --> B')
  })

  it('extracts when mermaid has optional space after backticks', () => {
    const content = '``` mermaid\nflowchart LR\nX --> Y\n```'
    expect(extractMermaidFromFences(content)).toBe('flowchart LR\nX --> Y')
  })

  it('extracts graph (not flowchart) keyword from raw text', () => {
    const content = '  graph LR\n  A --> B  '
    expect(extractMermaidFromFences(content)).toContain('graph LR')
    expect(extractMermaidFromFences(content)).toContain('A --> B')
  })

  it('extracts classDiagram from generic fenced block', () => {
    const content = '```\nclassDiagram\n  Animal <|-- Duck\n```'
    expect(extractMermaidFromFences(content)).toBe(
      'classDiagram\n  Animal <|-- Duck'
    )
  })

  it('returns trimmed content when no fence and no diagram keyword', () => {
    const content = '  just some text  '
    expect(extractMermaidFromFences(content)).toBe('just some text')
  })
})

describe('sanitizeMermaidLabels', () => {
  it('returns empty string for empty input', () => {
    expect(sanitizeMermaidLabels('')).toBe('')
  })

  it('quotes node labels that contain punctuation', () => {
    const src = 'A[Process (main)]'
    expect(sanitizeMermaidLabels(src)).toBe('A["Process (main)"]')
  })

  it('leaves already quoted labels unchanged', () => {
    const src = 'A["Already quoted"]'
    expect(sanitizeMermaidLabels(src)).toBe('A["Already quoted"]')
  })

  it('quotes subgraph titles that contain punctuation', () => {
    const src = 'subgraph Frontend (Global)'
    expect(sanitizeMermaidLabels(src)).toBe('subgraph "Frontend (Global)"')
  })

  it('keeps only the first diagram when multiple diagram starts present', () => {
    const src = 'flowchart LR\nA --> B\nflowchart TB\nC --> D'
    expect(sanitizeMermaidLabels(src)).toBe('flowchart LR\nA --> B')
  })

  it('quotes node labels with comma and colon', () => {
    const src = 'N[Step 1: do this, then that]'
    expect(sanitizeMermaidLabels(src)).toBe(
      'N["Step 1: do this, then that"]'
    )
  })

  it('quotes node labels with square brackets inside (non-greedy match)', () => {
    const src = 'X[optional [nested]]'
    expect(sanitizeMermaidLabels(src)).toBe('X["optional [nested"]]')
  })

  it('quotes node label with semicolon', () => {
    const src = 'N[Step one; optional]'
    expect(sanitizeMermaidLabels(src)).toBe('N["Step one; optional"]')
  })

  it('quotes multiple nodes with punctuation in same diagram', () => {
    const src = 'flowchart LR\n  A[Process (main)] --> B[Result: ok]\n  B --> C[End;]'
    expect(sanitizeMermaidLabels(src)).toContain('A["Process (main)"]')
    expect(sanitizeMermaidLabels(src)).toContain('B["Result: ok"]')
    expect(sanitizeMermaidLabels(src)).toContain('C["End;"]')
  })

  it('quotes subgraph title with semicolon', () => {
    const src = 'subgraph Module; Utils'
    expect(sanitizeMermaidLabels(src)).toBe('subgraph "Module; Utils"')
  })

  it('keeps first diagram when second is sequenceDiagram', () => {
    const src = 'flowchart LR\nA --> B\nsequenceDiagram\n  A->>B'
    expect(sanitizeMermaidLabels(src)).toBe('flowchart LR\nA --> B')
  })

  it('leaves node labels without punctuation unchanged', () => {
    const src = 'flowchart LR\n  A[Simple] --> B[Label]'
    expect(sanitizeMermaidLabels(src)).toBe(src)
  })
})
