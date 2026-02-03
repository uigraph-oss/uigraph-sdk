import { ComponentInputType } from '../components/component-type'
import { convertMermaidToReactFlowWithContext } from '../context/convert-with-context'

const mermaidCode = `
graph TD
  A[Start] --> B[Stop]
`

const result = await convertMermaidToReactFlowWithContext(mermaidCode, {
  name: 'Test Context',
  description: 'Test Description',
  nodes: {
    A: {
      type: 'text',

      meta: {
        text: {
          type: ComponentInputType.TextInput,
          value: 'Start',
        },

        NAME: {
          type: ComponentInputType.NumberInput,
          value: 10,
        },
      },
    },
  },
})

console.dir(result.nodes[0], { depth: null })
