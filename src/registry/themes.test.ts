import { describe, expect, it } from 'vitest'
import {
  DEFAULT_THEME_ID,
  THEME_REGISTRY,
  THEME_ROLES,
  buildThemeCatalogPromptContext,
  getTheme,
} from './themes'

const HEX = /^#[0-9A-Fa-f]{6}$/

// The app's canvas is a fixed dark background, independent of any theme.
const CANVAS_HEX = '#141925'

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    const v = c / 255
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
}

function contrastRatio(hexA: string, hexB: string): number {
  const lA = relativeLuminance(hexToRgb(hexA))
  const lB = relativeLuminance(hexToRgb(hexB))
  const [lighter, darker] = lA > lB ? [lA, lB] : [lB, lA]
  return (lighter + 0.05) / (darker + 0.05)
}

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
      expect(theme.canvasText).toMatch(HEX)
      expect(theme.edge.stroke).toMatch(HEX)
      expect(theme.edge.labelBackground).toMatch(HEX)
      expect(theme.edge.labelText).toMatch(HEX)
      expect(theme.edge.emphasizedStroke).toMatch(HEX)
    }
  })

  it('keeps canvasText readable against the fixed dark canvas', () => {
    // Regression for a real bug: soft-pastel's nodeText (#0F172A, near-black
    // — correct for its own light role fills) was reused for sequence
    // participant names, which draw directly on the canvas with no fill,
    // making them nearly invisible. canvasText exists specifically to be
    // checked against the canvas, not against a theme's own fills.
    for (const theme of Object.values(THEME_REGISTRY)) {
      expect(
        contrastRatio(theme.canvasText, CANVAS_HEX),
        `${theme.id}.canvasText vs canvas`
      ).toBeGreaterThanOrEqual(4.5)
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
