import { convertMermaidToReactFlowWithContext } from '../mermaid-converter/context/convert-with-context'

const mermaidCode = `flowchart TD
    A[Start] --> B{Is user logged in?}
`

const result = await convertMermaidToReactFlowWithContext(mermaidCode, {
  nodes: {
    A: {
      name: 'Test Image',
      type: 'image',
      src: 'https://via.placeholder.com/150',
    },
  },
})

console.dir(result.nodes, { depth: null })
