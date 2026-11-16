// Every sound is synthesized here with the Web Audio API. No audio files, nothing
// downloaded: the "cha-ching", the rockets, the eagle and the boom are all oscillators
// and filtered noise. The "BIG WIN" call uses the browser's built-in speech voice.
//
// Rule from CLAUDE.md: win sounds only play on a real net win, loss sounds only on a
// real net loss. The callers in RevealOverlay decide that; nothing here plays by itself.

import { getFxPrefs } from './prefs'

let ctx: AudioContext | null = null
let master: GainNode | null = null

function audio(): { ac: AudioContext; out: GainNode } | null {
  if (!getFxPrefs().sound || typeof window === 'undefined') return null
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return null
  if (!ctx) {
    ctx = new AC()
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -14
    comp.ratio.value = 6
    master = ctx.createGain()
    master.gain.value = 0.5
    master.connect(comp).connect(ctx.destination)
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return { ac: ctx, out: master! }
}

/** Browsers only allow sound after a click or key press. Call this from one. */
export function unlockAudio() {
  audio()
}

interface ToneOpts {
  type?: OscillatorType
  gain?: number
  to?: number // glide to this frequency
  attack?: number
  vibrato?: { rate: number; depth: number }
  lowpass?: number
}

function tone(freq: number, at: number, dur: number, o: ToneOpts = {}) {
  const a = audio()
  if (!a) return
  const { ac, out } = a
  const t = ac.currentTime + at
  const osc = ac.createOscillator()
  const g = ac.createGain()
  osc.type = o.type ?? 'sine'
  osc.frequency.setValueAtTime(freq, t)
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + dur)
  if (o.vibrato) {
    const lfo = ac.createOscillator()
    const lg = ac.createGain()
    lfo.frequency.value = o.vibrato.rate
    lg.gain.value = o.vibrato.depth
    lfo.connect(lg).connect(osc.frequency)
    lfo.start(t)
    lfo.stop(t + dur)
  }
  const peak = o.gain ?? 0.2
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(peak, t + (o.attack ?? 0.008))
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  let node: AudioNode = osc
  if (o.lowpass) {
    const f = ac.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.value = o.lowpass
    node = osc.connect(f)
  }
  node.connect(g).connect(out)
  osc.start(t)
  osc.stop(t + dur + 0.02)
}

interface NoiseOpts {
  gain?: number
  type?: BiquadFilterType
  freq?: number
  to?: number
  q?: number
}

