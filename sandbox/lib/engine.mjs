// The sandbox engine. Plain data in, plain data out. Two front ends use it:
//   run.mjs        renders the results into SANDBOX.md
//   api.mjs        prints them as JSON for the notebook (sandbox.py)
//
// Seeds are fixed (keccak256("sandbox-<i>")), so every run is reproducible.

import { keccak256, toHex } from 'viem'
import { loadFrontendModels, loadSeedlib } from './load.mjs'

export const HOUSE_RETURN = 0.98 // every house game returns 0.98 per chip (CLAUDE.md, 2% edge)
const ONE = 10n ** 18n

const seedCache = []
export const roundSeed = (i) => (seedCache[i] ??= keccak256(toHex(`sandbox-${i}`)))

export async function load() {
  const [fe, seedlib] = await Promise.all([loadFrontendModels(), loadSeedlib()])
  return { fe, seedlib, t: makeToolkit(seedlib) }
}

/** The `t` object every experiment gets: the backend toolkit plus a few helpers. */
function makeToolkit(seedlib) {
  return {
    ...seedlib,
    /** bytes32 sub-seed k of a seed, for functions that take a seed (coin, crashX100). */
    subSeed: (seed, k) => toHex(seedlib.draw(seed, k), { size: 32 }),
    /** Float in [0, 1) with 1e-9 resolution. Prototypes only; contracts use integers. */
    unit: (seed, k) => Number(seedlib.uniform(seed, k, 1_000_000_000n)) / 1e9,
  }
}

// ------------------------------------------------------------------ stats

/** Summary of per-round payout multipliers (0 = lost the stake, 1.96 = paid 1.96x). */
export function summarize(mults, target = HOUSE_RETURN) {
  const n = mults.length
  let sum = 0
  let sq = 0
  let paid = 0
  let profit = 0
  let max = 0
  for (const m of mults) {
    sum += m
    sq += m * m
    if (m > 0) paid++
    if (m > 1) profit++
    if (m > max) max = m
  }
  const mean = sum / n
  const se = Math.sqrt(Math.max(0, sq / n - mean * mean) / n)
  let status = null
  if (target !== null) {
    const ok = Math.abs(mean - target) <= 3 * se + 0.002
    status = ok ? 'ok' : mean > target ? 'pays more' : 'pays less'
  }
  return { n, mean, se, ci95: 1.96 * se, paidRate: paid / n, profitRate: profit / n, max, target, status }
}

// ------------------------------------------------------------------ frontend games

const DEFAULT_GUESSES = [0, 5, 10, 15, 18, 22, 27, 33, 50, 67, 100]

/**
 * Plays every choice of every frontend game with the UI's own resolveBet.
 * Returns one entry per game with a row per choice.
 */
export function frontendGames({ fe }, { rounds = 10_000, beautyRounds = Math.min(rounds, 3_000), guesses = DEFAULT_GUESSES } = {}) {
  const m = fe.mod
  return m.GAMES.map((g) => {
    const base = { id: g.id, name: g.name, kind: g.kind, simOnly: !!g.simOnly }
    if (g.kind === 'beauty') {
      const entry = m.BEAUTY_ENTRY ?? ONE
      const rows = guesses.map((guess) => {
        const mults = []
        for (let i = 0; i < beautyRounds; i++) {
          const r = m.resolveBet(roundSeed(i), g.id, guess, entry)
          mults.push(Number((r.payout * 10_000n) / entry) / 10_000)
        }
        const s = summarize(mults, null)
        return { choice: guess, label: String(guess), ...s, beatsBots: s.mean - s.ci95 > 1 }
      })
      return { ...base, rounds: beautyRounds, bots: [m.BEAUTY_MIN_BOTS, m.BEAUTY_MAX_BOTS], rows }
    }
    const rows = []
    for (let c = 0; c < g.outcomes; c++) {
      const mults = []
      for (let i = 0; i < rounds; i++) {
        mults.push(Number(m.resolveBet(roundSeed(i), g.id, c, ONE).payout) / 1e18)
      }
      rows.push({
        choice: c,
        label: g.labels[c],
        claimedChance: m.chanceFor(g, c),
        claimedPayout: m.multiplierFor(g, c),
        ...summarize(mults),
      })
    }
    return { ...base, rounds, rows }
  })
}

