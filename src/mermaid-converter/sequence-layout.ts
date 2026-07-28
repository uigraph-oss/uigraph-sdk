import { SEQUENCE_LAYOUT } from './constants/layout'

/**
 * Simulates greedy word-boundary wrapping (like CSS `overflow-wrap: break-word`)
 * to count the resulting lines. A naive `totalChars / charsPerLine` estimate is
 * wrong whenever a short word is followed by a long unbreakable token — e.g.
 * "GET /v1/stores/{storeId} (batch hydrate)" strands "GET" alone on its own line
 * because "/v1/stores/{storeId}" doesn't fit next to it, producing 3 real lines
 * where a char-count average predicts 2.
 */
function estimateLines(words: string[], charsPerLine: number): number {
  let lines = 1
  let current = 0

  for (const word of words) {
    if (word.length > charsPerLine) {
      if (current > 0) lines += 1
      const wordLines = Math.ceil(word.length / charsPerLine)
      lines += wordLines - 1
      current = word.length - (wordLines - 1) * charsPerLine
      continue
    }

    const next = current === 0 ? word.length : current + 1 + word.length
    if (next > charsPerLine) {
      lines += 1
      current = word.length
    } else {
      current = next
    }
  }

  return lines
}

/**
 * Sizes a sequence message box from its own label text, targeting a ~2-line
 * wrap. A fixed width makes long labels ("Return Checkout Session client
 * secret") wrap into 4+ jagged lines that overflow the box and collide with
 * the row below.
 */
export function estimateSequenceMessageBoxSize(label: string): {
  width: number
  height: number
} {
  const {
    MESSAGE_NODE_WIDTH,
    MESSAGE_NODE_HEIGHT,
    MESSAGE_MAX_WIDTH,
    MESSAGE_TARGET_WRAP_LINES,
    MESSAGE_CHAR_WIDTH,
    MESSAGE_LINE_HEIGHT,
    MESSAGE_HORIZONTAL_PADDING,
    MESSAGE_VERTICAL_PADDING,
  } = SEQUENCE_LAYOUT

  const text = label.trim()

  if (!text) {
    return { width: MESSAGE_NODE_WIDTH, height: MESSAGE_NODE_HEIGHT }
  }

  // `<br/>` in the source became a real newline at parse time; each segment
  // wraps independently and they stack, so measure them as separate blocks.
  if (text.includes('\n')) {
    const segments = text
      .split('\n')
      .map((segment) => estimateSequenceMessageBoxSize(segment))
    return {
      width: Math.max(...segments.map((segment) => segment.width)),
      height: segments.reduce(
        (total, segment) =>
          total + segment.height - Number(MESSAGE_VERTICAL_PADDING),
        Number(MESSAGE_VERTICAL_PADDING)
      ),
    }
  }

  const words = text.split(/\s+/).filter(Boolean)
  const longestWord = Math.max(1, ...words.map((w) => w.length))

  // Never choose a width narrower than the longest word needs — a width picked
  // purely from the average would strand that word on its own line (or force
  // mid-word breaks), inflating the real line count past the estimate.
  const idealCharsPerLine = Math.max(
    1,
    Math.ceil(text.length / MESSAGE_TARGET_WRAP_LINES)
  )
  const charsPerLineNeeded = Math.max(idealCharsPerLine, longestWord)

  const width = Math.min(
    MESSAGE_MAX_WIDTH,
    Math.max(
      MESSAGE_NODE_WIDTH,
      MESSAGE_HORIZONTAL_PADDING + charsPerLineNeeded * MESSAGE_CHAR_WIDTH
    )
  )

  const charsPerLine = Math.max(
    1,
    Math.floor((width - MESSAGE_HORIZONTAL_PADDING) / MESSAGE_CHAR_WIDTH)
  )
  const lines = estimateLines(words, charsPerLine)
  const height = Math.max(
    MESSAGE_NODE_HEIGHT,
    lines * MESSAGE_LINE_HEIGHT + MESSAGE_VERTICAL_PADDING
  )

  return { width, height }
}
