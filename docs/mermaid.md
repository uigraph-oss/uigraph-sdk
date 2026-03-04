# Mermaid SDK Guide

Use the Mermaid SDK to convert Mermaid source into React Flow nodes and edges, then apply end-user context overrides when needed.

## convertMermaidToReactFlow

Converts Mermaid code directly into React Flow data.

### API

- `convertMermaidToReactFlow(mermaidCode: string): Promise<ReactFlowData>`

### Example: Convert Flowchart

```ts
import { convertMermaidToReactFlow } from '@uigraph/sdk'

const mermaid = `flowchart TD
  A[Start] --> B{Decision}
  B -->|Yes| C[Done]
  B -->|No| D[Retry]
`

const diagram = await convertMermaidToReactFlow(mermaid)

setNodes(diagram.nodes)
setEdges(diagram.edges)
```

### Example: Convert Sequence Diagram

```ts
import { convertMermaidToReactFlow } from '@uigraph/sdk'

const mermaid = `sequenceDiagram
  participant Client
  participant Server
  Client->>Server: POST /checkout
  Server-->>Client: 200 OK
`

const diagram = await convertMermaidToReactFlow(mermaid)

setNodes(diagram.nodes)
setEdges(diagram.edges)
```

## convertMermaidToReactFlowWithContext

Converts Mermaid and applies end-user context overrides for nodes, edges, and groups.

### API

- `convertMermaidToReactFlowWithContext(mermaidCode: string, context: z.infer<typeof contextSchema>)`

### Example: Apply Node, Edge, and Group Context

```ts
import { convertMermaidToReactFlowWithContext } from '@uigraph/sdk'

const mermaid = `flowchart LR
  A[API] --> B[Worker]
  B --> C[DB]
`

const diagram = await convertMermaidToReactFlowWithContext(mermaid, {
  nodes: {
    A: {
      type: 'cloud',
      name: 'API Gateway',
      cloud: 'AWS',
      service: 'Amazon API Gateway',
    },
  },
  edges: {
    'A-B': {
      label: 'HTTP',
      style: { stroke: '#2563eb', strokeWidth: 2, strokeStyle: 'dashed' },
    },
  },
  groups: {
    infra: {
      name: 'Infra',
      nodes: ['A', 'B', 'C'],
    },
  },
})

setNodes(diagram.nodes)
setEdges(diagram.edges)
```

## contextSchema

Use `contextSchema` when you want explicit validation before conversion.

### API

- `contextSchema.parse(context)`

### Context Keys

- `nodes`: keyed by Mermaid node ID (`A`, `B`, `db1`, etc.)
- `edges`: keyed by `sourceId-targetId` (example: `A-B`)
- `groups`: keyed by group ID, each with a name and node IDs

### Example: Validate Then Convert

```ts
import {
  contextSchema,
  convertMermaidToReactFlowWithContext,
} from '@uigraph/sdk'

const mermaid = `flowchart LR
  A[Title] --> B[Details]
`

const context = {
  nodes: {
    A: { type: 'text', text: 'Project Title' },
  },
  edges: {
    'A-B': { label: 'contains' },
  },
}

contextSchema.parse(context)
const diagram = await convertMermaidToReactFlowWithContext(mermaid, context)
```

## Node Type Examples (Context Only)

These examples customize node types through `convertMermaidToReactFlowWithContext`.

### text

```ts
import { convertMermaidToReactFlowWithContext } from '@uigraph/sdk'

const mermaid = `flowchart LR
  A[Heading]
`

const diagram = await convertMermaidToReactFlowWithContext(mermaid, {
  nodes: {
    A: { type: 'text', text: 'System Overview' },
  },
})
```

### image

```ts
import { convertMermaidToReactFlowWithContext } from '@uigraph/sdk'

const mermaid = `flowchart LR
  A[Logo]
`

const diagram = await convertMermaidToReactFlowWithContext(mermaid, {
  nodes: {
    A: { type: 'image', src: 'https://example.com/logo.png' },
  },
})
```

