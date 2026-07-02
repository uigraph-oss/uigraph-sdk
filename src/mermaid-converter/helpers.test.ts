import { describe, expect, it } from 'vitest'
import { parseLabelTag, resolvePortalNodeType } from './helpers'

describe('parseLabelTag', () => {
  it('returns tag and display label for type prefix', () => {
    const result = parseLabelTag('type:image: Logo')
    expect(result).toEqual({ tag: 'image', displayLabel: 'Logo' })
  })

  it('supports pipe separator', () => {
    const result = parseLabelTag('type:cloud|AWS EC2')
    expect(result).toEqual({ tag: 'cloud', displayLabel: 'AWS EC2' })
  })

  it('returns null tag when no prefix present', () => {
    const result = parseLabelTag('Plain label')
    expect(result).toEqual({ tag: null, displayLabel: 'Plain label' })
  })
})

describe('resolvePortalNodeType', () => {
  it('returns image when image url present', () => {
    expect(resolvePortalNodeType(true, null)).toBe('image')
  })

  it('returns image when tag is image', () => {
    expect(resolvePortalNodeType(false, 'image')).toBe('image')
  })

  it('returns mapped type for known tag', () => {
    expect(resolvePortalNodeType(false, 'table')).toBe('table')
  })

  it('returns shape for unknown tag', () => {
    expect(resolvePortalNodeType(false, 'unknown')).toBe('shape')
  })
})
