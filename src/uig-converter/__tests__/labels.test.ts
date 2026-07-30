import { Node } from '@xyflow/react'
import { describe, expect, it } from 'vitest'
import { ComponentInputType } from '../../components/component-type'
import { resolveMermaidDetailedNodeLabel } from '../labels/detailed-node-label'

function nodeWithFields(type: string, fields: Record<string, unknown>[]): Node {
  return {
    id: 'n',
    type,
    position: { x: 0, y: 0 },
    data: { componentFields: fields },
  }
}

describe('detailed labels for nodes the diagram never draws inline', () => {
  it('counts the children of a group', () => {
    const label = resolveMermaidDetailedNodeLabel({
      id: 'g',
      type: 'group',
      position: { x: 0, y: 0 },
      data: { childNodes: ['a', 'b'] },
    })

    expect(label).toBe('Group\nchildren: 2')
  })

  it('titles a node type it has no special handling for', () => {
    const label = resolveMermaidDetailedNodeLabel({
      id: 'u',
      type: 'sticky',
      position: { x: 0, y: 0 },
      data: { label: 'Remember the retry budget' },
    })

    expect(label).toBe('Sticky: Remember the retry budget')
  })

  it('calls a node with no type at all a node', () => {
    const label = resolveMermaidDetailedNodeLabel({
      id: 'u',
      position: { x: 0, y: 0 },
      data: { label: 'Remember the retry budget' },
    })

    expect(label).toBe('Node: Remember the retry budget')
  })
})

describe('detailed labels for a data source', () => {
  it('names a data source after its table when nobody named it', () => {
    const label = resolveMermaidDetailedNodeLabel({
      id: 'd',
      type: 'data-source',
      position: { x: 0, y: 0 },
      data: {
        serviceTable: {
          serviceName: 'Adapter',
          databaseName: 'analytics',
          tableName: 'sessions',
        },
      },
    })

    expect(label).toContain('DataSource: sessions')
  })

  it('reads the database details off a dbConfig when there is no service table', () => {
    const label = resolveMermaidDetailedNodeLabel({
      id: 'd',
      type: 'databaseTableSQL',
      position: { x: 0, y: 0 },
      data: {
        dbConfig: {
          serviceName: 'reporting',
          databaseName: 'analytics',
          tableName: 'sessions',
        },
      },
    })

    expect(label).toContain('db: analytics.sessions')
    expect(label).toContain('service: reporting')
  })
})

describe('detailed field values', () => {
  it('joins the entries of a list field with commas', () => {
    const label = resolveMermaidDetailedNodeLabel(
      nodeWithFields('shape', [
        {
          label: 'Tags',
          type: ComponentInputType.TagInput,
          data: [{ value: ['api', 'edge'] }],
        },
      ])
    )

    expect(label).toBe('Tags: api,edge')
  })

  it('shows no more than the first two entries of a structured field', () => {
    const label = resolveMermaidDetailedNodeLabel(
      nodeWithFields('shape', [
        {
          label: 'Window',
          type: ComponentInputType.DateRangePicker,
          data: [{ value: { from: 'mon', to: 'fri', note: 'skip me' } }],
        },
      ])
    )

    expect(label).toBe('Window: from:mon,to:fri')
  })

  it('lists the choices alongside the one that was picked', () => {
    const label = resolveMermaidDetailedNodeLabel(
      nodeWithFields('shape', [
        {
          label: 'Tier',
          type: ComponentInputType.DropdownSelect,
          data: [{ value: 'gold' }],
          options: ['gold', 'silver'],
        },
      ])
    )

    expect(label).toBe('Tier: gold [gold/silver]')
  })

  it('still lists the choices when none of them was picked', () => {
    const label = resolveMermaidDetailedNodeLabel(
      nodeWithFields('shape', [
        {
          label: 'Region',
          type: ComponentInputType.DropdownSelect,
          data: [{ value: '' }],
          options: ['eu', 'us'],
        },
      ])
    )

    expect(label).toBe('Region: [eu/us]')
  })

  it('skips a field whose input type is not one the editor offers', () => {
    const label = resolveMermaidDetailedNodeLabel(
      nodeWithFields('shape', [
        {
          label: 'Name',
          type: ComponentInputType.TextInput,
          data: [{ value: 'Gateway' }],
        },
        {
          label: 'Wobble',
          type: 'Wobble Input',
          data: [{ value: 'nonsense' }],
        },
      ])
    )

    expect(label).toBe('Name: Gateway')
  })
})

describe('detailed rich text', () => {
  it('reads the ops out of a quill document that wraps them in an object', () => {
    const label = resolveMermaidDetailedNodeLabel(
      nodeWithFields('shape', [
        {
          label: 'Notes',
          type: ComponentInputType.RichTextEditor,
          data: [
            {
              ops: [
                { insert: 'retry', attributes: { code: true } },
                { insert: '\n' },
              ],
            },
          ],
        },
      ])
    )

    expect(label).toBe('Notes: `retry`')
  })

  it('writes a linked run of text as markdown', () => {
    const label = resolveMermaidDetailedNodeLabel(
      nodeWithFields('shape', [
        {
          label: 'Notes',
          type: ComponentInputType.RichTextEditor,
          data: [
            {
              ops: [
                {
                  insert: 'the runbook',
                  attributes: { link: 'https://runbook.dev' },
                },
                { insert: '\n' },
              ],
            },
          ],
        },
      ])
    )

    expect(label).toBe('Notes: [the runbook](https://runbook.dev)')
  })
})
