#!/usr/bin/env node
// Mechanics sandbox.   npm run sandbox  [-- --rounds 20000]
//
// Reads sandbox/SANDBOX.md, runs it, and writes the results back into the same file:
//   1. Frontend games: pulls the live models from frontend/src/lib/ (read only) and
//      simulates every choice. Compares the claimed odds and payout with what happens.
//   2. Parity: the frontend's math vs the backend toolkit (sdk/seedlib.mjs), which
//      test/SeedVectors.t.sol pins to the Solidity contracts.
//   3. Experiments: every ```js experiment block in SANDBOX.md is run, and its
//      results are written right under it. Edit or add blocks, then run again.
//
// Seeds are fixed (keccak256("sandbox-<i>")), so a run is reproducible: the same
// file gives the same numbers. Nothing here touches a chain or the frontend.

import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { keccak256, toHex } from 'viem'
import * as seedlib from '../sdk/seedlib.mjs'
import { loadFrontendModels } from './load-frontend.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const DOC = join(HERE, 'SANDBOX.md')
const HOUSE_RETURN = 0.98 // every house game must return 0.98 per chip (CLAUDE.md, 2% edge)
const ONE = 10n ** 18n

const argRounds = Number(process.argv[process.argv.indexOf('--rounds') + 1]) || 0
const ROUNDS = argRounds || 10_000
const BEAUTY_ROUNDS = Math.min(ROUNDS, 3_000) // bots cost ~40 hashes per round
const PARITY_ROUNDS = 500

const seedCache = []
const roundSeed = (i) => (seedCache[i] ??= keccak256(toHex(`sandbox-${i}`)))

// ------------------------------------------------------------------ stats

/** Summary of per-round payout multipliers (0 = lost the stake, 1.96 = paid 1.96x). */
function summarize(mults) {
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
  return { n, mean, se, paidRate: paid / n, profitRate: profit / n, max }
}

/** ✓ if the simulated return is within noise of 0.98, otherwise a warning. */
function edgeStatus(s, target = HOUSE_RETURN) {
  const tol = 3 * s.se + 0.002
  if (Math.abs(s.mean - target) <= tol) return '✓'
  return `⚠ ${s.mean > target ? 'pays more' : 'pays less'} than ${target}`
}

const pct = (x) => `${(x * 100).toFixed(1)}%`
const x2 = (x) => `${x.toFixed(2)}x`
const ret = (s) => `${s.mean.toFixed(3)} ± ${(1.96 * s.se).toFixed(3)}`

// ------------------------------------------------------------------ 1. frontend games

function frontendGames(fe) {
  const out = []
  out.push(`Pulled from \`frontend/src/lib/\`: ${fe.files.map((f) => `\`${f}\``).join(', ')}. ` +
    `Each choice is played ${ROUNDS.toLocaleString()} times on the same seeds with \`resolveBet\`, the function the UI uses.`)
  out.push('')
  out.push('"Return" is chips back per chip staked, with a 95% interval. Every house game must return 0.98 (a 2% edge).')
  out.push('')
  for (const g of fe.mod.GAMES) {
    const tag = g.simOnly ? ' (sim mode only)' : ' (on the contract)'
    out.push(`### ${g.id}. ${g.name}${tag}`)
    out.push('')
    if (g.kind === 'beauty') {
      out.push(...beautyTable(fe, g))
      continue
    }
    out.push('| Choice | Claimed chance | Claimed payout | Simulated win rate | Return | Edge check |')
    out.push('|---|---|---|---|---|---|')
    for (let c = 0; c < g.outcomes; c++) {
      const mults = []
      for (let i = 0; i < ROUNDS; i++) {
        const r = fe.mod.resolveBet(roundSeed(i), g.id, c, ONE)
        mults.push(Number(r.payout) / 1e18)
      }
      const s = summarize(mults)
      out.push(`| ${g.labels[c]} | ${pct(fe.mod.chanceFor(g, c))} | ${x2(fe.mod.multiplierFor(g, c))} | ${pct(s.paidRate)} | ${ret(s)} | ${edgeStatus(s)} |`)
    }
    out.push('')
  }
  return out
}

