import {
  SequenceActivation,
  SequenceArrowHead,
  SequenceBlock,
  SequenceBlockType,
  SequenceBox,
  SequenceDiagramData,
  SequenceMessage,
  SequenceNote,
  SequenceParticipant,
  SequenceParticipantType,
} from '../../types'

/**
 * Full parser for https://mermaid.js.org/syntax/sequenceDiagram.html.
 *
 * Everything the page documents is handled here: participant/actor
 * declarations (incl. `@{...}` stereotypes and both alias forms), create and
 * destroy directives, boxes, every arrow variant, central connections,
 * activations (dedicated and `+`/`-` shorthand, stacked), notes, loop/alt/
 * opt/par/critical/break/rect blocks, autonumber, actor menus, comments,
 * entity codes, line breaks, title and accessibility statements.
 */

type ArrowToken = {
  token: string
  lineStyle: 'solid' | 'dashed'
  arrowType: SequenceArrowHead
  half?: 'top' | 'bottom'
  reversed?: boolean
}

// Longest first: `-->>` must win over `->>`, `--x` over `-x`, and so on.
const ARROW_TOKENS: ArrowToken[] = [
  { token: '<<-->>', lineStyle: 'dashed', arrowType: 'bidirectional' },
  { token: '<<->>', lineStyle: 'solid', arrowType: 'bidirectional' },
  { token: '--|\\', lineStyle: 'dashed', arrowType: 'half', half: 'top' },
  { token: '-|\\', lineStyle: 'solid', arrowType: 'half', half: 'top' },
  { token: '--|/', lineStyle: 'dashed', arrowType: 'half', half: 'bottom' },
  { token: '-|/', lineStyle: 'solid', arrowType: 'half', half: 'bottom' },
  {
    token: '/|--',
    lineStyle: 'dashed',
    arrowType: 'half',
    half: 'top',
    reversed: true,
  },
  {
    token: '/|-',
    lineStyle: 'solid',
    arrowType: 'half',
    half: 'top',
    reversed: true,
  },
  {
    token: '\\--',
    lineStyle: 'dashed',
    arrowType: 'half',
    half: 'bottom',
    reversed: true,
  },
  {
    token: '\\-',
    lineStyle: 'solid',
    arrowType: 'half',
    half: 'bottom',
    reversed: true,
  },
  {
    token: '//--',
    lineStyle: 'dashed',
    arrowType: 'stick',
    half: 'top',
    reversed: true,
  },
  {
    token: '//-',
    lineStyle: 'solid',
    arrowType: 'stick',
    half: 'top',
    reversed: true,
  },
  { token: '--//', lineStyle: 'dashed', arrowType: 'stick', half: 'bottom' },
  { token: '-//', lineStyle: 'solid', arrowType: 'stick', half: 'bottom' },
  { token: '--\\', lineStyle: 'dashed', arrowType: 'stick', half: 'top' },
  { token: '-\\', lineStyle: 'solid', arrowType: 'stick', half: 'top' },
  { token: '-->>', lineStyle: 'dashed', arrowType: 'filled' },
  { token: '->>', lineStyle: 'solid', arrowType: 'filled' },
  { token: '--x', lineStyle: 'dashed', arrowType: 'cross' },
  { token: '-x', lineStyle: 'solid', arrowType: 'cross' },
  { token: '--)', lineStyle: 'dashed', arrowType: 'open' },
  { token: '-)', lineStyle: 'solid', arrowType: 'open' },
  { token: '-->', lineStyle: 'dashed', arrowType: 'none' },
  { token: '->', lineStyle: 'solid', arrowType: 'none' },
]

/**
 * The arrow token that parses back to exactly this arrow. Used by the
 * react-flow -> mermaid direction so both directions share one table: an exact
 * match on `half`/`reversed` wins, otherwise the plain form of the head.
 */
export function findArrowTokenFor(options: {
  lineStyle: 'solid' | 'dashed'
  arrowType: SequenceArrowHead
  half?: 'top' | 'bottom'
  reversed?: boolean
}): string {
  const exact = ARROW_TOKENS.find(
    (candidate) =>
      candidate.lineStyle === options.lineStyle &&
      candidate.arrowType === options.arrowType &&
      candidate.half === options.half &&
      Boolean(candidate.reversed) === Boolean(options.reversed)
  )
  if (exact) return exact.token

  const byHead = ARROW_TOKENS.find(
    (candidate) =>
      candidate.lineStyle === options.lineStyle &&
      candidate.arrowType === options.arrowType
  )
  if (byHead) return byHead.token

  if (options.lineStyle === 'dashed') return '-->>'
  return '->>'
}

