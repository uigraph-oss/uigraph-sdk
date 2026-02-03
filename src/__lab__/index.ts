import { convertMermaidToReactFlowWithContext } from '../context/convert-with-context'

const mermaidCode = `
graph TD
  A[Start] --> B[Stop]
`

const result = await convertMermaidToReactFlowWithContext(mermaidCode, {
  name: 'Test Context',
  description: 'Test Description',
  groups: {
    group1: {
      nodes: ['A', 'B'],
    },
  },
})

console.dir(result.nodes, { depth: null })
