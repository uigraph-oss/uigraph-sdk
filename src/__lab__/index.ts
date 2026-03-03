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

  edges: {
    'A-B': {
      style: {
        stroke: 'red',
        strokeWidth: 2,
        strokeStyle: 'dotted',
        borderAnimationEnabled: true,
      },
    },
  },
})

console.dir(result.edges[0], { depth: null })

/* {
  "id": "edge-A-B-0",
  "source": "A",
  "target": "B",
  "label": "sdfgsdfg",
  "type": "straight",
  "animated": true,
  "style": {
    "stroke": "#1976D2",
    "strokeWidth": 4.4,
    strokeDasharray: '4 2'
  },
  "labelStyle": {
    "fontSize": "12px",
    "fontWeight": "500",
    "color": "#1976D2",
    "backgroundColor": "white",
    "padding": "2px 6px",
    "borderRadius": "4px",
    "border": "1px solid #1976D2"
  },
  "markerEnd": {
    "type": "arrowclosed",
    "width": 20,
    "height": 20,
    "color": "#1976D2"
  },
  "sourceHandle": "source-bottom",
  "targetHandle": "target-top",
  "zIndex": 0,
  "data": {
    "source": "mermaid"
  },
  "selected": true,
  "markerStart": {
    "color": "#c51717",
    "strokeWidth": 1.5,
    "type": "arrow",
    "width": 9.6,
    "height": 9.6
  }
} */