function noise(at: number, dur: number, o: NoiseOpts = {}) {
  const a = audio()
  if (!a) return
  const { ac, out } = a
  const t = ac.currentTime + at
  const len = Math.max(1, Math.floor(ac.sampleRate * dur))
  const buf = ac.createBuffer(1, len, ac.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
  const src = ac.createBufferSource()
  src.buffer = buf
  const f = ac.createBiquadFilter()
  f.type = o.type ?? 'lowpass'
  f.frequency.setValueAtTime(o.freq ?? 1200, t)
  if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + dur)
  f.Q.value = o.q ?? 0.8
  const g = ac.createGain()
  g.gain.setValueAtTime(o.gain ?? 0.25, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  src.connect(f).connect(g).connect(out)
  src.start(t)
  src.stop(t + dur + 0.02)
}

/** A struck-metal ring: a few inharmonic partials with a long tail. Coins and bells. */
function bell(freq: number, at: number, dur = 0.9, gain = 0.16) {
  const partials: [number, number][] = [
    [1, 1],
    [2.76, 0.55],
    [5.4, 0.3],
    [8.93, 0.14],
  ]
  for (const [ratio, level] of partials) tone(freq * ratio, at, dur / Math.sqrt(ratio), { gain: gain * level })
}

function say(text: string, pitch = 0.7, rate = 0.8) {
  if (!getFxPrefs().sound || typeof speechSynthesis === 'undefined') return
  try {
    speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.pitch = pitch
    u.rate = rate
    u.volume = 1
    speechSynthesis.speak(u)
  } catch {
    // No speech voice on this device. The fanfare still plays.
  }
}

const NOTE = { G4: 392, C5: 523.25, E5: 659.25, G5: 783.99, C6: 1046.5, E6: 1318.5, G6: 1568, C7: 2093, E7: 2637, G7: 3136 }

/** Brass-style note: two detuned saws through a low-pass. */
function brass(freq: number, at: number, dur: number, gain = 0.13) {
  tone(freq, at, dur, { type: 'sawtooth', gain, lowpass: 2400, attack: 0.03 })
  tone(freq * 1.006, at, dur, { type: 'sawtooth', gain: gain * 0.8, lowpass: 2000, attack: 0.03 })
}

export const sfx = {
  /** Chips hitting the felt. */
  bet() {
    noise(0, 0.05, { type: 'bandpass', freq: 3200, q: 3, gain: 0.3 })
    noise(0.07, 0.05, { type: 'bandpass', freq: 2600, q: 3, gain: 0.26 })
    bell(1760, 0.1, 0.35, 0.07)
  },

  /** Soft click for picking an option. */
  pick() {
    tone(880, 0, 0.07, { type: 'triangle', gain: 0.08, to: 1320 })
  },

  /** Cash register: the drawer "cha", then the bell "ching", then coins. `power` is 0 to 1. */
  chaChing(power = 0.5) {
    noise(0, 0.07, { type: 'bandpass', freq: 2400, q: 2, gain: 0.35 })
    tone(170, 0, 0.06, { type: 'square', gain: 0.12 })
    bell(NOTE.C7, 0.12, 1.1, 0.18)
    bell(NOTE.E7, 0.15, 1.0, 0.13)
    bell(NOTE.G7, 0.18, 0.9, 0.1)
    const coins = Math.round(4 + 14 * power)
    for (let i = 0; i < coins; i++) bell(2600 + Math.random() * 2600, 0.35 + i * 0.07 + Math.random() * 0.04, 0.3, 0.06)
  },

  /** Rising brass fanfare. Our own four-note arpeggio, not a tune from anywhere. */
  fanfare() {
    brass(NOTE.G4, 0, 0.16)
    brass(NOTE.C5, 0.16, 0.16)
    brass(NOTE.E5, 0.32, 0.16)
    brass(NOTE.G5, 0.48, 0.22)
    brass(NOTE.C6, 0.74, 0.9, 0.16)
    brass(NOTE.E6, 0.74, 0.9, 0.09)
    noise(0.74, 0.5, { type: 'highpass', freq: 5000, gain: 0.1 })
  },

  /** The announcer, drawn out. */
  bigWinVoice(words = 'Big win!') {
    say(words, 0.6, 0.62)
  },

  /** Firework: whistle up, then a boom and crackle. */
  rocket(at = 0) {
    tone(520, at, 0.6, { type: 'sine', gain: 0.07, to: 2300, vibrato: { rate: 26, depth: 40 } })
    noise(at + 0.62, 0.55, { freq: 900, to: 140, gain: 0.5 })
    tone(95, at + 0.62, 0.45, { gain: 0.3, to: 38 })
    for (let i = 0; i < 9; i++) noise(at + 0.75 + Math.random() * 0.7, 0.03, { type: 'highpass', freq: 3500, gain: 0.12 })
  },

  /** Raptor screech: a falling, wobbling cry. */
  eagle(at = 0) {
    tone(2700, at, 0.95, { type: 'sawtooth', gain: 0.09, to: 1500, vibrato: { rate: 34, depth: 170 }, lowpass: 5200, attack: 0.04 })
    tone(2760, at + 0.02, 0.9, { type: 'square', gain: 0.03, to: 1540, vibrato: { rate: 34, depth: 170 }, lowpass: 4200, attack: 0.04 })
  },

  /** A pack of stock cars at full throttle for `secs`, rising in pitch toward the line. */
  engines(secs: number) {
    for (const [f, g] of [[82, 0.1], [97, 0.08], [110, 0.07], [123, 0.06]] as const)
      tone(f, 0, secs, { type: 'sawtooth', gain: g, to: f * 1.9, lowpass: 900, attack: 0.25, vibrato: { rate: 31, depth: 9 } })
    noise(0, secs, { type: 'bandpass', freq: 500, to: 1400, q: 0.7, gain: 0.07 })
  },

  /** Small loss: a short falling note. */
  loss() {
    tone(233, 0, 0.32, { type: 'triangle', gain: 0.16, to: 174, lowpass: 1200 })
    tone(196, 0.3, 0.55, { type: 'triangle', gain: 0.16, to: 123, lowpass: 1000 })
  },

  /** Fire catching: a crackling whoosh. */
  fire() {
    noise(0, 1.6, { type: 'bandpass', freq: 700, to: 2200, q: 0.6, gain: 0.2 })
    for (let i = 0; i < 16; i++) noise(0.1 + Math.random() * 1.6, 0.025, { type: 'highpass', freq: 2500, gain: 0.16 })
  },

  /** The big one: crack, sub boom, long rumble. */
  nuke() {
    noise(0.35, 0.12, { type: 'highpass', freq: 1800, gain: 0.5 })
    tone(74, 0.38, 2.6, { gain: 0.6, to: 26 })
    tone(111, 0.38, 1.4, { type: 'triangle', gain: 0.25, to: 40 })
    noise(0.4, 3.2, { freq: 1400, to: 90, gain: 0.55 })
  },
}
