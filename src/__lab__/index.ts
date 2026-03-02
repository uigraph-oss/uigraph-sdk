import { convertMermaidToReactFlowWithContext } from '../mermaid-converter/context/convert-with-context'

const mermaidCode = `flowchart TD
    A[Start] --> B{Is user logged in?}
    B -- Yes --> C[Show dashboard]
    B -- No --> D[Show login page]
    D --> E[User logs in]
    E --> C
    C --> F[End]
`

const result = await convertMermaidToReactFlowWithContext(mermaidCode, {
  name: 'Test Context',
  description: 'Test Description',
})

console.dir(result.edges, { depth: null })
