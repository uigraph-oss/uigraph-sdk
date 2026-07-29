import {
  C4Boundary,
  C4BoundaryKind,
  C4DiagramData,
  C4DiagramType,
  C4Direction,
  C4Element,
  C4ElementKind,
  C4ElementShape,
  C4ElementStyle,
  C4LayoutConfig,
  C4NodeType,
  C4Relationship,
  C4RelDirection,
  C4RelStyle,
} from '../types/c4'

/** Mermaid's own `c4` config defaults. */
export const DEFAULT_C4_LAYOUT: C4LayoutConfig = {
  c4ShapeInRow: 4,
  c4BoundaryInRow: 2,
}

function buildStereotype(keyword: {
  kind: C4ElementKind
  shape: C4ElementShape
  isExternal: boolean
}): string {
  const suffix =
    keyword.shape === 'db' ? '_db' : keyword.shape === 'queue' ? '_queue' : ''

  return `${keyword.isExternal ? 'external_' : ''}${keyword.kind}${suffix}`
}

const C4_DIAGRAM_TYPES: C4DiagramType[] = [
  'C4Context',
  'C4Container',
  'C4Component',
  'C4Dynamic',
  'C4Deployment',
]

const ELEMENT_KINDS: Record<string, C4ElementKind> = {
  Person: 'person',
  System: 'system',
  Container: 'container',
  Component: 'component',
}

/**
 * Mermaid treats the deployment-node keywords as boundaries, not shapes: they
 * open a scope and their children are laid out inside them.
 */
const BOUNDARY_KEYWORDS: Record<
  string,
  { kind: C4BoundaryKind; fixedType?: string; nodeType?: C4NodeType }
> = {
  Boundary: { kind: 'generic' },
  Enterprise_Boundary: { kind: 'enterprise', fixedType: 'ENTERPRISE' },
  System_Boundary: { kind: 'system', fixedType: 'SYSTEM' },
  Container_Boundary: { kind: 'container', fixedType: 'CONTAINER' },
  Deployment_Node: { kind: 'node', nodeType: 'node' },
  Node: { kind: 'node', nodeType: 'node' },
  Node_L: { kind: 'node', nodeType: 'nodeL' },
  Node_R: { kind: 'node', nodeType: 'nodeR' },
}

const REL_DIRECTIONS: Record<string, C4RelDirection> = {
  Rel: 'default',
  RelIndex: 'default',
  BiRel: 'bi',
  Rel_Back: 'back',
  Rel_U: 'up',
  Rel_Up: 'up',
  Rel_D: 'down',
  Rel_Down: 'down',
  Rel_L: 'left',
  Rel_Left: 'left',
  Rel_R: 'right',
  Rel_Right: 'right',
  Rel_Neighbor: 'default',
  BiRel_Neighbor: 'bi',
}

const DIRECTIONS: C4Direction[] = ['TB', 'BT', 'LR', 'RL']

/** `Person`, `SystemDb_Ext`, `ContainerQueue`, … decomposed into its three axes. */
function parseElementKeyword(keyword: string): {
  kind: C4ElementKind
  shape: C4ElementShape
  isExternal: boolean
} | null {
  let rest = keyword
  let isExternal = false

  if (rest.endsWith('_Ext')) {
    isExternal = true
    rest = rest.slice(0, -'_Ext'.length)
  }

  let shape: C4ElementShape = 'default'
  if (rest.endsWith('Db')) {
    shape = 'db'
    rest = rest.slice(0, -'Db'.length)
  } else if (rest.endsWith('Queue')) {
    shape = 'queue'
    rest = rest.slice(0, -'Queue'.length)
  }

  const kind = ELEMENT_KINDS[rest]
  if (!kind) return null

  return { kind, shape, isExternal }
}

/**
 * Splits `a, "b, c", $tags="x"` on top-level commas only. Empty segments are
 * kept so that mermaid's `Rel(a, b, "x",, "descr")` skip-a-slot form keeps the
 * later arguments in their declared positions.
 */
function splitArguments(raw: string): string[] {
  if (!raw.trim()) return []

  const args: string[] = []
  let current = ''
  let inQuotes = false
  let depth = 0

  for (let i = 0; i < raw.length; i++) {
    const char = raw[i]

    if (char === '"' && raw[i - 1] !== '\\') {
      inQuotes = !inQuotes
      current += char
      continue
    }

    if (!inQuotes && (char === '(' || char === '[')) depth++
    if (!inQuotes && (char === ')' || char === ']')) depth--

    if (char === ',' && !inQuotes && depth === 0) {
      args.push(current.trim())
      current = ''
      continue
    }

    current += char
  }

  args.push(current.trim())

  return args
}