function beautyTable(fe, g) {
  const guesses = [0, 5, 10, 15, 18, 22, 27, 33, 50, 67, 100]
  const out = [
    `Against the sim-mode bots (${fe.mod.BEAUTY_MIN_BOTS ?? '?'}–${fe.mod.BEAUTY_MAX_BOTS ?? '?'} per round), ${BEAUTY_ROUNDS.toLocaleString()} rounds per guess. ` +
      'Not a house game: the pot is split between players, so the return depends on how you play against them. ' +
      'A return above 1.00 means a fixed strategy beats the bots.',
    '',
    '| Your guess | Win rate (incl. ties) | Return per entry | Note |',
    '|---|---|---|---|',
  ]
  let best = { guess: -1, mean: -1 }
  for (const guess of guesses) {
    const mults = []
    for (let i = 0; i < BEAUTY_ROUNDS; i++) {
      const entry = fe.mod.BEAUTY_ENTRY ?? ONE
      const r = fe.mod.resolveBet(roundSeed(i), g.id, guess, entry)
      mults.push(Number((r.payout * 10_000n) / entry) / 10_000)
    }
    const s = summarize(mults)
    if (s.mean > best.mean) best = { guess, mean: s.mean }
    out.push(`| ${guess} | ${pct(s.paidRate)} | ${ret(s)} | ${s.mean - 1.96 * s.se > 1 ? '⚠ beats the bots' : ''} |`)
  }
  out.push('')
  out.push(`Best fixed guess here: **${best.guess}** (return ${best.mean.toFixed(3)}).`)
  out.push('')
  return out
}

// ------------------------------------------------------------------ 2. parity

function parity(fe) {
  const { mod } = fe
  const checks = []
  const check = (name, fn) => {
    let bad = 0
    let first = ''
    for (let i = 0; i < PARITY_ROUNDS; i++) {
      const msg = fn(roundSeed(i))
      if (msg) {
        bad++
        first ||= msg
      }
    }
    checks.push({ name, bad, first })
  }

  check('`gameSeed` for every game ID', (rs) => {
    for (const g of mod.GAMES) {
      const a = mod.gameSeed(rs, g.id)
      const b = seedlib.gameSeed(rs, g.id)
      if (a !== b) return `game ${g.id}: frontend ${a} vs backend ${b}`
    }
  })
  for (const g of mod.GAMES.filter((x) => x.kind === 'uniform')) {
    check(`${g.name}: outcome (UniformGame bucket math)`, (rs) => {
      const gs = seedlib.gameSeed(rs, g.id)
      const raw = BigInt(gs) % BigInt(g.range)
      const want = Number(raw / BigInt(g.range / g.outcomes))
      const got = mod.resolveGame(rs, g).outcome
      if (got !== want) return `frontend ${got} vs backend ${want}`
    })
  }
  if (mod.crashPointX100) {
    check('Crash: `crashPointX100` vs `SeedLib.crashX100`', (rs) => {
      const gs = seedlib.gameSeed(rs, mod.CRASH_ID ?? 3)
      const a = BigInt(mod.crashPointX100(gs))
      const b = seedlib.crashX100(gs)
      if (a !== b) return `frontend ${a} vs backend ${b}`
    })
  }
  check('Payouts: `payoutBpsFor` vs `numOutcomes × 9,800` (uniform) and `target × 100` (Crash)', () => {
    for (const g of mod.GAMES) {
      for (let c = 0; c < (g.kind === 'beauty' ? 0 : g.outcomes); c++) {
        const want = g.kind === 'crash' ? mod.CRASH_TARGETS_X100[c] * 100 : g.outcomes * 9_800
        const got = mod.payoutBpsFor(g, c)
        if (got !== want) return `${g.name} choice ${c}: ${got} vs ${want}`
      }
    }
  })

  const out = [
    `${PARITY_ROUNDS} seeds each. The backend side is \`sdk/seedlib.mjs\`, which \`test/SeedVectors.t.sol\` pins to the Solidity contracts, so a match here means the UI agrees with the chain.`,
    '',
    '| Check | Result |',
    '|---|---|',
  ]
  for (const c of checks) out.push(`| ${c.name} | ${c.bad ? `✗ ${c.bad} mismatches, first: ${c.first}` : '✓ match'} |`)
  out.push('')
  out.push('Beauty Contest bot guesses are sim-only and have no backend copy, so they are not checked here.')
  out.push('')
  return { lines: out, failed: checks.filter((c) => c.bad).length }
}

// ------------------------------------------------------------------ 3. experiments

/** The `t` object every experiment gets: the backend toolkit plus a few helpers. */
const toolkit = {
  ...seedlib,
  /** bytes32 sub-seed k of a seed, for functions that take a seed (coin, crashX100). */
  subSeed: (seed, k) => toHex(seedlib.draw(seed, k), { size: 32 }),
  /** Float in [0, 1) with 1e-9 resolution. For quick prototypes only; contracts use integers. */
  unit: (seed, k) => Number(seedlib.uniform(seed, k, 1_000_000_000n)) / 1e9,
}

