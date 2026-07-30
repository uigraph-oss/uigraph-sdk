import { describe, expect, it } from 'vitest'
import { SequenceArrowHead } from '../../../types'
import { findArrowTokenFor, parseSequenceDiagram } from '../parser'

type ArrowRequest = {
  lineStyle: 'solid' | 'dashed'
  arrowType: SequenceArrowHead
  half?: 'top' | 'bottom'
  reversed?: boolean
}

function reparse(request: ArrowRequest) {
  const token = findArrowTokenFor(request)
  const { messages } = parseSequenceDiagram(
    ['sequenceDiagram', `  A${token}B: hi`].join('\n')
  )
  const [message] = messages

  return {
    lineStyle: message.lineStyle,
    arrowType: message.arrowType,
    half: message.half,
    reversed: message.reversed,
  }
}

describe('findArrowTokenFor', () => {
  it('picks a half arrow token that parses back to the same barb and direction', () => {
    expect(
      reparse({ lineStyle: 'solid', arrowType: 'half', half: 'top' })
    ).toEqual({
      lineStyle: 'solid',
      arrowType: 'half',
      half: 'top',
      reversed: undefined,
    })
    expect(
      reparse({
        lineStyle: 'solid',
        arrowType: 'half',
        half: 'top',
        reversed: true,
      })
    ).toEqual({
      lineStyle: 'solid',
      arrowType: 'half',
      half: 'top',
      reversed: true,
    })
    expect(
      reparse({ lineStyle: 'dashed', arrowType: 'half', half: 'bottom' })
    ).toEqual({
      lineStyle: 'dashed',
      arrowType: 'half',
      half: 'bottom',
      reversed: undefined,
    })
  })

  it('picks a stick arrow token that parses back to the same barb and direction', () => {
    expect(
      reparse({
        lineStyle: 'dashed',
        arrowType: 'stick',
        half: 'top',
        reversed: true,
      })
    ).toEqual({
      lineStyle: 'dashed',
      arrowType: 'stick',
      half: 'top',
      reversed: true,
    })
    expect(
      reparse({ lineStyle: 'solid', arrowType: 'stick', half: 'bottom' })
    ).toEqual({
      lineStyle: 'solid',
      arrowType: 'stick',
      half: 'bottom',
      reversed: undefined,
    })
  })

  it('drops a barb the requested head has no token for, keeping the head itself', () => {
    expect(
      reparse({ lineStyle: 'solid', arrowType: 'filled', half: 'top' })
    ).toEqual({
      lineStyle: 'solid',
      arrowType: 'filled',
      half: undefined,
      reversed: undefined,
    })
  })

  it('falls back to a filled arrow of the requested line style for an unknown head', () => {
    const unknown = 'sparkle' as SequenceArrowHead

    expect(reparse({ lineStyle: 'solid', arrowType: unknown })).toMatchObject({
      lineStyle: 'solid',
      arrowType: 'filled',
    })
    expect(reparse({ lineStyle: 'dashed', arrowType: unknown })).toMatchObject({
      lineStyle: 'dashed',
      arrowType: 'filled',
    })
  })
})
