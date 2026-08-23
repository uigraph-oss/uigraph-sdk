const TRANSIENT_NODE_KEYS = new Set([
  'selected',
  'dragging',
  'resizing',
  'positionAbsolute',
  'measured',
  'internals',
  'handleBounds',
  'childNodes',
])

const TRANSIENT_EDGE_KEYS = new Set(['selected'])

export function cleanNodeForSync(
  node: Record<string, unknown>
): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(node)) {
    if (!TRANSIENT_NODE_KEYS.has(key) && value !== undefined) {
      cleaned[key] = value
    }
  }
  return cleaned
}

export function cleanEdgeForSync(
  edge: Record<string, unknown>
): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(edge)) {
    if (!TRANSIENT_EDGE_KEYS.has(key) && value !== undefined) {
      cleaned[key] = value
    }
  }
  return cleaned
}

export function canonicalizeValue(val: unknown): unknown {
  if (val === null || typeof val !== 'object') {
    return val
  }
  if (Array.isArray(val)) {
    return val.map(canonicalizeValue)
  }
  const obj = val as Record<string, unknown>
  const sortedKeys = Object.keys(obj).sort()
  const result: Record<string, unknown> = {}
  for (const key of sortedKeys) {
    const value = obj[key]
    if (value !== undefined) {
      result[key] = canonicalizeValue(value)
    }
  }
  return result
}

export function computeCanonicalSyncPayload(diagram: {
  nodes?: unknown[]
  edges?: unknown[]
}): string {
  const nodes = Array.isArray(diagram.nodes) ? diagram.nodes : []
  const edges = Array.isArray(diagram.edges) ? diagram.edges : []

  const cleanedNodes = nodes.map((node) =>
    node !== null && typeof node === 'object'
      ? cleanNodeForSync(node as Record<string, unknown>)
      : node
  )
  const cleanedEdges = edges.map((edge) =>
    edge !== null && typeof edge === 'object'
      ? cleanEdgeForSync(edge as Record<string, unknown>)
      : edge
  )

  const serialized = JSON.parse(
    JSON.stringify({ edges: cleanedEdges, nodes: cleanedNodes })
  ) as unknown

  return `uigraph-sync-v1:${JSON.stringify(canonicalizeValue(serialized))}`
}

export async function computeDiagramSyncHash(diagram: {
  nodes?: unknown[]
  edges?: unknown[]
}): Promise<string> {
  const subtle = globalThis.crypto?.subtle
  if (subtle === undefined) {
    throw new Error(
      'computeDiagramSyncHash requires SubtleCrypto, which is only available in a secure context (https or localhost)'
    )
  }

  const payload = computeCanonicalSyncPayload(diagram)
  const digest = await subtle.digest(
    'SHA-256',
    new TextEncoder().encode(payload)
  )

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}
