// Short synthesized sounds for the slot (Web Audio). No audio files.
// The audio context starts on the first spin click, which browsers require.
// Owner: Zander.

const KEY = 'block-casino.slot.sound'

let ctx: AudioContext | null = null
let muted = readMuted()

function readMuted(): boolean {
  try {
    return localStorage.getItem(KEY) === 'off'
  } catch {
    return false
  }
}

export const isMuted = () => muted

export function setMuted(next: boolean) {
  muted = next
  try {
    localStorage.setItem(KEY, next ? 'off' : 'on')
  } catch {
    /* storage blocked: the choice lasts for this visit */
  }
}

function audio(): AudioContext | null {
  if (muted || typeof window === 'undefined') return null
  try {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    ctx ??= new Ctor()
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

interface ToneOpts {
  type?: OscillatorType
  gain?: number
  /** Glide to this frequency by the end. */
  to?: number
}

/** One note: `freq` Hz, starting `at` seconds from now, lasting `dur` seconds. */
function tone(freq: number, at: number, dur: number, opts: ToneOpts = {}) {
  const c = audio()
  if (!c) return
  try {
    const t = c.currentTime + at
    const osc = c.createOscillator()
    const amp = c.createGain()
    osc.type = opts.type ?? 'triangle'
    osc.frequency.setValueAtTime(freq, t)
    if (opts.to) osc.frequency.exponentialRampToValueAtTime(opts.to, t + dur)
    amp.gain.setValueAtTime(0.0001, t)
    amp.gain.exponentialRampToValueAtTime(opts.gain ?? 0.1, t + 0.012)
    amp.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    osc.connect(amp)
    amp.connect(c.destination)
    osc.start(t)
    osc.stop(t + dur + 0.03)
  } catch {
    /* sound is optional */
  }
}

// C major, C5 upward
const SCALE = [523.25, 659.25, 783.99, 1046.5, 1318.51, 1567.98, 2093]

export const sound = {
  /** Call from a click handler so the browser lets audio start. */
  unlock() {
    audio()
  },
  spin() {
    tone(220, 0, 0.14, { to: 440, gain: 0.05, type: 'sine' })
  },
  /** A reel stopping. */
  stop() {
    tone(150, 0, 0.08, { to: 70, gain: 0.14 })
  },
  /** Coin clinks. */
  coins(count: number) {
    for (let i = 0; i < Math.min(count, 10); i++) {
      const f = 1700 + Math.random() * 500
      tone(f, i * 0.065, 0.12, { type: 'sine', gain: 0.045 })
      tone(f * 1.5, i * 0.065, 0.08, { type: 'sine', gain: 0.025 })
    }
  },
  /** A line win. `tier` 0 to 3: more notes for bigger wins. */
  win(tier: number) {
    SCALE.slice(0, 3 + Math.max(0, Math.min(3, tier))).forEach((f, i) => tone(f, i * 0.085, 0.22, { gain: 0.1 }))
  },
  /** Big win, mega win and jackpot. */
  fanfare(long: boolean) {
    tone(130.81, 0, long ? 2.2 : 1.2, { type: 'sawtooth', gain: 0.035 })
    const run = long ? [...SCALE, ...SCALE.map((f) => f * 2).slice(0, 3)] : SCALE
    run.forEach((f, i) => tone(f, i * 0.1, 0.34, { gain: 0.11 }))
    ;[523.25, 659.25, 783.99].forEach((f) => tone(f, run.length * 0.1, 0.9, { gain: 0.07 }))
  },
  freeSpins() {
    ;[659.25, 783.99, 987.77, 1318.51].forEach((f, i) => tone(f, i * 0.12, 0.3, { type: 'sine', gain: 0.1 }))
  },
  /** Near-miss demo: rising tension while the last reel holds. */
  hold(ms: number) {
    tone(180, 0, ms / 1000, { to: 720, type: 'sawtooth', gain: 0.03 })
  },
  /** Near-miss demo: the "so close" fall. */
  tease() {
    tone(440, 0, 0.26, { to: 392, gain: 0.08 })
    tone(349.23, 0.24, 0.42, { to: 311.13, gain: 0.08 })
  },
}
