/**
 * Beautify's color source of truth. Instead of asking an LLM to invent raw
 * hex values per request (inconsistent contrast, no guarantee a container's
 * fill differs from its boundary, no way to keep edge labels legible when
 * the palette changes), the model picks a themeId and assigns each node a
 * semantic role — the actual colors always come from here, pre-chosen and
 * checked for contrast once, not re-derived per call.
 */

export const THEME_ROLES = [
  'boundary',
  'client',
  'service',
  'data',
  'messaging',
  'neutral',
] as const

export type ThemeRole = (typeof THEME_ROLES)[number]

export type ThemeColorPair = { fill: string; stroke: string }

export type ThemeSpec = {
  id: string
  label: string
  description: string
  mode: 'dark' | 'light'
  /** Surfaced in the beautify prompt so a free-text request ("soft pastel")
   * can be matched to the closest catalog theme. */
  promptHint: string
  /** Text color used on every role-colored node (boundary included). */
  nodeText: string
  roles: Record<ThemeRole, ThemeColorPair>
  edge: {
    stroke: string
    strokeWidth: number
    labelBackground: string
    labelText: string
    emphasizedStroke: string
    emphasizedStrokeWidth: number
  }
}

export const DEFAULT_THEME_ID = 'professional'

export const THEME_REGISTRY: Record<string, ThemeSpec> = {
  professional: {
    id: 'professional',
    label: 'Professional',
    description: 'Calm slate-navy palette, the default look',
    mode: 'dark',
    promptHint:
      'clean, modern, professional, calm, corporate, default, no specific style requested',
    nodeText: '#F8FAFC',
    roles: {
      boundary: { fill: '#171B26', stroke: '#3D4759' },
      client: { fill: '#1C2336', stroke: '#3D5EA8' },
      service: { fill: '#1C2336', stroke: '#3D5EA8' },
      data: { fill: '#18242F', stroke: '#3D8A7A' },
      messaging: { fill: '#241F30', stroke: '#6B5CA8' },
      neutral: { fill: '#1C2336', stroke: '#3D5EA8' },
    },
    edge: {
      stroke: '#828DA3',
      strokeWidth: 1.5,
      labelBackground: '#1E293B',
      labelText: '#E2E8F0',
      emphasizedStroke: '#5B9BFF',
      emphasizedStrokeWidth: 3,
    },
  },
  'midnight-bold': {
    id: 'midnight-bold',
    label: 'Midnight Bold',
    description: 'Dark background, saturated high-contrast accents',
    mode: 'dark',
    promptHint: 'dark, bold, saturated, high contrast, vivid, striking',
    nodeText: '#F8FAFC',
    roles: {
      boundary: { fill: '#12151F', stroke: '#3D4759' },
      client: { fill: '#1C2336', stroke: '#5B9BFF' },
      service: { fill: '#1C2336', stroke: '#38BDF8' },
      data: { fill: '#0F2D3A', stroke: '#2AD4B3' },
      messaging: { fill: '#2A2410', stroke: '#E8B93E' },
      neutral: { fill: '#1C2336', stroke: '#5B9BFF' },
    },
    edge: {
      stroke: '#5B9BFF',
      strokeWidth: 2.5,
      labelBackground: '#1E293B',
      labelText: '#E2E8F0',
      emphasizedStroke: '#5B9BFF',
      emphasizedStrokeWidth: 4,
    },
  },
  'soft-pastel': {
    id: 'soft-pastel',
    label: 'Soft Pastel',
    description: 'Light background, muted pastel roles with dark text',
    mode: 'light',
    promptHint: 'soft, pastel, light, gentle, muted, airy, whimsical',
    nodeText: '#0F172A',
    roles: {
      boundary: { fill: '#F4F6FB', stroke: '#94A3B8' },
      client: { fill: '#BEEAE0', stroke: '#2F7A6B' },
      service: { fill: '#BFDBFE', stroke: '#1D4ED8' },
      data: { fill: '#FBC7A8', stroke: '#B5471E' },
      messaging: { fill: '#FDE68A', stroke: '#92620A' },
      neutral: { fill: '#E2E8F0', stroke: '#475569' },
    },
    edge: {
      stroke: '#64748B',
      strokeWidth: 2,
      labelBackground: '#FFFFFF',
      labelText: '#0F172A',
      emphasizedStroke: '#334155',
      emphasizedStrokeWidth: 3.5,
    },
  },
  monochrome: {
    id: 'monochrome',
    label: 'Monochrome',
    description: 'Grayscale, roles differ by shade rather than hue',
    mode: 'dark',
    promptHint: 'monochrome, grayscale, black and white, minimal, neutral',
    nodeText: '#F3F4F6',
    roles: {
      boundary: { fill: '#17191D', stroke: '#4B5563' },
      client: { fill: '#23262B', stroke: '#9CA3AF' },
      service: { fill: '#1D2024', stroke: '#6B7280' },
      data: { fill: '#26292E', stroke: '#D1D5DB' },
      messaging: { fill: '#202225', stroke: '#4B5563' },
      neutral: { fill: '#1F2226', stroke: '#6B7280' },
    },
    edge: {
      stroke: '#9CA3AF',
      strokeWidth: 2,
      labelBackground: '#111318',
      labelText: '#E5E7EB',
      emphasizedStroke: '#F3F4F6',
      emphasizedStrokeWidth: 3.5,
    },
  },
  'high-contrast': {
    id: 'high-contrast',
    label: 'High Contrast',
    description: 'Maximum-contrast palette for accessibility or emphasis',
    mode: 'dark',
    promptHint:
      'high contrast, accessible, accessibility, maximum contrast, bright neon',
    nodeText: '#000000',
    roles: {
      boundary: { fill: '#000000', stroke: '#FFFFFF' },
      client: { fill: '#FFD400', stroke: '#000000' },
      service: { fill: '#00E5FF', stroke: '#000000' },
      data: { fill: '#00FF85', stroke: '#000000' },
      messaging: { fill: '#FF6EC7', stroke: '#000000' },
      neutral: { fill: '#FFFFFF', stroke: '#000000' },
    },
    edge: {
      stroke: '#FFFFFF',
      strokeWidth: 2.5,
      labelBackground: '#000000',
      labelText: '#FFFFFF',
      emphasizedStroke: '#FFD400',
      emphasizedStrokeWidth: 4.5,
    },
  },
  ocean: {
    id: 'ocean',
    label: 'Ocean',
    description: 'Cool dark blues and teals',
    mode: 'dark',
    promptHint: 'ocean, cool, blue, teal, calm water, deep sea',
    nodeText: '#EAF6FA',
    roles: {
      boundary: { fill: '#0B1F2A', stroke: '#2E5A6E' },
      client: { fill: '#0F2E3D', stroke: '#4FB8D6' },
      service: { fill: '#0F3A3A', stroke: '#35C7B0' },
      data: { fill: '#10293F', stroke: '#3B7DD8' },
      messaging: { fill: '#172B3D', stroke: '#6E93C7' },
      neutral: { fill: '#10222C', stroke: '#4FB8D6' },
    },
    edge: {
      stroke: '#4FB8D6',
      strokeWidth: 2,
      labelBackground: '#0B1F2A',
      labelText: '#DCEEF5',
      emphasizedStroke: '#35C7B0',
      emphasizedStrokeWidth: 3.5,
    },
  },
}

export function getTheme(themeId: string | undefined): ThemeSpec {
  if (themeId && THEME_REGISTRY[themeId]) return THEME_REGISTRY[themeId]
  return THEME_REGISTRY[DEFAULT_THEME_ID]
}

/** Renders the catalog as prompt context so the model can match a free-text
 * style request to the closest theme instead of inventing colors. */
export function buildThemeCatalogPromptContext(): string {
  return Object.values(THEME_REGISTRY)
    .map(
      (t) =>
        `- "${t.id}" (${t.mode}): ${t.description}. Matches requests like: ${t.promptHint}.`
    )
    .join('\n')
}
