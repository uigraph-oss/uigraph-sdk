# uigraph-diagram-sdk

Convert Mermaid flowchart syntax to [React Flow](https://reactflow.dev/) nodes and edges. Use with `@xyflow/react` to render diagrams from Mermaid source or from text that contains Mermaid (e.g. LLM output).

## Install

```bash
pnpm add uigraph-diagram-sdk @xyflow/react
```

Peer dependencies: `@xyflow/react`, `dagre`, `mermaid` (listed in the package).

## API

### `extractMermaidFromFences(content: string): string`

Extracts Mermaid code from a string that may contain markdown fences or raw text.

- If the string has a fenced block (e.g. ` ```mermaid ` or ` ``` `), returns the inner code.
- Otherwise looks for a Mermaid diagram keyword (`graph`, `flowchart`, `sequenceDiagram`, etc.) and returns from that point until the next fence or end of string.
- Useful when the source is LLM output or mixed prose + diagram.

### `sanitizeMermaidLabels(src: string): string`

Normalizes Mermaid source so it parses reliably:

- Quotes node labels and subgraph titles that contain punctuation (`()"[],:;`) so the parser does not break.
- Keeps only the first diagram when multiple diagram blocks are present.

Use this on raw or extracted Mermaid before passing to `convertMermaidToReactFlow`.

### `convertMermaidToReactFlow(mermaidCode: string): Promise<ReactFlowData>`

Parses Mermaid flowchart/graph code and returns React Flow data: nodes and edges with positions and styling. Uses Dagre for layout.

**Returns:** `Promise<{ nodes: Node[]; edges: Edge[] }>`

**Supported Mermaid features:**

- `flowchart` / `graph` with direction: `TB`, `TD`, `BT`, `RL`, `LR`
- Node shapes: rectangle `[]`, rounded `()`, stadium `([])`, circle `(())`, diamond `{}`
- Subgraphs (including nested) and `direction` inside subgraphs
- Edge operators: `-->`, `---`, `-.->`, `==>`, etc., with optional labels `-->|label|` or inline
- Node labels with optional `type:` prefix: `type:builder`, `type:code`, `type:text`, `type:table`, `type:image`, `type:cloud`, `type:comment`, `type:default` (maps to React Flow node types)
- Image nodes: labels that contain an image URL (e.g. `https://.../image.png`) are treated as image nodes

**Type:**

```ts
import type { ReactFlowData } from 'uigraph-diagram-sdk'
```

## Example

```ts
import {
  extractMermaidFromFences,
  sanitizeMermaidLabels,
  convertMermaidToReactFlow,
} from 'uigraph-diagram-sdk'
import { ReactFlow } from '@xyflow/react'

const raw = `
Some text here.
\`\`\`mermaid
flowchart LR
  A[Start] --> B[End]
\`\`\`
`

const mermaidCode = extractMermaidFromFences(raw)
const sanitized = sanitizeMermaidLabels(mermaidCode)
const { nodes, edges } = await convertMermaidToReactFlow(sanitized)

function MyDiagram() {
  return <ReactFlow nodes={nodes} edges={edges} />
}
```

## Debug

Set `DEBUG_MERMAID=true` in the environment to log conversion steps (e.g. parsing, layout, positioning).
