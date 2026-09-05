import { describe, expect, it } from 'vitest'
import {
  DEFAULT_THEME_ID,
  THEME_REGISTRY,
  THEME_ROLES,
  buildThemeCatalogPromptContext,
  getTheme,
} from './themes'

const HEX = /^#[0-9A-Fa-f]{6}$/

describe('THEME_REGISTRY', () => {
  it('gives every theme a color for every role, and valid hex everywhere', () => {
    for (const theme of Object.values(THEME_REGISTRY)) {
      for (const role of THEME_ROLES) {
        const pair = theme.roles[role]
        expect(pair, `${theme.id}.roles.${role}`).toBeDefined()
        expect(pair.fill).toMatch(HEX)
        expect(pair.stroke).toMatch(HEX)
      }
      expect(theme.nodeText).toMatch(HEX)
      expect(theme.edge.stroke).toMatch(HEX)
      expect(theme.edge.labelBackground).toMatch(HEX)
      expect(theme.edge.labelText).toMatch(HEX)
      expect(theme.edge.emphasizedStroke).toMatch(HEX)
    }
  })

  it('gives every role a fill that differs from the boundary fill', () => {
    // The bug this registry exists to prevent: a container indistinguishable
    // from the boundary it sits in.
    for (const theme of Object.values(THEME_REGISTRY)) {
      const boundaryFill = theme.roles.boundary.fill
      for (const role of THEME_ROLES) {
        if (role === 'boundary') continue
        expect(
          theme.roles[role].fill,
          `${theme.id}.roles.${role}.fill vs boundary`
        ).not.toBe(boundaryFill)
      }
    }
  })

  it('includes the default theme id', () => {
    expect(THEME_REGISTRY[DEFAULT_THEME_ID]).toBeDefined()
  })
})

describe('getTheme', () => {
  it('returns the requested theme when it exists', () => {
    expect(getTheme('soft-pastel').id).toBe('soft-pastel')
  })

  it('falls back to the default theme for an unknown or missing id', () => {
    expect(getTheme('does-not-exist').id).toBe(DEFAULT_THEME_ID)
    expect(getTheme(undefined).id).toBe(DEFAULT_THEME_ID)
  })
})

describe('buildThemeCatalogPromptContext', () => {
  it('lists every theme id so the model can pick one', () => {
    const context = buildThemeCatalogPromptContext()
    for (const id of Object.keys(THEME_REGISTRY)) {
      expect(context).toContain(id)
    }
  })
})