function runExperiment(code) {
  // The block is an object literal. Experiments are code you wrote, run locally.
  const exp = new Function('t', `"use strict"; return (${code})`)(toolkit)
  const split = typeof exp?.resolve === 'function' && typeof exp?.pays === 'function'
  if (!exp?.name || (!split && typeof exp.play !== 'function')) {
    throw new Error('needs { name, play(seed, choice, t) } or { name, resolve(seed, t), pays(outcome, choice) }')
  }
  const choices = exp.choices ?? ['bet']
  const rounds = exp.rounds ?? ROUNDS
  const target = exp.expectedReturn ?? HOUSE_RETURN
  const gameId = exp.gameId ?? 200
  const lines = [`**${exp.name}**: ${rounds.toLocaleString()} rounds per choice, game ID ${gameId}.`, '']
  lines.push(`| Choice | Paid | Profit | Return | Max | Check vs ${target} |`)
  lines.push('|---|---|---|---|---|---|')
  // Rounds outer, choices inner: `resolve` runs once per round and every choice reuses it.
  const mults = choices.map(() => [])
  for (let i = 0; i < rounds; i++) {
    const seed = seedlib.gameSeed(roundSeed(i), gameId)
    const outcome = split ? exp.resolve(seed, toolkit) : undefined
    for (let c = 0; c < choices.length; c++) {
      const m = Number(split ? exp.pays(outcome, c) : exp.play(seed, c, toolkit))
      if (!Number.isFinite(m) || m < 0) throw new Error(`got ${m} for choice ${c}; return a payout multiplier ≥ 0`)
      mults[c].push(m)
    }
  }
  for (let c = 0; c < choices.length; c++) {
    const s = summarize(mults[c])
    lines.push(`| ${choices[c]} | ${pct(s.paidRate)} | ${pct(s.profitRate)} | ${ret(s)} | ${x2(s.max)} | ${exp.expectedReturn === null ? '–' : edgeStatus(s, target)} |`)
  }
  return lines
}

// ------------------------------------------------------------------ the document

const EXP_BLOCK = /```js experiment\n([\s\S]*?)```\n(?:\n?<!-- result -->[\s\S]*?<!-- \/result -->\n)?/g

function replaceSection(doc, name, lines) {
  const re = new RegExp(`(<!-- generated:${name} -->\\n)[\\s\\S]*?(<!-- /generated:${name} -->)`)
  if (!re.test(doc)) throw new Error(`SANDBOX.md is missing the <!-- generated:${name} --> markers`)
  return doc.replace(re, `$1${lines.join('\n')}\n$2`)
}

async function main() {
  if (!existsSync(DOC)) throw new Error('sandbox/SANDBOX.md not found')
  const started = Date.now()
  const fe = await loadFrontendModels()
  let doc = readFileSync(DOC, 'utf8')

  const p = parity(fe)
  doc = replaceSection(doc, 'parity', p.lines)
  doc = replaceSection(doc, 'frontend', frontendGames(fe))

  let errors = 0
  doc = doc.replace(EXP_BLOCK, (_, code) => {
    let lines
    try {
      lines = runExperiment(code)
    } catch (e) {
      errors++
      lines = [`**Error:** ${String(e.message ?? e).split('\n')[0]}`]
    }
    return '```js experiment\n' + code + '```\n\n<!-- result -->\n' + lines.join('\n') + '\n<!-- /result -->\n'
  })

  const head = git(`rev-parse --short HEAD`)
  doc = replaceSection(doc, 'stamp', [
    `_Last run: ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC, commit \`${head}\`, ${ROUNDS.toLocaleString()} rounds, in ${((Date.now() - started) / 1000).toFixed(1)} s._`,
  ])
  writeFileSync(DOC, doc)
  console.log(`✓ sandbox/SANDBOX.md  (parity: ${p.failed ? `${p.failed} failing` : 'all match'}, experiment errors: ${errors})`)
  process.exit(p.failed || errors ? 1 : 0)
}

function git(args) {
  try {
    return execSync(`git ${args}`, { cwd: HERE }).toString().trim()
  } catch {
    return 'unknown'
  }
}

main().catch((e) => {
  console.error(e.message ?? e)
  process.exit(1)
})
