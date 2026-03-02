import { ComponentInputType } from '../components/component-type'
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
      data: {
        Text: {
          type: ComponentInputType.RichTextEditor,
          value: '# Hello World',
        },
      },
    },
  },
})

console.dir(result.nodes[0], { depth: null })