function unquote(value: string): string {
  const trimmed = value.trim()

  if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) {
    return trimmed
      .slice(1, -1)
      .replace(/\\"/g, '"')
      .replace(/<br\s*\/?>/gi, '\n')
      .trim()
  }

  return trimmed.replace(/<br\s*\/?>/gi, '\n')
}

/** Separates `$key="value"` named arguments from positional ones. */
function partitionArguments(args: string[]): {
  positional: string[]
  named: Record<string, string>
} {
  const positional: string[] = []
  const named: Record<string, string> = {}

  for (const arg of args) {
    const match = arg.match(/^\$([A-Za-z0-9_]+)\s*=\s*([\s\S]*)$/)

    if (match) {
      named[match[1]] = unquote(match[2])
      continue
    }

    positional.push(unquote(arg))
  }

  return { positional, named }
}

/** An omitted or `,,`-skipped argument reads as absent, not as an empty string. */
function slot(positional: string[], index: number): string | undefined {
  const value = positional[index]
  if (value === undefined) return undefined
  if (value === '') return undefined

  return value
}

export function isC4Diagram(code: string): boolean {
  for (const line of code.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('%%')) continue

    return C4_DIAGRAM_TYPES.some((type) =>
      trimmed.toLowerCase().startsWith(type.toLowerCase())
    )
  }

  return false
}

/**
 * Joins physical lines into logical statements. C4 allows a call to wrap across
 * lines, so we only emit once parentheses are balanced outside of quotes.
 */
function toStatements(code: string): string[] {
  const statements: string[] = []
  let buffer = ''
  let depth = 0

  for (const rawLine of code.split('\n')) {
    const line = rawLine.replace(/%%.*$/, '').trim()
    if (!line) continue

    buffer = buffer ? `${buffer} ${line}` : line

    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      if (char === '"' && line[i - 1] !== '\\') inQuotes = !inQuotes
      if (inQuotes) continue
      if (char === '(') depth++
      if (char === ')') depth--
    }

    if (depth > 0) continue

    depth = 0
    statements.push(...splitOnBraces(buffer))
    buffer = ''
  }

  if (buffer) statements.push(...splitOnBraces(buffer))

  return statements
}

/**
 * Braces are statement separators of their own, so `Boundary(b, "x") { Person(a)
 * }` written on one line still opens the scope, declares and closes it. The
 * opening brace stays attached to the call that owns it.
 */
function splitOnBraces(buffer: string): string[] {
  const statements: string[] = []
  let current = ''
  let inQuotes = false
  let depth = 0

  function flush() {
    if (current.trim()) statements.push(current.trim())
    current = ''
  }

  for (let i = 0; i < buffer.length; i++) {
    const char = buffer[i]

    if (char === '"' && buffer[i - 1] !== '\\') inQuotes = !inQuotes

    if (!inQuotes && char === '(') depth++
    if (!inQuotes && char === ')') depth--

    if (!inQuotes && depth === 0 && char === '{') {
      current += char
      flush()
      continue
    }

    if (!inQuotes && depth === 0 && char === '}') {
      flush()
      statements.push('}')
      continue
    }

    current += char
  }

  flush()

  return statements
}