// ------------------------------------------------------------------ parity

/** Frontend math vs the backend toolkit, seed by seed. */
export function parity({ fe, seedlib }, { rounds = 500 } = {}) {
  const m = fe.mod
  const checks = []
  const check = (name, fn) => {
    let bad = 0
    let first = ''
    for (let i = 0; i < rounds; i++) {
      const msg = fn(roundSeed(i))
      if (msg) {
        bad++
        first ||= msg
      }
    }
    checks.push({ name, rounds, bad, first })
  }

  check('gameSeed for every game ID', (rs) => {
    for (const g of m.GAMES) {
      const a = m.gameSeed(rs, g.id)
      const b = seedlib.gameSeed(rs, g.id)
      if (a !== b) return `game ${g.id}: frontend ${a} vs backend ${b}`
    }
  })
  for (const g of m.GAMES.filter((x) => x.kind === 'uniform')) {
    check(`${g.name}: outcome (UniformGame bucket math)`, (rs) => {
      const gs = seedlib.gameSeed(rs, g.id)
      const want = Number((BigInt(gs) % BigInt(g.range)) / BigInt(g.range / g.outcomes))
      const got = m.resolveGame(rs, g).outcome
      if (got !== want) return `frontend ${got} vs backend ${want}`
    })
  }
  if (m.crashPointX100) {
    check('Crash: crashPointX100 vs SeedLib.crashX100', (rs) => {
      const gs = seedlib.gameSeed(rs, m.CRASH_ID ?? 3)
      const a = BigInt(m.crashPointX100(gs))
      const b = seedlib.crashX100(gs)
      if (a !== b) return `frontend ${a} vs backend ${b}`
    })
  }
  check('Payouts: payoutBpsFor vs numOutcomes × 9,800 (uniform) and target × 100 (Crash)', () => {
    for (const g of m.GAMES) {
      for (let c = 0; c < (g.kind === 'beauty' ? 0 : g.outcomes); c++) {
        const want = g.kind === 'crash' ? m.CRASH_TARGETS_X100[c] * 100 : g.outcomes * 9_800
        const got = m.payoutBpsFor(g, c)
        if (got !== want) return `${g.name} choice ${c}: ${got} vs ${want}`
      }
    }
  })
  return checks
}

// ------------------------------------------------------------------ experiments

/** Turns an experiment's source (an object literal) into the object. */
export function compileExperiment(code, t) {
  const exp = new Function('t', `"use strict"; return (${code})`)(t)
  const split = typeof exp?.resolve === 'function' && typeof exp?.pays === 'function'
  if (!exp?.name || (!split && typeof exp.play !== 'function')) {
    throw new Error('needs { name, play(seed, choice, t) } or { name, resolve(seed, t), pays(outcome, choice) }')
  }
  return { exp, split }
}

/**
 * Runs an experiment. With `keep: true`, also returns every round's outcome
 * (from resolve) and every payout multiplier, for plotting.
 */
export function runExperiment({ t, seedlib }, code, { rounds, keep = false } = {}) {
  const { exp, split } = compileExperiment(code, t)
  const choices = exp.choices ?? ['bet']
  const n = rounds ?? exp.rounds ?? 10_000
  const target = exp.expectedReturn === undefined ? HOUSE_RETURN : exp.expectedReturn
  const gameId = exp.gameId ?? 200
  // Rounds outer, choices inner: `resolve` runs once per round and every choice reuses it.
  const mults = choices.map(() => [])
  const outcomes = []
  for (let i = 0; i < n; i++) {
    const seed = seedlib.gameSeed(roundSeed(i), gameId)
    const outcome = split ? exp.resolve(seed, t) : undefined
    if (keep && split) outcomes.push(outcome)
    for (let c = 0; c < choices.length; c++) {
      const m = Number(split ? exp.pays(outcome, c) : exp.play(seed, c, t))
      if (!Number.isFinite(m) || m < 0) throw new Error(`got ${m} for choice ${c}; return a payout multiplier ≥ 0`)
      mults[c].push(m)
    }
  }
  const rows = choices.map((label, c) => ({ choice: c, label, ...summarize(mults[c], target) }))
  const out = { name: exp.name, gameId, rounds: n, target, rows }
  if (keep) {
    out.outcomes = outcomes
    out.mults = mults
  }
  return out
}