const BLOCK_OPENERS: SequenceBlockType[] = [
  'loop',
  'alt',
  'opt',
  'par',
  'critical',
  'break',
  'rect',
]

// `else`, `and` and `option` open a new branch inside the block they're in
// rather than a block of their own.
const SECTION_KEYWORDS = ['else', 'and', 'option']

const CSS_COLOR_NAMES = new Set(
  `transparent aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue
   blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan
   darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen
   darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey
   darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite
   forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink
   indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral
   lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen
   lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta
   maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue
   mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin
   navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen
   paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red
   rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue
   slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white
   whitesmoke yellow yellowgreen`
    .split(/\s+/)
    .filter(Boolean)
)

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
}

/**
 * Mermaid labels carry HTML entity codes (`&#35;` is the only way to write a
 * `#`, since `#` starts a comment) and `<br/>` line breaks. Both are display
 * text, so they're resolved at parse time — downstream layout measures the
 * real string, not the escape sequence.
 */
export function decodeSequenceText(raw: string): string {
  return raw
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
      String.fromCodePoint(parseInt(hex, 16))
    )
    .replace(/&#(\d+);/g, (_, dec: string) =>
      String.fromCodePoint(parseInt(dec, 10))
    )
    .replace(/&([a-z]+);/gi, (match, name: string) => {
      const decoded = NAMED_ENTITIES[name.toLowerCase()]
      if (decoded === undefined) return match
      return decoded
    })
    .trim()
}

function findArrow(
  line: string
): { arrow: ArrowToken; start: number; end: number } | undefined {
  for (let i = 0; i < line.length; i++) {
    for (const arrow of ARROW_TOKENS) {
      if (line.startsWith(arrow.token, i)) {
        return { arrow, start: i, end: i + arrow.token.length }
      }
    }
  }
  return undefined
}

/**
 * Splits `box <color?> <label?>` / `rect <color>`. A leading functional color
 * (`rgb(…)`, `hsla(…)`) or a bare CSS color name is the box color; anything
 * else is all label — which is why `box Another Group` stays a label while
 * `box transparent Aqua` is a transparent box labelled "Aqua".
 */
function splitColorAndLabel(rest: string): { color?: string; label: string } {
  const trimmed = rest.trim()
  if (!trimmed) return { label: '' }

  const functional = trimmed.match(/^(rgba?|hsla?)\s*\([^)]*\)/i)
  if (functional) {
    return {
      color: functional[0],
      label: trimmed.slice(functional[0].length).trim(),
    }
  }

  const [firstWord, ...restWords] = trimmed.split(/\s+/)
  if (CSS_COLOR_NAMES.has(firstWord.toLowerCase())) {
    return { color: firstWord, label: restWords.join(' ') }
  }

  return { label: trimmed }
}

/**
 * Reads `Name@{ "type": "database", "alias": "User DB" }` followed by an
 * optional ` as External Name`. Both alias forms are documented; when both are
 * present the external one wins.
 */
function parseParticipantDeclaration(rest: string): {
  id: string
  name: string
  alias?: string
  type?: SequenceParticipantType
} {
  const trimmed = rest.trim()
  const configStart = trimmed.indexOf('@{')

  let id: string
  let remainder: string
  let type: SequenceParticipantType | undefined
  let inlineAlias: string | undefined

  if (configStart === -1) {
    const asMatch = trimmed.match(/^(.*?)\s+as\s+(.+)$/i)
    id = (asMatch ? asMatch[1] : trimmed).trim()
    remainder = asMatch ? decodeSequenceText(asMatch[2]) : ''
    return { id, name: remainder || id, alias: remainder || undefined, type }
  }

  id = trimmed.slice(0, configStart).trim()
  const configEnd = trimmed.indexOf('}', configStart)
  const configText =
    configEnd === -1 ? '' : trimmed.slice(configStart + 1, configEnd + 1)
  remainder = configEnd === -1 ? '' : trimmed.slice(configEnd + 1).trim()

  try {
    const config = JSON.parse(configText) as Record<string, string>
    if (typeof config.type === 'string') {
      type = config.type as SequenceParticipantType
    }
    if (typeof config.alias === 'string') inlineAlias = config.alias
  } catch {
    // A malformed stereotype shouldn't lose the participant itself.
  }

  const asMatch = remainder.match(/^as\s+(.+)$/i)
  const externalAlias = asMatch ? decodeSequenceText(asMatch[1]) : undefined
  const alias =
    externalAlias ?? (inlineAlias && decodeSequenceText(inlineAlias))

  return { id, name: alias ?? id, alias, type }
}

