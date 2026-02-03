import { ComponentInputType } from '../components/component-type'
import { convertWithContext } from '../context/convert-with-context'

const mermaidCode = `
graph TD
  A[Start] --> B[Stop]
`

const result = await convertWithContext(mermaidCode, {
  name: 'Test Context',
  description: 'Test Description',
  nodes: {
    A: {
      type: 'text',

      data: {
        text: {
          type: ComponentInputType.TextInput,
          value: 'Start',
        },

        name: {
          type: ComponentInputType.NumberInput,
          value: 10,
        },
      },
    },
  },
})

console.dir(result.nodes[0], { depth: null })
