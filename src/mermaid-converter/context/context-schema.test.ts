import { describe, expect, it } from 'vitest'
import { ComponentInputType } from '../../components/component-type'
import { contextSchema } from './context-schema'

describe('node shapes', () => {
  it('accepts every shape a node is allowed to take', () => {
    const parsed = contextSchema.parse({
      nodes: {
        a: { shape: 'rectangle' },
        b: { shape: 'rounded-rect' },
        c: { shape: 'ellipse' },
        d: { shape: 'diamond' },
        e: { shape: 'triangle' },
        f: { shape: 'parallelogram' },
        g: { shape: 'trapezoid' },
        h: { shape: 'hexagon' },
        i: { shape: 'document' },
        j: { shape: 'cylinder' },
        k: { shape: 'delay' },
        l: { shape: 'off-page-connector' },
        m: { shape: 'display' },
        n: { shape: 'collate' },
        o: { shape: 'sort' },
        p: { shape: 'terminator' },
        q: { shape: 'or' },
        r: { shape: 'database' },
        s: { shape: 'multiple-documents' },
        t: { shape: 'subroutine' },
        u: { shape: 'manual-input' },
        v: { shape: 'summing-junction' },
        w: { shape: 'internal-storage' },
      },
    })

    expect(Object.keys(parsed.nodes!)).toHaveLength(23)
  })

  it('rejects a shape that is not one of them', () => {
    expect(() =>
      contextSchema.parse({ nodes: { a: { shape: 'octagon' } } })
    ).toThrow()
  })
})

describe('field types', () => {
  it('rejects a name that is not text', () => {
    expect(() => contextSchema.parse({ nodes: { a: { name: 42 } } })).toThrow()
  })

  it('rejects a style dimension that is written as text', () => {
    expect(() =>
      contextSchema.parse({ nodes: { a: { style: { width: '120' } } } })
    ).toThrow()
  })

  it('rejects a border animation flag that is not a boolean', () => {
    expect(() =>
      contextSchema.parse({
        nodes: { a: { style: { borderAnimationEnabled: 'yes' } } },
      })
    ).toThrow()
  })

  it('accepts a component field that carries its own options', () => {
    const parsed = contextSchema.parse({
      nodes: {
        a: {
          data: {
            Region: {
              type: ComponentInputType.DropdownSelect,
              options: ['eu', 'us'],
              value: 'eu',
            },
          },
        },
      },
    })

    expect(parsed.nodes!.a.data!.Region.options).toEqual(['eu', 'us'])
  })

  it('rejects component field options that are not all text', () => {
    expect(() =>
      contextSchema.parse({
        nodes: {
          a: {
            data: {
              Region: {
                type: ComponentInputType.DropdownSelect,
                options: ['eu', 7],
                value: 'eu',
              },
            },
          },
        },
      })
    ).toThrow()
  })

  it('takes a component field value of any type at all', () => {
    const parsed = contextSchema.parse({
      nodes: {
        a: {
          data: {
            Retries: { type: ComponentInputType.TextInput, value: 3 },
            Tags: { type: ComponentInputType.TextInput, value: ['x', 'y'] },
          },
        },
      },
    })

    expect(parsed.nodes!.a.data!.Retries.value).toBe(3)
    expect(parsed.nodes!.a.data!.Tags.value).toEqual(['x', 'y'])
  })
})

describe('nested node objects', () => {
  it('requires all three names of a database binding', () => {
    expect(() =>
      contextSchema.parse({
        nodes: { a: { dbConfig: { serviceName: 'orders' } } },
      })
    ).toThrow()
  })

  it('requires a table to bring both its columns and its rows', () => {
    expect(() =>
      contextSchema.parse({ nodes: { a: { table: { columns: ['id'] } } } })
    ).toThrow()
  })

  it('rejects a table row that is not a row of text', () => {
    expect(() =>
      contextSchema.parse({
        nodes: { a: { table: { columns: ['id'], rows: [['1'], 2] } } },
      })
    ).toThrow()
  })

  it('requires both coordinates of a pinned position', () => {
    expect(() =>
      contextSchema.parse({ nodes: { a: { ___position: { x: 10 } } } })
    ).toThrow()
  })

  it('carries internal data of any shape through untouched', () => {
    const parsed = contextSchema.parse({
      nodes: { a: { ___internal: { anything: { nested: [1, true] } } } },
    })

    expect(parsed.nodes!.a.___internal).toEqual({
      anything: { nested: [1, true] },
    })
  })
})

describe('edges and groups', () => {
  it('requires a marker to say which type it is', () => {
    expect(() =>
      contextSchema.parse({
        edges: { 'a-b': { markerEnd: { color: '#fff' } } },
      })
    ).toThrow()
  })

  it('keeps a marker that names its type, with or without a color', () => {
    const parsed = contextSchema.parse({
      edges: {
        'a-b': { markerStart: { type: 'arrow' }, markerEnd: { type: 'arrow' } },
      },
    })

    expect(parsed.edges!['a-b'].markerStart!.color).toBeUndefined()
  })

  it('rejects a group whose member list is not a list of node ids', () => {
    expect(() =>
      contextSchema.parse({ groups: { g: { nodes: 'a,b' } } })
    ).toThrow()
  })

  it('accepts a group that only names itself', () => {
    const parsed = contextSchema.parse({ groups: { g: { name: 'Backend' } } })

    expect(parsed.groups!.g.nodes).toBeUndefined()
  })
})