export function parseC4Diagram(code: string): C4DiagramData {
  const elements: C4Element[] = []
  const boundaries: C4Boundary[] = []
  const relationships: C4Relationship[] = []
  const elementStyles: Record<string, C4ElementStyle> = {}
  const boundaryStyles: Record<string, C4ElementStyle> = {}
  const relStyles: Record<string, C4RelStyle> = {}
  const layout: C4LayoutConfig = { ...DEFAULT_C4_LAYOUT }

  let type: C4DiagramType = 'C4Context'
  let title: string | undefined
  let accTitle: string | undefined
  let accDescription: string | undefined
  let direction: C4Direction | undefined
  const boundaryStack: string[] = []
  let anonymousBoundaryCount = 0
  let accDescrLines: string[] | undefined

  function currentParentId(): string | undefined {
    return boundaryStack[boundaryStack.length - 1]
  }

  function registerChild(childId: string) {
    const parentId = currentParentId()
    if (!parentId) return

    const parent = boundaries.find((boundary) => boundary.id === parentId)
    if (!parent) return
    if (parent.childIds.includes(childId)) return

    parent.childIds.push(childId)
  }

  for (const statement of toStatements(code)) {
    // A multi-line `accDescr { … }` block swallows everything up to its brace.
    if (accDescrLines) {
      if (statement === '}') {
        accDescription = accDescrLines.join('\n').trim()
        accDescrLines = undefined
        continue
      }

      accDescrLines.push(statement)
      continue
    }

    const detectedType = C4_DIAGRAM_TYPES.find((candidate) =>
      statement.toLowerCase().startsWith(candidate.toLowerCase())
    )

    if (detectedType) {
      type = detectedType
      continue
    }

    if (statement === '}') {
      boundaryStack.pop()
      continue
    }

    const directionMatch = statement.match(/^direction\s+(TB|BT|LR|RL)$/i)
    if (directionMatch) {
      direction = DIRECTIONS.find(
        (candidate) => candidate === directionMatch[1].toUpperCase()
      )
      continue
    }

    const accTitleMatch = statement.match(/^accTitle\s*:\s*(.*)$/i)
    if (accTitleMatch) {
      accTitle = unquote(accTitleMatch[1])
      continue
    }

    if (/^accDescr\s*\{$/i.test(statement)) {
      accDescrLines = []
      continue
    }

    const accDescrMatch = statement.match(/^accDescr\s*:\s*(.*)$/i)
    if (accDescrMatch) {
      accDescription = unquote(accDescrMatch[1])
      continue
    }

    const titleMatch = statement.match(/^title\s+(.*)$/i)
    if (titleMatch) {
      title = unquote(titleMatch[1])
      continue
    }

    const callMatch = statement.match(
      /^([A-Za-z_][A-Za-z0-9_]*)\s*\(([\s\S]*)\)\s*(\{)?\s*$/
    )
    if (!callMatch) continue

    const [, keyword, rawArgs, openBrace] = callMatch
    const { positional, named } = partitionArguments(splitArguments(rawArgs))

    if (keyword === 'UpdateLayoutConfig') {
      const inRow = named.c4ShapeInRow ?? slot(positional, 0)
      const boundaryInRow = named.c4BoundaryInRow ?? slot(positional, 1)

      if (inRow) layout.c4ShapeInRow = Number(inRow) || layout.c4ShapeInRow
      if (boundaryInRow) {
        layout.c4BoundaryInRow = Number(boundaryInRow) || layout.c4BoundaryInRow
      }
      continue
    }

    if (keyword === 'UpdateElementStyle' || keyword === 'UpdateBoundaryStyle') {
      const target = slot(positional, 0)
      if (!target) continue

      const shadowing = named.shadowing ?? slot(positional, 4)

      const style: C4ElementStyle = {
        bgColor: named.bgColor ?? slot(positional, 1),
        fontColor: named.fontColor ?? slot(positional, 2),
        borderColor: named.borderColor ?? slot(positional, 3),
        shadowing: shadowing === undefined ? undefined : shadowing === 'true',
        shape: named.shape ?? slot(positional, 5),
        sprite: named.sprite ?? slot(positional, 6),
        techn: named.techn ?? slot(positional, 7),
        legendText: named.legendText ?? slot(positional, 8),
        legendSprite: named.legendSprite ?? slot(positional, 9),
      }

      // Mermaid resolves the target against shapes first, then boundaries, so
      // a single directive covers both; the maps stay split for the renderer.
      if (keyword === 'UpdateBoundaryStyle') boundaryStyles[target] = style
      else elementStyles[target] = style
      continue
    }

    if (keyword === 'UpdateRelStyle') {
      const from = slot(positional, 0)
      const to = slot(positional, 1)
      if (!from || !to) continue

      const offsetX = named.offsetX ?? slot(positional, 4)
      const offsetY = named.offsetY ?? slot(positional, 5)
      const lineWidth = named.lineWidth

      relStyles[`${from}->${to}`] = {
        textColor: named.textColor ?? slot(positional, 2),
        lineColor: named.lineColor ?? slot(positional, 3),
        offsetX: offsetX === undefined ? undefined : Number(offsetX),
        offsetY: offsetY === undefined ? undefined : Number(offsetY),
        lineWidth: lineWidth === undefined ? undefined : Number(lineWidth),
        lineStyle: named.lineStyle,
      }
      continue
    }

    if (/^(SHOW_|HIDE_)/.test(keyword)) continue

    const boundaryKeyword = BOUNDARY_KEYWORDS[keyword]
    if (boundaryKeyword) {
      const id = slot(positional, 0) ?? `boundary-${++anonymousBoundaryCount}`
      const isNode = boundaryKeyword.nodeType !== undefined

      // `Enterprise_Boundary`/`System_Boundary`/`Container_Boundary` print a
      // fixed type, so their third argument is `?tags`, not a custom type.
      const defaultType = isNode ? 'node' : 'system'
      const boundaryType =
        boundaryKeyword.fixedType ??
        named.type ??
        slot(positional, 2) ??
        defaultType
      const tagsIndex = boundaryKeyword.fixedType ? 2 : isNode ? 5 : 3

      const boundary: C4Boundary = {
        id,
        label: slot(positional, 1) ?? id,
        kind: boundaryKeyword.kind,
        type: boundaryType,
        description: isNode
          ? (named.descr ?? slot(positional, 3))
          : named.descr,
        nodeType: boundaryKeyword.nodeType,
        parentId: currentParentId(),
        childIds: [],
        sprite: named.sprite ?? (isNode ? slot(positional, 4) : undefined),
        tags: named.tags ?? slot(positional, tagsIndex),
        link: named.link,
      }

      registerChild(id)

      const existing = boundaries.findIndex((entry) => entry.id === id)
      if (existing === -1) boundaries.push(boundary)
      else {
        boundaries[existing] = {
          ...boundary,
          childIds: boundaries[existing].childIds,
        }
      }

      if (openBrace) boundaryStack.push(id)
      continue
    }

    const relDirection = REL_DIRECTIONS[keyword]
    if (relDirection) {
      // `RelIndex(index, from, to, …)` carries a leading sequence number that
      // mermaid ignores — ordering comes from the statement order instead.
      const args = keyword === 'RelIndex' ? positional.slice(1) : positional

      const from = slot(args, 0)
      const to = slot(args, 1)
      if (!from || !to) continue

      const relationship: C4Relationship = {
        from,
        to,
        label: slot(args, 2) ?? '',
        technology: named.techn ?? slot(args, 3),
        description: named.descr ?? slot(args, 4),
        direction: relDirection,
        index: relationships.length,
        sprite: named.sprite ?? slot(args, 5),
        tags: named.tags ?? slot(args, 6),
        link: named.link,
      }

      const existing = relationships.findIndex(
        (entry) => entry.from === from && entry.to === to
      )
      if (existing === -1) relationships.push(relationship)
      else {
        relationships[existing] = {
          ...relationship,
          index: relationships[existing].index,
        }
      }
      continue
    }

    const elementKeyword = parseElementKeyword(keyword)
    if (elementKeyword) {
      const id = slot(positional, 0)
      if (!id) continue

      // Only Container and Component take a technology argument; Person and
      // System are `(alias, label, ?descr, ?sprite, ?tags, $link)`.
      const hasTechnologySlot =
        elementKeyword.kind === 'container' ||
        elementKeyword.kind === 'component'
      const descrIndex = hasTechnologySlot ? 3 : 2
      const link = named.link

      const element: C4Element = {
        id,
        label: slot(positional, 1) ?? id,
        technology:
          named.techn ?? (hasTechnologySlot ? slot(positional, 2) : undefined),
        description: named.descr ?? slot(positional, descrIndex),
        kind: elementKeyword.kind,
        shape: elementKeyword.shape,
        isExternal: elementKeyword.isExternal,
        stereotype: buildStereotype(elementKeyword),
        parentId: currentParentId(),
        sprite: named.sprite ?? slot(positional, descrIndex + 1),
        tags: named.tags ?? slot(positional, descrIndex + 2),
        link,
        subDiagramId: link?.startsWith('uig:')
          ? link.slice('uig:'.length)
          : undefined,
      }

      registerChild(id)

      const existing = elements.findIndex((entry) => entry.id === id)
      if (existing === -1) elements.push(element)
      else elements[existing] = element

      continue
    }
  }

  return {
    type,
    title,
    accTitle,
    accDescription,
    direction,
    elements,
    boundaries,
    relationships,
    elementStyles,
    boundaryStyles,
    relStyles,
    layout,
  }
}
