import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  canonicalizeValue,
  cleanEdgeForSync,
  cleanNodeForSync,
  computeCanonicalSyncPayload,
  computeDiagramSyncHash,
} from './index'

const TRANSIENT_NODE_KEYS = [
  'selected',
  'dragging',
  'resizing',
  'positionAbsolute',
  'measured',
  'internals',
  'handleBounds',
  'childNodes',
]

const PREFIX = 'uigraph-sync-v1:'

function permutations<T>(items: T[]): T[][] {
  if (items.length <= 1) return [items]

  const result: T[][] = []
  for (let index = 0; index < items.length; index++) {
    const rest = [...items.slice(0, index), ...items.slice(index + 1)]
    for (const perm of permutations(rest)) {
      result.push([items[index], ...perm])
    }
  }
  return result
}

function createRandom(seed: number) {
  let state = seed >>> 0
  return function next(): number {
    state = (state + 0x6d2b79f5) >>> 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function randomValue(random: () => number, depth: number): unknown {
  const pick = Math.floor(random() * (depth <= 0 ? 6 : 9))

  if (pick === 0) return null
  if (pick === 1) return random() < 0.5
  if (pick === 2) return Math.floor(random() * 2000) - 1000
  if (pick === 3) return random() * 1000
  if (pick === 4) return `text-${Math.floor(random() * 100000)}`
  if (pick === 5) return ''
  if (pick === 6) {
    const length = Math.floor(random() * 4)
    return Array.from({ length }, () => randomValue(random, depth - 1))
  }
  if (pick === 7) {
    const keys = ['zeta', 'alpha', 'Mid', 'b', '10', '2', 'ünicode', 'a b']
    const result: Record<string, unknown> = {}
    const count = Math.floor(random() * keys.length)
    for (let index = 0; index < count; index++) {
      result[keys[Math.floor(random() * keys.length)]] = randomValue(
        random,
        depth - 1
      )
    }
    return result
  }
  return undefined
}

function randomNode(random: () => number, index: number): unknown {
  const node: Record<string, unknown> = {
    id: `node-${index}`,
    type: random() < 0.5 ? 'component' : 'group',
    position: {
      x: Math.floor(random() * 1000),
      y: Math.floor(random() * 1000),
    },
    data: randomValue(random, 3),
  }

  for (const key of TRANSIENT_NODE_KEYS) {
    if (random() < 0.5) node[key] = randomValue(random, 2)
  }
  return node
}

function randomEdge(random: () => number, index: number): unknown {
  const edge: Record<string, unknown> = {
    id: `edge-${index}`,
    source: `node-${Math.floor(random() * 5)}`,
    target: `node-${Math.floor(random() * 5)}`,
    label: `edge label ${index}`,
    data: randomValue(random, 2),
  }

  if (random() < 0.5) edge.selected = random() < 0.5
  if (random() < 0.5) edge.measured = { width: 10, height: 20 }
  return edge
}

function randomDiagram(seed: number) {
  const random = createRandom(seed)
  const nodeCount = Math.floor(random() * 6)
  const edgeCount = Math.floor(random() * 6)

  return {
    nodes: Array.from({ length: nodeCount }, (_, index) =>
      randomNode(random, index)
    ),
    edges: Array.from({ length: edgeCount }, (_, index) =>
      randomEdge(random, index)
    ),
  }
}

function shuffleKeysDeep(value: unknown, random: () => number): unknown {
  if (value === null || typeof value !== 'object') return value
  if (Array.isArray(value)) {
    return value.map((item) => shuffleKeysDeep(item, random))
  }

  const entries = Object.entries(value as Record<string, unknown>)
  for (let index = entries.length - 1; index > 0; index--) {
    const swap = Math.floor(random() * (index + 1))
    const held = entries[index]
    entries[index] = entries[swap]
    entries[swap] = held
  }

  const result: Record<string, unknown> = {}
  for (const [key, item] of entries) {
    result[key] = shuffleKeysDeep(item, random)
  }
  return result
}

function expectedHash(payload: string): string {
  return createHash('sha256').update(payload, 'utf8').digest('hex')
}

const SEEDS = Array.from({ length: 60 }, (_, index) => index + 1)

describe('canonicalizeValue', () => {
  it.each([
    ['null', null],
    ['zero', 0],
    ['negative zero', -0],
    ['one', 1],
    ['negative', -42],
    ['float', 3.14159],
    ['max safe integer', Number.MAX_SAFE_INTEGER],
    ['min safe integer', Number.MIN_SAFE_INTEGER],
    ['epsilon', Number.EPSILON],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['-Infinity', Number.NEGATIVE_INFINITY],
    ['empty string', ''],
    ['string', 'hello'],
    ['whitespace string', '   '],
    ['unicode string', 'héllo wörld'],
    ['emoji string', '🚀🌍'],
    ['newline string', 'a\nb'],
    ['quote string', 'a"b'],
    ['backslash string', 'a\\b'],
    ['true', true],
    ['false', false],
    ['undefined', undefined],
    ['bigint', 10n],
  ])('returns %s unchanged', (_label, value) => {
    expect(canonicalizeValue(value)).toBe(value)
  })

  it.each(permutations(['b', 'a', 'd', 'c']))(
    'sorts object keys inserted as %s, %s, %s, %s',
    (...keys) => {
      const input: Record<string, number> = {}
      keys.forEach((key, index) => {
        input[key] = index
      })

      expect(Object.keys(canonicalizeValue(input) as object)).toEqual([
        'a',
        'b',
        'c',
        'd',
      ])
    }
  )

  it.each(Array.from({ length: 30 }, (_, index) => index + 1))(
    'sorts keys at nesting depth %i',
    (depth) => {
      let value: unknown = { zebra: 1, alpha: 2 }
      for (let level = 0; level < depth; level++) {
        value = { zulu: value, april: level }
      }

      const serialized = JSON.stringify(canonicalizeValue(value))
      expect(serialized.indexOf('"april"')).toBeLessThan(
        serialized.indexOf('"zulu"')
      )
      expect(serialized).toContain('{"alpha":2,"zebra":1}')
    }
  )

  it('preserves array order', () => {
    expect(canonicalizeValue([3, 1, 2])).toEqual([3, 1, 2])
  })

  it('canonicalizes objects inside arrays', () => {
    expect(JSON.stringify(canonicalizeValue([{ b: 1, a: 2 }]))).toBe(
      '[{"a":2,"b":1}]'
    )
  })

  it('drops undefined object values', () => {
    expect(canonicalizeValue({ a: undefined, b: 1 })).toEqual({ b: 1 })
  })

  it('keeps undefined array entries in place', () => {
    expect(canonicalizeValue([undefined, 1])).toEqual([undefined, 1])
  })

  it('keeps null object values', () => {
    expect(canonicalizeValue({ a: null })).toEqual({ a: null })
  })

  it('returns a new object rather than mutating the input', () => {
    const input = { b: 1, a: 2 }
    const output = canonicalizeValue(input)

    expect(output).not.toBe(input)
    expect(Object.keys(input)).toEqual(['b', 'a'])
  })

  it('returns a new array rather than mutating the input', () => {
    const input = [{ b: 1, a: 2 }]
    expect(canonicalizeValue(input)).not.toBe(input)
  })

  it('sorts by code unit, not locale', () => {
    expect(Object.keys(canonicalizeValue({ a: 1, B: 2 }) as object)).toEqual([
      'B',
      'a',
    ])
  })

  it.each([
    ['10', '2'],
    ['b', 'a'],
    ['ünicode', 'unicode'],
    ['🚀', 'a'],
    ['a b', 'ab'],
    ['_x', 'x'],
    ['', 'a'],
    ['A', 'a'],
    ['0', 'A'],
    ['-', '0'],
  ])('sorts %s and %s deterministically', (first, second) => {
    const forward = canonicalizeValue({ [first]: 1, [second]: 2 })
    const backward = canonicalizeValue({ [second]: 2, [first]: 1 })

    expect(JSON.stringify(forward)).toBe(JSON.stringify(backward))
  })
})

describe('cleanNodeForSync', () => {
  it.each(TRANSIENT_NODE_KEYS)('strips %s from a node', (key) => {
    expect(cleanNodeForSync({ id: 'a', [key]: 'junk' })).toEqual({ id: 'a' })
  })

  it.each(TRANSIENT_NODE_KEYS)('keeps %s when nested inside data', (key) => {
    const node = { id: 'a', data: { [key]: 'kept' } }
    expect(cleanNodeForSync(node)).toEqual(node)
  })

  it.each(TRANSIENT_NODE_KEYS)(
    'strips %s regardless of its value being falsy',
    (key) => {
      expect(cleanNodeForSync({ id: 'a', [key]: false })).toEqual({ id: 'a' })
      expect(cleanNodeForSync({ id: 'a', [key]: 0 })).toEqual({ id: 'a' })
      expect(cleanNodeForSync({ id: 'a', [key]: null })).toEqual({ id: 'a' })
    }
  )

  it('strips every transient key at once', () => {
    const node: Record<string, unknown> = { id: 'a', type: 'component' }
    for (const key of TRANSIENT_NODE_KEYS) {
      node[key] = 'junk'
    }

    expect(cleanNodeForSync(node)).toEqual({ id: 'a', type: 'component' })
  })

  it('drops undefined values', () => {
    expect(cleanNodeForSync({ id: 'a', width: undefined })).toEqual({ id: 'a' })
  })

  it('keeps null values', () => {
    expect(cleanNodeForSync({ id: 'a', parentId: null })).toEqual({
      id: 'a',
      parentId: null,
    })
  })

  it('does not mutate the input', () => {
    const node = { id: 'a', selected: true }
    cleanNodeForSync(node)

    expect(node.selected).toBe(true)
  })

  it('returns an empty object for an empty node', () => {
    expect(cleanNodeForSync({})).toEqual({})
  })

  it.each([
    'id',
    'type',
    'position',
    'data',
    'width',
    'height',
    'parentId',
    'extent',
    'zIndex',
    'style',
    'className',
    'sourcePosition',
    'targetPosition',
    'hidden',
    'draggable',
  ])('keeps the persistent key %s', (key) => {
    expect(cleanNodeForSync({ [key]: 'value' })).toEqual({ [key]: 'value' })
  })
})

describe('cleanEdgeForSync', () => {
  it('strips selected from an edge', () => {
    expect(cleanEdgeForSync({ id: 'e1', selected: true })).toEqual({ id: 'e1' })
  })

  it.each(TRANSIENT_NODE_KEYS.filter((key) => key !== 'selected'))(
    'keeps the node-only transient key %s on an edge',
    (key) => {
      expect(cleanEdgeForSync({ id: 'e1', [key]: 'kept' })).toEqual({
        id: 'e1',
        [key]: 'kept',
      })
    }
  )

  it('drops undefined values', () => {
    expect(cleanEdgeForSync({ id: 'e1', label: undefined })).toEqual({
      id: 'e1',
    })
  })

  it('keeps null values', () => {
    expect(cleanEdgeForSync({ id: 'e1', label: null })).toEqual({
      id: 'e1',
      label: null,
    })
  })

  it('does not mutate the input', () => {
    const edge = { id: 'e1', selected: true }
    cleanEdgeForSync(edge)

    expect(edge.selected).toBe(true)
  })

  it.each([
    'id',
    'source',
    'target',
    'sourceHandle',
    'targetHandle',
    'label',
    'type',
    'data',
    'animated',
    'style',
    'markerEnd',
  ])('keeps the persistent key %s', (key) => {
    expect(cleanEdgeForSync({ [key]: 'value' })).toEqual({ [key]: 'value' })
  })
})

describe('computeCanonicalSyncPayload', () => {
  it('produces the documented payload for an empty diagram', () => {
    expect(computeCanonicalSyncPayload({ nodes: [], edges: [] })).toBe(
      `${PREFIX}{"edges":[],"nodes":[]}`
    )
  })

  it.each([
    ['both missing', {}],
    ['nodes missing', { edges: [] }],
    ['edges missing', { nodes: [] }],
    ['nodes null', { nodes: null as unknown as unknown[] }],
    ['edges null', { edges: null as unknown as unknown[] }],
    ['nodes not an array', { nodes: 'x' as unknown as unknown[] }],
    ['edges not an array', { edges: 42 as unknown as unknown[] }],
    ['nodes an object', { nodes: {} as unknown as unknown[] }],
    ['both undefined', { nodes: undefined, edges: undefined }],
  ])('falls back to empty arrays when %s', (_label, diagram) => {
    expect(computeCanonicalSyncPayload(diagram)).toBe(
      `${PREFIX}{"edges":[],"nodes":[]}`
    )
  })

  it('places edges before nodes', () => {
    const payload = computeCanonicalSyncPayload({
      nodes: [{ id: 'n' }],
      edges: [{ id: 'e' }],
    })

    expect(payload.indexOf('"edges"')).toBeLessThan(payload.indexOf('"nodes"'))
  })

  it('starts with the version prefix', () => {
    expect(computeCanonicalSyncPayload({ nodes: [], edges: [] })).toMatch(
      /^uigraph-sync-v1:/
    )
  })

  it.each(TRANSIENT_NODE_KEYS)(
    'ignores the node key %s when hashing the payload',
    (key) => {
      const withKey = computeCanonicalSyncPayload({
        nodes: [{ id: 'n', [key]: 'junk' }],
        edges: [],
      })
      const withoutKey = computeCanonicalSyncPayload({
        nodes: [{ id: 'n' }],
        edges: [],
      })

      expect(withKey).toBe(withoutKey)
    }
  )

  it('ignores selected on edges', () => {
    expect(
      computeCanonicalSyncPayload({
        nodes: [],
        edges: [{ id: 'e', selected: true }],
      })
    ).toBe(computeCanonicalSyncPayload({ nodes: [], edges: [{ id: 'e' }] }))
  })

  it.each(permutations(['id', 'type', 'position', 'data']))(
    'is stable when node keys are written in the order %s, %s, %s, %s',
    (...keys) => {
      const source: Record<string, unknown> = {
        id: 'n1',
        type: 'component',
        position: { x: 1, y: 2 },
        data: { label: 'A' },
      }
      const node: Record<string, unknown> = {}
      for (const key of keys) {
        node[key] = source[key]
      }

      expect(computeCanonicalSyncPayload({ nodes: [node], edges: [] })).toBe(
        computeCanonicalSyncPayload({ nodes: [source], edges: [] })
      )
    }
  )

  it.each([
    ['null node', null],
    ['number node', 7],
    ['string node', 'node'],
    ['boolean node', true],
  ])('passes through a non-object %s', (_label, node) => {
    expect(computeCanonicalSyncPayload({ nodes: [node], edges: [] })).toBe(
      `${PREFIX}{"edges":[],"nodes":[${JSON.stringify(node)}]}`
    )
  })

  it('normalizes an undefined node entry to null', () => {
    expect(computeCanonicalSyncPayload({ nodes: [undefined], edges: [] })).toBe(
      `${PREFIX}{"edges":[],"nodes":[null]}`
    )
  })

  it('normalizes Date values to ISO strings', () => {
    const payload = computeCanonicalSyncPayload({
      nodes: [{ id: 'n', data: { at: new Date('2026-08-24T00:00:00.000Z') } }],
      edges: [],
    })

    expect(payload).toContain('"at":"2026-08-24T00:00:00.000Z"')
  })

  it('normalizes NaN and Infinity to null', () => {
    const payload = computeCanonicalSyncPayload({
      nodes: [
        { id: 'n', position: { x: Number.NaN, y: Number.POSITIVE_INFINITY } },
      ],
      edges: [],
    })

    expect(payload).toContain('"x":null')
    expect(payload).toContain('"y":null')
  })

  it('drops circular React Flow internals before serializing', () => {
    const node: Record<string, unknown> = { id: 'n', position: { x: 0, y: 0 } }
    node.internals = { userNode: node }

    expect(computeCanonicalSyncPayload({ nodes: [node], edges: [] })).toBe(
      computeCanonicalSyncPayload({
        nodes: [{ id: 'n', position: { x: 0, y: 0 } }],
        edges: [],
      })
    )
  })

  it('preserves node order', () => {
    const forward = computeCanonicalSyncPayload({
      nodes: [{ id: 'a' }, { id: 'b' }],
      edges: [],
    })
    const reversed = computeCanonicalSyncPayload({
      nodes: [{ id: 'b' }, { id: 'a' }],
      edges: [],
    })

    expect(forward).not.toBe(reversed)
  })

  it('preserves edge order', () => {
    const forward = computeCanonicalSyncPayload({
      nodes: [],
      edges: [{ id: 'a' }, { id: 'b' }],
    })
    const reversed = computeCanonicalSyncPayload({
      nodes: [],
      edges: [{ id: 'b' }, { id: 'a' }],
    })

    expect(forward).not.toBe(reversed)
  })

  it('does not mutate the input diagram', () => {
    const node = { id: 'n', selected: true, position: { x: 1, y: 2 } }
    const diagram = { nodes: [node], edges: [] }
    computeCanonicalSyncPayload(diagram)

    expect(node.selected).toBe(true)
    expect(diagram.nodes[0]).toBe(node)
  })

  it.each(SEEDS)(
    'is invariant to key insertion order for random diagram %i',
    (seed) => {
      const diagram = randomDiagram(seed)
      const shuffled = shuffleKeysDeep(
        JSON.parse(JSON.stringify(diagram)),
        createRandom(seed * 7919)
      ) as { nodes: unknown[]; edges: unknown[] }

      expect(computeCanonicalSyncPayload(shuffled)).toBe(
        computeCanonicalSyncPayload(diagram)
      )
    }
  )
})

describe('computeDiagramSyncHash', () => {
  it('returns 64 lowercase hex characters', async () => {
    await expect(
      computeDiagramSyncHash({ nodes: [], edges: [] })
    ).resolves.toMatch(/^[0-9a-f]{64}$/)
  })

  it('matches the SHA-256 of the canonical payload for an empty diagram', async () => {
    await expect(
      computeDiagramSyncHash({ nodes: [], edges: [] })
    ).resolves.toBe(expectedHash(`${PREFIX}{"edges":[],"nodes":[]}`))
  })

  it.each(SEEDS)(
    'matches the SHA-256 of the canonical payload for random diagram %i',
    async (seed) => {
      const diagram = randomDiagram(seed)

      await expect(computeDiagramSyncHash(diagram)).resolves.toBe(
        expectedHash(computeCanonicalSyncPayload(diagram))
      )
    }
  )

  it.each(SEEDS)(
    'is stable across the browser and the stored JSON for random diagram %i',
    async (seed) => {
      const diagram = randomDiagram(seed)
      const stored = JSON.parse(JSON.stringify(diagram)) as {
        nodes: unknown[]
        edges: unknown[]
      }

      await expect(computeDiagramSyncHash(stored)).resolves.toBe(
        await computeDiagramSyncHash(diagram)
      )
    }
  )

  it.each(SEEDS)('is deterministic for random diagram %i', async (seed) => {
    const diagram = randomDiagram(seed)

    await expect(computeDiagramSyncHash(diagram)).resolves.toBe(
      await computeDiagramSyncHash(randomDiagram(seed))
    )
  })

  it.each([
    ['a moved node', { nodes: [{ id: 'n', position: { x: 1, y: 0 } }] }],
    [
      'a renamed node',
      { nodes: [{ id: 'renamed', position: { x: 0, y: 0 } }] },
    ],
    [
      'an extra node',
      { nodes: [{ id: 'n', position: { x: 0, y: 0 } }, { id: 'm' }] },
    ],
    ['no nodes', { nodes: [] }],
    [
      'a typed node',
      { nodes: [{ id: 'n', position: { x: 0, y: 0 }, type: 'group' }] },
    ],
    ['node data', { nodes: [{ id: 'n', position: { x: 0, y: 0 }, data: {} }] }],
    ['a float position', { nodes: [{ id: 'n', position: { x: 0.1, y: 0 } }] }],
    ['a string position', { nodes: [{ id: 'n', position: { x: '0', y: 0 } }] }],
    ['a null position', { nodes: [{ id: 'n', position: null }] }],
    ['an added edge', { edges: [{ id: 'e' }] }],
  ])('produces a different hash for %s', async (_label, override) => {
    const base = { nodes: [{ id: 'n', position: { x: 0, y: 0 } }], edges: [] }

    await expect(
      computeDiagramSyncHash({ ...base, ...override })
    ).resolves.not.toBe(await computeDiagramSyncHash(base))
  })

  it.each(TRANSIENT_NODE_KEYS)(
    'produces the same hash when the node key %s changes',
    async (key) => {
      const base = { nodes: [{ id: 'n', position: { x: 0, y: 0 } }], edges: [] }

      await expect(
        computeDiagramSyncHash({
          nodes: [{ id: 'n', position: { x: 0, y: 0 }, [key]: 'junk' }],
          edges: [],
        })
      ).resolves.toBe(await computeDiagramSyncHash(base))
    }
  )

  it.each(Array.from({ length: 40 }, (_, index) => index))(
    'produces a distinct hash for node id variant %i',
    async (index) => {
      const hash = await computeDiagramSyncHash({
        nodes: [{ id: `node-${index}` }],
        edges: [],
      })
      const neighbour = await computeDiagramSyncHash({
        nodes: [{ id: `node-${index + 1}` }],
        edges: [],
      })

      expect(hash).not.toBe(neighbour)
      expect(hash).toMatch(/^[0-9a-f]{64}$/)
    }
  )

  it('hashes unicode payloads consistently with UTF-8 bytes', async () => {
    const diagram = {
      nodes: [{ id: 'n', data: { label: '🚀 héllo' } }],
      edges: [],
    }

    await expect(computeDiagramSyncHash(diagram)).resolves.toBe(
      expectedHash(computeCanonicalSyncPayload(diagram))
    )
  })

  it('handles a large diagram', async () => {
    const diagram = {
      nodes: Array.from({ length: 500 }, (_, index) => ({
        id: `node-${index}`,
        position: { x: index, y: index * 2 },
        data: { label: `Node ${index}` },
        selected: index % 2 === 0,
      })),
      edges: Array.from({ length: 500 }, (_, index) => ({
        id: `edge-${index}`,
        source: `node-${index}`,
        target: `node-${(index + 1) % 500}`,
      })),
    }

    await expect(computeDiagramSyncHash(diagram)).resolves.toBe(
      expectedHash(computeCanonicalSyncPayload(diagram))
    )
  })
})
