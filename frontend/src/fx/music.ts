// Background music, one looping track per screen. The files are in public/music
// (royalty-free tracks finkierstead downloaded for the project).
//
// Quiet on purpose, under the effect sounds. Follows the Music switch (fx/prefs.ts).
// Browsers block audio until the first click or key press, so the first track starts then.

import { getFxPrefs } from './prefs'

export type Track = 'thinking-time' | 'racing' | 'space' | 'anthem' | 'irish'

/** Which track plays where. Game ids are from lib/games.ts. */
export function trackFor(view: 'lobby' | 'game' | 'slot', gameId: number): Track {
  if (view === 'slot') return 'irish' // Lucky Leprechaun
  if (view === 'lobby') return 'thinking-time'
  return ({ 0: 'anthem', 2: 'racing', 3: 'space' } as Record<number, Track>)[gameId] ?? 'thinking-time'
}

const VOLUME = 0.3
let audio: HTMLAudioElement | null = null
let current: Track | null = null
let wanted: Track | null = null

function sync() {
  if (typeof Audio === 'undefined') return
  const on = getFxPrefs().music && wanted
  if (!on) {
    audio?.pause()
    return
  }
  if (!audio) {
    audio = new Audio()
    audio.loop = true
    audio.volume = VOLUME
  }
  if (current !== wanted) {
    current = wanted
    audio.src = `${import.meta.env.BASE_URL}music/${wanted}.mp3`
  }
  // Rejected until the player has clicked or pressed a key; retried from unlockMusic().
  audio.play().catch(() => {})
}

export function setTrack(t: Track | null) {
  wanted = t
  sync()
}

/** Call on the first click or key press, and whenever the Music switch changes. */
export const unlockMusic = sync

/** For checks and debugging: the track loaded now, and whether it is actually playing. */
export const nowPlaying = () => ({ track: current, playing: !!audio && !audio.paused })
