import { MarkerType } from '@xyflow/react'
import { describe, expect, it } from 'vitest'
import { createEdgeMarker, parseEdgeMarker } from './index'

describe('parseEdgeMarker', () => {
  it('returns undefined for undefined input', () => {
    expect(parseEdgeMarker(undefined)).toBeUndefined()
  })

  it('wraps string marker into type object', () => {
    expect(parseEdgeMarker('arrow')).toEqual({ type: 'arrow' })
  })

  it('returns object marker as custom marker', () => {
    const marker = { type: MarkerType.ArrowClosed, color: 'red' }
    expect(parseEdgeMarker(marker)).toEqual(marker)
  })
})

describe('createEdgeMarker', () => {
  it('returns undefined when marker is missing or type is none', () => {
    expect(createEdgeMarker(undefined)).toBeUndefined()
    expect(createEdgeMarker({ type: 'none' as MarkerType })).toBeUndefined()
  })

  it('returns EdgeMarker object for arrow types', () => {
    const result = createEdgeMarker({ type: MarkerType.Arrow })
    expect(result).toEqual(
      expect.objectContaining({
        type: MarkerType.Arrow,
        color: 'context-stroke',
        strokeWidth: 1.5,
      })
    )
  })

  it('returns marker type string for custom types', () => {
    const result = createEdgeMarker({ type: 'erdOne' })
    expect(result).toBe('erdOne')
  })
})
