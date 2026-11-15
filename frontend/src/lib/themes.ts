// Customizable themes: a base palette, an accent color, a win effect and a loss effect.
// Presets fill all four at once. Settings are remembered per browser.
//
// Rule from CLAUDE.md: effects follow the REAL net result for the round. A win effect
// only plays when the round is net positive, a loss effect only when it's net negative.
// Both scale with the size of the result, both can be turned off, and both are
// skipped for reduced motion.

import { useCallback, useEffect, useState } from 'react'

export type Base = 'calm' | 'midnight' | 'monad'
export type WinEffect = 'off' | 'sparks' | 'monad-tokens'
export type LossEffect = 'off' | 'burning-wallet'

export interface ThemeSettings {
  base: Base
  /** Hex color, or null to use the base palette's own accent. */
  accent: string | null
  win: WinEffect
  loss: LossEffect
}

export interface Option<T> {
  id: T
  name: string
  describe: string
}

export const BASES: Option<Base>[] = [
  { id: 'calm', name: 'Calm', describe: 'Neutral grays' },
  { id: 'midnight', name: 'Midnight', describe: 'Blue-gray dashboard' },
  { id: 'monad', name: 'Monad', describe: 'Deep purple' },
]

export const ACCENTS: { id: string; name: string }[] = [
  { id: '#1f8fff', name: 'Blue' },
  { id: '#836ef9', name: 'Purple' },
  { id: '#14b8a6', name: 'Teal' },
  { id: '#f5a524', name: 'Amber' },
  { id: '#ec4899', name: 'Pink' },
]

export const WIN_EFFECTS: Option<WinEffect>[] = [
  { id: 'sparks', name: 'Sparks', describe: 'A short burst of sparks' },
  { id: 'monad-tokens', name: 'Monad tokens', describe: 'Purple tokens rain down' },
  { id: 'off', name: 'Off', describe: 'Just the result' },
]

export const LOSS_EFFECTS: Option<LossEffect>[] = [
  { id: 'off', name: 'Off', describe: 'Just the result' },
  { id: 'burning-wallet', name: 'Burning wallet', describe: 'Your sim wallet catches fire' },
]

export interface Preset {
  id: string
  name: string
  describe: string
  settings: ThemeSettings
}

export const PRESETS: Preset[] = [
  {
    id: 'calm',
    name: 'Calm',
    describe: 'Neutral grays. Small sparks on a net win.',
    settings: { base: 'calm', accent: null, win: 'sparks', loss: 'off' },
  },
  {
    id: 'midnight',
    name: 'Midnight',
    describe: 'Blue-gray dashboard. Sparks on a win, nothing on a loss.',
    settings: { base: 'midnight', accent: null, win: 'sparks', loss: 'off' },
  },
  {
    id: 'monad',
    name: 'Monad',
    describe: 'Purple. Monad tokens rain on a net win, your wallet burns on a net loss.',
    settings: { base: 'monad', accent: null, win: 'monad-tokens', loss: 'burning-wallet' },
  },
]

const DEFAULT = PRESETS[0].settings
const KEY = 'block-casino-theme-v2'

const same = (a: ThemeSettings, b: ThemeSettings) =>
  a.base === b.base && a.accent === b.accent && a.win === b.win && a.loss === b.loss

/** The preset these settings match exactly, or null if they've been customized. */
export const presetOf = (s: ThemeSettings) => PRESETS.find((p) => same(p.settings, s)) ?? null

function readSaved(): ThemeSettings {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    if (!raw) return DEFAULT
    const s: ThemeSettings = {
      base: BASES.some((b) => b.id === raw.base) ? raw.base : DEFAULT.base,
      accent: typeof raw.accent === 'string' && /^#[0-9a-f]{6}$/i.test(raw.accent) ? raw.accent : null,
      win: WIN_EFFECTS.some((w) => w.id === raw.win) ? raw.win : DEFAULT.win,
      loss: LOSS_EFFECTS.some((l) => l.id === raw.loss) ? raw.loss : DEFAULT.loss,
    }
    return s
  } catch {
    return DEFAULT
  }
}

function hexToRgb(hex: string) {
  const n = parseInt(hex.slice(1), 16)
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`
}

/** Current theme settings, applied to <html> and remembered per browser. */
export function useTheme() {
  const [settings, setSettings] = useState(readSaved)

  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = settings.base
    if (settings.accent) {
      root.style.setProperty('--primary', settings.accent)
      root.style.setProperty('--primary-soft', `rgb(${hexToRgb(settings.accent)} / 0.15)`)
    } else {
      root.style.removeProperty('--primary')
      root.style.removeProperty('--primary-soft')
    }
    try {
      localStorage.setItem(KEY, JSON.stringify(settings))
    } catch {
      // Private mode or blocked storage: the theme still applies for this visit.
    }
  }, [settings])

  const update = useCallback((patch: Partial<ThemeSettings>) => setSettings((s) => ({ ...s, ...patch })), [])
  const applyPreset = useCallback((id: string) => {
    const p = PRESETS.find((x) => x.id === id)
    if (p) setSettings(p.settings)
  }, [])

  return { settings, update, applyPreset }
}

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
