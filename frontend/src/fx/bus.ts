// One-way signal from the app to the particle overlay: "throw confetti from here".

export type Palette = 'americana' | 'vegas'

export interface BurstEvent {
  palette: Palette
  /** Screen point the particles launch from. Defaults to the middle of the screen. */
  x?: number
  y?: number
  /** 0 to 1. More particles for more. */
  power?: number
}

const listeners = new Set<(e: BurstEvent) => void>()

export const onBurst = (f: (e: BurstEvent) => void) => {
  listeners.add(f)
  return () => {
    listeners.delete(f)
  }
}

export const burst = (e: BurstEvent) => listeners.forEach((f) => f(e))

export const PALETTES: Record<Palette, string[]> = {
  americana: ['#e0162b', '#ffffff', '#2f6bff', '#ffffff', '#e0162b', '#0f3fd6'],
  vegas: ['#ff2d87', '#19e3ff', '#ffd23f', '#9b6bff', '#3dff8f', '#ff7a1a'],
}