export function parseSequenceDiagram(code: string): SequenceDiagramData {
  const participants: SequenceParticipant[] = []
  const participantMap = new Map<string, SequenceParticipant>()
  const messages: SequenceMessage[] = []
  const notes: SequenceNote[] = []
  const blocks: SequenceBlock[] = []
  const boxes: SequenceBox[] = []
  const activations: SequenceActivation[] = []

  const openActivations = new Map<string, number[]>()
  const blockStack: SequenceBlock[] = []
  const openStack: Array<{ kind: 'block' | 'box'; id: string }> = []
  let openBox: SequenceBox | undefined

  let autonumber: SequenceAutonumberState | undefined
  let title: string | undefined
  let accTitle: string | undefined
  let accDescr: string | undefined
  let row = 0
  let pendingCreate: { type: 'participant' | 'actor'; rest: string } | undefined

  function ensureParticipant(
    id: string,
    options: {
      name?: string
      alias?: string
      type?: SequenceParticipantType
      declared?: boolean
    } = {}
  ): SequenceParticipant {
    const existing = participantMap.get(id)
    if (existing) {
      if (options.alias !== undefined) {
        existing.alias = options.alias
        existing.name = options.alias
      }
      if (options.type !== undefined) existing.type = options.type
      return existing
    }

    const participant: SequenceParticipant = {
      id,
      name: options.name ?? id,
      alias: options.alias,
      index: participants.length,
      type: options.type ?? 'participant',
      links: [],
      boxId: openBox?.id,
    }
    participants.push(participant)
    participantMap.set(id, participant)
    if (openBox) openBox.participants.push(id)
    return participant
  }

  function activate(id: string, atRow: number) {
    const stack = openActivations.get(id) ?? []
    stack.push(atRow)
    openActivations.set(id, stack)
  }

  function deactivate(id: string, atRow: number) {
    const stack = openActivations.get(id)
    if (!stack || stack.length === 0) return
    const startRow = stack.pop()!
    activations.push({ participant: id, startRow, endRow: atRow })
  }

  const lines = code.split('\n')

  for (let index = 0; index < lines.length; index++) {
    const raw = lines[index]
    const withoutComment = raw.replace(/%%.*$/, '')
    const trimmed = withoutComment.trim()

    if (!trimmed) continue
    if (/^sequencediagram\b/i.test(trimmed)) continue

    const accDescrBlock = trimmed.match(/^accDescr\s*\{$/i)
    if (accDescrBlock) {
      const collected: string[] = []
      index++
      while (index < lines.length && !/^\s*\}\s*$/.test(lines[index])) {
        collected.push(lines[index].trim())
        index++
      }
      accDescr = collected.join('\n')
      continue
    }

    const titleMatch = trimmed.match(/^title\s*:?\s*(.*)$/i)
    if (titleMatch) {
      title = decodeSequenceText(titleMatch[1])
      continue
    }

    const accTitleMatch = trimmed.match(/^accTitle\s*:\s*(.*)$/i)
    if (accTitleMatch) {
      accTitle = decodeSequenceText(accTitleMatch[1])
      continue
    }

    const accDescrMatch = trimmed.match(/^accDescr\s*:\s*(.*)$/i)
    if (accDescrMatch) {
      accDescr = decodeSequenceText(accDescrMatch[1])
      continue
    }

    const autonumberMatch = trimmed.match(
      /^autonumber(?:\s+(off|[\d.]+))?(?:\s+([\d.]+))?$/i
    )
    if (autonumberMatch) {
      const [, first, second] = autonumberMatch
      if (first?.toLowerCase() === 'off') {
        autonumber = undefined
        continue
      }
      const start = first === undefined ? 1 : Number(first)
      const step = second === undefined ? 1 : Number(second)
      autonumber = { start, step, next: start, declaredStart: start }
      continue
    }

    const boxMatch = trimmed.match(/^box\b\s*(.*)$/i)
    if (boxMatch) {
      const { color, label } = splitColorAndLabel(boxMatch[1])
      const box: SequenceBox = {
        id: `box-${boxes.length}`,
        label: decodeSequenceText(label),
        color,
        participants: [],
      }
      boxes.push(box)
      openBox = box
      openStack.push({ kind: 'box', id: box.id })
      continue
    }

    if (/^end$/i.test(trimmed)) {
      const open = openStack.pop()
      if (open?.kind === 'box') {
        openBox = undefined
        continue
      }
      const block = blockStack.pop()
      if (block) {
        block.endRow = row - 1
        const lastSection = block.sections[block.sections.length - 1]
        if (lastSection) lastSection.endRow = row - 1
      }
      continue
    }

    const blockOpener = BLOCK_OPENERS.find((keyword) =>
      new RegExp(`^${keyword}\\b`, 'i').test(trimmed)
    )
    if (blockOpener) {
      const rest = trimmed.slice(blockOpener.length).trim()
      const { color, label } =
        blockOpener === 'rect'
          ? splitColorAndLabel(rest)
          : { color: undefined, label: rest }
      const parent = blockStack[blockStack.length - 1]
      const block: SequenceBlock = {
        id: `block-${blocks.length}`,
        type: blockOpener,
        label: decodeSequenceText(label),
        color,
        sections: [
          { label: decodeSequenceText(label), startRow: row, endRow: row },
        ],
        startRow: row,
        endRow: row,
        depth: blockStack.length,
        parentId: parent?.id,
      }
      blocks.push(block)
      blockStack.push(block)
      openStack.push({ kind: 'block', id: block.id })
      continue
    }

    const sectionKeyword = SECTION_KEYWORDS.find((keyword) =>
      new RegExp(`^${keyword}\\b`, 'i').test(trimmed)
    )
    if (sectionKeyword) {
      const block = blockStack[blockStack.length - 1]
      if (block) {
        const previous = block.sections[block.sections.length - 1]
        if (previous) previous.endRow = row - 1
        block.sections.push({
          label: decodeSequenceText(
            trimmed.slice(sectionKeyword.length).trim()
          ),
          startRow: row,
          endRow: row,
        })
      }
      continue
    }

    const createMatch = trimmed.match(/^create\s+(participant|actor)\s+(.+)$/i)
    if (createMatch) {
      pendingCreate = {
        type: createMatch[1].toLowerCase() as 'participant' | 'actor',
        rest: createMatch[2],
      }
      continue
    }

    const destroyMatch = trimmed.match(/^destroy\s+(.+)$/i)
    if (destroyMatch) {
      const target = ensureParticipant(destroyMatch[1].trim())
      target.destroyedAtRow = row
      continue
    }

    const participantMatch = trimmed.match(/^(participant|actor)\s+(.+)$/i)
    if (participantMatch) {
      const keyword = participantMatch[1].toLowerCase() as
        | 'participant'
        | 'actor'
      const declaration = parseParticipantDeclaration(participantMatch[2])
      ensureParticipant(declaration.id, {
        name: declaration.name,
        alias: declaration.alias,
        type: declaration.type ?? keyword,
      })
      continue
    }

    const activateMatch = trimmed.match(/^(activate|deactivate)\s+(.+)$/i)
    if (activateMatch) {
      const target = ensureParticipant(activateMatch[2].trim())
      if (activateMatch[1].toLowerCase() === 'activate') {
        activate(target.id, row)
      } else {
        // Activation ranges are inclusive row spans. A dedicated `deactivate`
        // sits *after* the last message it covers, so the bar ends on the
        // previous row — unlike the `-` shorthand, which deactivates on the
        // row of its own message.
        deactivate(target.id, row - 1)
      }
      continue
    }

    const noteMatch = trimmed.match(
      /^note\s+(right of|left of|over)\s+([^:]+):\s*(.*)$/i
    )
    if (noteMatch) {
      const noteParticipants = noteMatch[2]
        .split(',')
        .map((name) => name.trim())
        .filter(Boolean)
      noteParticipants.forEach((name) => ensureParticipant(name))
      notes.push({
        placement: noteMatch[1].toLowerCase() as SequenceNote['placement'],
        participants: noteParticipants.map((name) => name),
        text: decodeSequenceText(noteMatch[3]),
        rowIndex: row,
      })
      row++
      continue
    }

    const linksMatch = trimmed.match(/^links\s+([^:]+):\s*(\{.*\})$/i)
    if (linksMatch) {
      const target = ensureParticipant(linksMatch[1].trim())
      try {
        const parsed = JSON.parse(linksMatch[2]) as Record<string, string>
        for (const [label, url] of Object.entries(parsed)) {
          target.links.push({ label, url })
        }
      } catch {
        // Malformed JSON menus are ignored, as mermaid does.
      }
      continue
    }

    const linkMatch = trimmed.match(/^link\s+([^:]+):\s*(.+?)\s*@\s*(\S+)$/i)
    if (linkMatch) {
      const target = ensureParticipant(linkMatch[1].trim())
      target.links.push({
        label: linkMatch[2].trim(),
        url: linkMatch[3].trim(),
      })
      continue
    }

    const colonIndex = trimmed.indexOf(':')
    const arrowMatch = findArrow(
      colonIndex === -1 ? trimmed : trimmed.slice(0, colonIndex)
    )
    if (!arrowMatch || colonIndex === -1) continue

    const { arrow, start, end } = arrowMatch
    let fromRaw = trimmed.slice(0, start).trim()
    let toRaw = trimmed.slice(end, colonIndex).trim()
    const label = decodeSequenceText(trimmed.slice(colonIndex + 1))

    const centralSource = fromRaw.endsWith('()')
    if (centralSource) fromRaw = fromRaw.slice(0, -2).trim()

    let activates = false
    let deactivates = false
    let centralTarget = false

    // `+`/`-` and `()` both sit between the arrow and the target name, in
    // either order (`->>+()B` and `->>()+B` are both legal input).
    let scanning = true
    while (scanning) {
      scanning = false
      if (toRaw.startsWith('+')) {
        activates = true
        toRaw = toRaw.slice(1).trim()
        scanning = true
      }
      if (toRaw.startsWith('-')) {
        deactivates = true
        toRaw = toRaw.slice(1).trim()
        scanning = true
      }
      if (toRaw.startsWith('()')) {
        centralTarget = true
        toRaw = toRaw.slice(2).trim()
        scanning = true
      }
    }

    if (!fromRaw || !toRaw) continue

    ensureParticipant(fromRaw)

    if (pendingCreate) {
      const declaration = parseParticipantDeclaration(pendingCreate.rest)
      const created = ensureParticipant(declaration.id, {
        name: declaration.name,
        alias: declaration.alias,
        type: declaration.type ?? pendingCreate.type,
      })
      created.createdAtRow = row
      pendingCreate = undefined
      toRaw = declaration.id
    }

    const to = ensureParticipant(toRaw)

    const message: SequenceMessage = {
      from: fromRaw,
      to: to.id,
      label,
      lineStyle: arrow.lineStyle,
      arrowType: arrow.arrowType,
      rowIndex: row,
    }

    if (arrow.half) message.half = arrow.half
    if (arrow.reversed) message.reversed = true
    if (centralSource) message.centralSource = true
    if (centralTarget) message.centralTarget = true
    if (activates) message.activates = true
    if (deactivates) message.deactivates = true

    if (autonumber) {
      message.sequenceNumber = autonumber.next
      autonumber.next = Number((autonumber.next + autonumber.step).toFixed(2))
    }

    if (activates) activate(to.id, row)
    if (deactivates) deactivate(fromRaw, row)

    messages.push(message)
    row++
  }

  // An actor left activated (or a `loop`/`box` left unclosed) shouldn't drop
  // its bar — close it at the last row instead.
  for (const [participant, stack] of openActivations) {
    for (const startRow of stack) {
      activations.push({
        participant,
        startRow,
        endRow: Math.max(row - 1, startRow),
      })
    }
  }
  for (const block of blockStack) {
    block.endRow = row - 1
    const lastSection = block.sections[block.sections.length - 1]
    if (lastSection) lastSection.endRow = row - 1
  }

  activations.sort((a, b) => a.startRow - b.startRow)

  return {
    participants,
    messages,
    notes,
    blocks,
    boxes,
    activations,
    ...(autonumber
      ? {
          autonumber: {
            start: autonumber.declaredStart,
            step: autonumber.step,
          },
        }
      : {}),
    ...(title === undefined ? {} : { title }),
    ...(accTitle === undefined ? {} : { accTitle }),
    ...(accDescr === undefined ? {} : { accDescr }),
  }
}

type SequenceAutonumberState = {
  start: number
  step: number
  next: number
  declaredStart: number
}
