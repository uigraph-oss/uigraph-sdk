import { describe, expect, it } from 'vitest'
import { SEQUENCE_LAYOUT } from '../../constants/layout'
import { estimateSequenceMessageBoxSize } from '../layout'

describe('estimateSequenceMessageBoxSize', () => {
  it('falls back to the bare node size when there is no text to measure', () => {
    expect(estimateSequenceMessageBoxSize('   ')).toEqual({
      width: SEQUENCE_LAYOUT.MESSAGE_NODE_WIDTH,
      height: SEQUENCE_LAYOUT.MESSAGE_NODE_HEIGHT,
    })
  })

  it('floors short labels to one shared size instead of sizing them proportionally', () => {
    expect(estimateSequenceMessageBoxSize('Hi')).toEqual(
      estimateSequenceMessageBoxSize('Hello')
    )
  })

  it('grows the box for a label that needs more room than the floor', () => {
    const short = estimateSequenceMessageBoxSize('Hi')
    const longer = estimateSequenceMessageBoxSize(
      'Return checkout session client secret'
    )

    expect(longer.width).toBeGreaterThan(short.width)
  })

  it('caps the width however long the label gets', () => {
    const { width } = estimateSequenceMessageBoxSize(
      'A label so long that no reasonable wrap target could ever fit it on two lines without running off the side of the diagram entirely'
    )

    expect(width).toBe(SEQUENCE_LAYOUT.MESSAGE_MAX_WIDTH)
  })

  it('widens for an unbreakable token rather than stranding it on its own line', () => {
    const oneLongWord = estimateSequenceMessageBoxSize(
      'GET/v1/stores/storeId/hydrate'
    )
    const sameLengthInShortWords = estimateSequenceMessageBoxSize(
      'GET v1 stores by id and hydrate'
    )

    expect(oneLongWord.width).toBeGreaterThan(sameLengthInShortWords.width)
  })

  it('gets taller once the text wraps past the height the floor allows', () => {
    const wrapped = estimateSequenceMessageBoxSize(
      'The client asks the gateway to hydrate every store it can reach before the deadline'
    )

    expect(wrapped.height).toBeGreaterThan(SEQUENCE_LAYOUT.MESSAGE_NODE_HEIGHT)
  })

  it('stacks the segments of a multi-line label into one taller box', () => {
    const first = 'Short'
    const second = 'A much longer second line of text here'
    const stacked = estimateSequenceMessageBoxSize(`${first}\n${second}`)
    const top = estimateSequenceMessageBoxSize(first)
    const bottom = estimateSequenceMessageBoxSize(second)

    expect(stacked.width).toBe(Math.max(top.width, bottom.width))
    expect(stacked.height).toBeGreaterThan(Math.max(top.height, bottom.height))
    expect(stacked.height).toBeLessThan(top.height + bottom.height)
  })

  it('measures the trimmed label, so surrounding whitespace changes nothing', () => {
    expect(estimateSequenceMessageBoxSize('  Confirm the payment  ')).toEqual(
      estimateSequenceMessageBoxSize('Confirm the payment')
    )
  })
})
