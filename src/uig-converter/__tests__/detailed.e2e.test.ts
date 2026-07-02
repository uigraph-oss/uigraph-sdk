import { describe, expect, it } from 'vitest'
import { contextSchema } from '../../headless'
import { convertMermaidToReactFlowWithContext } from '../../mermaid-converter/context/convert-with-context'
import { convertUiGraphToMermaid } from '../index'

describe('convertUiGraphToMermaid detailed labels e2e', () => {
  it('keeps code nodes self-explanatory from all-standard input', async () => {
    const mermaidCode =
      'flowchart LR\nTextNode --> Doc\nDoc --> CodeBlock\nCodeBlock --> TableNode\nTableNode --> CommentNode'
    const context = contextSchema.parse({
      name: 'All general standard context',
      nodes: {
        TextNode: {
          type: 'text',
          name: 'Text',
          value: 'Standard text node',
        },
        Doc: {
          type: 'shape',
          shape: 'document',
          name: 'Document',
        },
        CodeBlock: {
          type: 'code',
          name: 'Code Block',
          value:
            "// Sample: greet function\nfunction greet(name) {\n  return `Hello, ${name}!`;\n}\n\nconsole.log(greet('World'));",
        },
        TableNode: {
          type: 'table',
          name: 'Table',
          table: {
            columns: ['ID', 'Name', 'Status'],
            rows: [
              ['1', 'Task A', 'Done'],
              ['2', 'Task B', 'In Progress'],
            ],
          },
        },
        CommentNode: {
          type: 'comment',
          name: 'Comment',
        },
      },
      edges: {
        'CodeBlock-TableNode': {
          label: 'outputs',
          style: {
            stroke: '#1976D2',
            strokeWidth: 2,
            strokeStyle: 'dashed',
          },
          markerEnd: { type: 'arrow', color: '#1976D2' },
        },
      },
      groups: {},
    })

    const reactFlow = await convertMermaidToReactFlowWithContext(
      mermaidCode,
      context
    )
    const converted = convertUiGraphToMermaid(reactFlow, {
      detailedContext: true,
    })

    expect(converted.mermaid).toContain('Code: // Sample: greet function')
    expect(converted.mermaid).toContain('Table: Table')
  })

  it('keeps data-source nodes self-explanatory from database input', async () => {
    const mermaidCode =
      'flowchart LR\norders[Orders]\nproducts[Products]\norders --> products'
    const context = contextSchema.parse({
      name: 'Database nodes diagram context',
      nodes: {
        orders: {
          type: 'data-source',
          name: 'Orders',
          dbConfig: {
            serviceName: 'UIGraph Adapter',
            databaseName: 'ecommerce',
            tableName: 'orders',
          },
          data: {
            'RPO (minutes)': { type: 'Number Input', value: 15 },
            Owner: { type: 'Text Input', value: 'Commerce Team' },
          },
        },
        products: {
          type: 'data-source',
          name: 'Products',
          dbConfig: {
            serviceName: 'UIGraph Adapter',
            databaseName: 'ecommerce',
            tableName: 'products',
          },
        },
      },
      edges: {
        'orders-products': {
          label: 'product_id',
          markerEnd: { type: 'arrow' },
        },
      },
      groups: {},
    })

    const reactFlow = await convertMermaidToReactFlowWithContext(
      mermaidCode,
      context
    )
    const converted = convertUiGraphToMermaid(reactFlow, {
      detailedContext: true,
    })

    expect(converted.mermaid).toContain('DataSource: Orders')
    expect(converted.mermaid).toContain('db: ecommerce.orders')
    expect(converted.mermaid).toContain('service: UIGraph Adapter')
  })
})