### cloud

```ts
import { convertMermaidToReactFlowWithContext } from '@uigraph/sdk'

const mermaid = `flowchart LR
  A[S3]
`

const diagram = await convertMermaidToReactFlowWithContext(mermaid, {
  nodes: {
    A: { type: 'cloud', cloud: 'AWS', service: 'Amazon S3' },
  },
})
```

### gif

```ts
import { convertMermaidToReactFlowWithContext } from '@uigraph/sdk'

const mermaid = `flowchart LR
  A[Loading]
`

const diagram = await convertMermaidToReactFlowWithContext(mermaid, {
  nodes: {
    A: {
      type: 'gif',
      src: 'https://media.giphy.com/media/xT0xeJpnrWC4XWblEk/giphy.gif',
    },
  },
})
```

### comment

```ts
import { convertMermaidToReactFlowWithContext } from '@uigraph/sdk'

const mermaid = `flowchart LR
  A[Review this section]
`

const diagram = await convertMermaidToReactFlowWithContext(mermaid, {
  nodes: {
    A: { type: 'comment' },
  },
})
```

### builder

```ts
import {
  ComponentInputType,
  convertMermaidToReactFlowWithContext,
} from '@uigraph/sdk'

const mermaid = `flowchart LR
  A[Login form]
`

const diagram = await convertMermaidToReactFlowWithContext(mermaid, {
  nodes: {
    A: {
      type: 'builder',
      data: {
        Name: { type: ComponentInputType.TextInput, value: 'Login form' },
        Description: {
          type: ComponentInputType.TextBox,
          value: 'Collects user credentials',
        },
      },
    },
  },
})
```

## ComponentInputType

`ComponentInputType` defines the field types you can use in `context.nodes.<nodeId>.data`.

- `TextInput` (`Text Input`) - Single-line text field.
- `URLInput` (`URL Input`) - URL or link field.
- `NumberInput` (`Number Input`) - Numeric value field.
- `TextBox` (`Text Editor`) - Multi-line text field.
- `DatePicker` (`Date Picker`) - Single date field.
- `DropdownSelect` (`Dropdown`) - Single-select dropdown.
- `MultiSelect` (`Multi Select`) - Multi-select dropdown.
- `BooleanToggle` (`Boolean Toggle`) - True/false switch.
- `LinkOrFileUpload` (`Link or File Upload`) - Link or uploaded file field.
- `RichTextEditor` (`Rich Text Editor`) - Rich formatted text field.
- `CodeEditor` (`Code Editor`) - Code input field.
- `KeyValueList` (`Key-Value List`) - Repeated key/value entries.
- `TagInput` (`Tag Input`) - Tag list input.
- `DateRangePicker` (`Date Range Picker`) - Start/end date range field.
- `ColorPicker` (`Color Picker`) - Color value selector.
- `Slider` (`Slider`) - Bounded numeric slider.
- `FileUpload` (`File Upload`) - File upload field.
- `SearchSelect` (`Search Select`) - Searchable select field.
- `CheckboxGroup` (`Checkbox Group`) - Multi-choice checkbox field.

### Example: Use ComponentInputType in Node Data

```ts
import {
  ComponentInputType,
  convertMermaidToReactFlowWithContext,
} from '@uigraph/sdk'

const mermaid = `flowchart LR
  A[Service]
`

const diagram = await convertMermaidToReactFlowWithContext(mermaid, {
  nodes: {
    A: {
      type: 'builder',
      data: {
        Owner: { type: ComponentInputType.TextInput, value: 'Platform Team' },
        Docs: {
          type: ComponentInputType.URLInput,
          value: 'https://example.com/docs/service',
        },
      },
    },
  },
})
```

## Troubleshooting

- If conversion returns no data, validate Mermaid syntax first.
- If a node override does not apply, verify the key in `context.nodes` matches the Mermaid node ID.
- If an edge override does not apply, verify the edge key format is `sourceId-targetId`.
