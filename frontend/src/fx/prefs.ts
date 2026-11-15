// Player switches for the loud stuff: motion and sound. Stored in the browser.
//
// Motion off (or the system "reduce motion" setting) gives still versions of every
// effect and stops the animated background. Sound off silences everything.

import { useSyncExternalStore } from 'react'

export interface FxPrefs {
  motion: boolean
  sound: boolean
}

const KEY = 'block-casino.fx'
const listeners = new Set<() => void>()

function load(): FxPrefs {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    return { motion: raw.motion !== false, sound: raw.sound !== false }
  } catch {
    return { motion: true, sound: true }
  }
}

let prefs: FxPrefs = typeof window === 'undefined' ? { motion: true, sound: true } : load()

function apply() {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.motion = prefs.motion ? 'on' : 'off'
}
apply()

export const getFxPrefs = () => prefs

export function setFxPrefs(next: Partial<FxPrefs>) {
  prefs = { ...prefs, ...next }
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs))
  } catch {
    // Private windows can refuse storage. The switch still works for this visit.
  }
  apply()
  listeners.forEach((f) => f())
}

const subscribe = (f: () => void) => {
  listeners.add(f)
  return () => listeners.delete(f)
}

export const useFxPrefs = () => useSyncExternalStore(subscribe, getFxPrefs, getFxPrefs)

const systemReduced = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/** True when effects should be still: the system asks for it, or the player switched motion off. */
export const motionOff = () => systemReduced() || !prefs.motion
