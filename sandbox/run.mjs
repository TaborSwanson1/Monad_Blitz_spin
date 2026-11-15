#!/usr/bin/env node
// Runs SANDBOX.md and writes the results back into it.   npm run sandbox  [-- --rounds 20000]
//
//   1. Parity: frontend math vs the backend toolkit (backend/sdk/seedlib.mjs,
//      which backend/test/SeedVectors.t.sol pins to the Solidity contracts).
//   2. Frontend games: every choice of every game in frontend/src/lib/, played
//      with the UI's own resolveBet, compared with the odds the UI claims.
//   3. Experiments: every ```js experiment block in SANDBOX.md, with results
//      written right under it.
//
// For charts and interactive work, use mechanics.ipynb instead. Same engine.

import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { load, frontendGames, parity, runExperiment } from './lib/engine.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const DOC = join(HERE, 'SANDBOX.md')
const i = process.argv.indexOf('--rounds')
const ROUNDS = (i > 0 && Number(process.argv[i + 1])) || 10_000

const pct = (x) => `${(x * 100).toFixed(1)}%`
const x2 = (x) => `${x.toFixed(2)}x`
const ret = (s) => `${s.mean.toFixed(3)} ± ${s.ci95.toFixed(3)}`
const check = (s) => (s.status === null ? '–' : s.status === 'ok' ? '✓' : `⚠ ${s.status} than ${s.target}`)

function parityLines(checks) {
  return [
    `${checks[0].rounds} seeds each. The backend side is \`backend/sdk/seedlib.mjs\`, which \`backend/test/SeedVectors.t.sol\` pins to the Solidity contracts, so a match here means the UI agrees with the chain.`,
    '',
    '| Check | Result |',
    '|---|---|',
    ...checks.map((c) => `| ${c.name} | ${c.bad ? `✗ ${c.bad} mismatches, first: ${c.first}` : '✓ match'} |`),
    '',
    'Beauty Contest bot guesses are sim-only and have no backend copy, so they are not checked here.',
    '',
  ]
}

function frontendLines(files, games) {
  const out = [
    `Pulled from \`frontend/src/lib/\`: ${files.map((f) => `\`${f}\``).join(', ')}. Each choice is played on the same seeds with \`resolveBet\`, the function the UI uses.`,
    '',
    '"Return" is chips back per chip staked, with a 95% interval. Every house game must return 0.98 (a 2% edge).',
    '',
  ]
  for (const g of games) {
    out.push(`### ${g.id}. ${g.name}${g.simOnly ? ' (sim mode only)' : ' (on the contract)'}`, '')
    if (g.kind === 'beauty') {
      const best = g.rows.reduce((a, b) => (b.mean > a.mean ? b : a))
      out.push(
        `Against the sim-mode bots (${g.bots[0]}–${g.bots[1]} per round), ${g.rounds.toLocaleString()} rounds per guess. ` +
          'Not a house game: the pot is split between players, so the return depends on how you play against them. ' +
          'A return above 1.00 means a fixed strategy beats the bots.',
        '',
        '| Your guess | Win rate (incl. ties) | Return per entry | Note |',
        '|---|---|---|---|',
        ...g.rows.map((r) => `| ${r.label} | ${pct(r.paidRate)} | ${ret(r)} | ${r.beatsBots ? '⚠ beats the bots' : ''} |`),
        '',
        `Best fixed guess here: **${best.label}** (return ${best.mean.toFixed(3)}).`,
        '',
      )
      continue
    }
    out.push(
      `${g.rounds.toLocaleString()} rounds per choice.`,
      '',
      '| Choice | Claimed chance | Claimed payout | Simulated win rate | Return | Edge check |',
      '|---|---|---|---|---|---|',
      ...g.rows.map((r) => `| ${r.label} | ${pct(r.claimedChance)} | ${x2(r.claimedPayout)} | ${pct(r.paidRate)} | ${ret(r)} | ${check(r)} |`),
      '',
    )
  }
  return out
}

function experimentLines(r) {
  return [
    `**${r.name}**: ${r.rounds.toLocaleString()} rounds per choice, game ID ${r.gameId}.`,
    '',
    `| Choice | Paid | Profit | Return | Max | Check vs ${r.target ?? '–'} |`,
    '|---|---|---|---|---|---|',
    ...r.rows.map((s) => `| ${s.label} | ${pct(s.paidRate)} | ${pct(s.profitRate)} | ${ret(s)} | ${x2(s.max)} | ${check(s)} |`),
  ]
}

const EXP_BLOCK = /```js experiment\n([\s\S]*?)```\n(?:\n?<!-- result -->[\s\S]*?<!-- \/result -->\n)?/g

function replaceSection(doc, name, lines) {
  const re = new RegExp(`(<!-- generated:${name} -->\\n)[\\s\\S]*?(<!-- /generated:${name} -->)`)
  if (!re.test(doc)) throw new Error(`SANDBOX.md is missing the <!-- generated:${name} --> markers`)
  return doc.replace(re, (_, a, b) => `${a}${lines.join('\n')}\n${b}`)
}

function gitHead() {
  try {
    return execSync('git rev-parse --short HEAD', { cwd: HERE }).toString().trim()
  } catch {
    return 'unknown'
  }
}

async function main() {
  const started = Date.now()
  const ctx = await load()
  let doc = readFileSync(DOC, 'utf8')

  const checks = parity(ctx)
  const failed = checks.filter((c) => c.bad).length
  doc = replaceSection(doc, 'parity', parityLines(checks))
  doc = replaceSection(doc, 'frontend', frontendLines(ctx.fe.files, frontendGames(ctx, { rounds: ROUNDS })))

  let errors = 0
  doc = doc.replace(EXP_BLOCK, (_, code) => {
    let lines
    try {
      lines = experimentLines(runExperiment(ctx, code, {}))
    } catch (e) {
      errors++
      lines = [`**Error:** ${String(e.message ?? e).split('\n')[0]}`]
    }
    return '```js experiment\n' + code + '```\n\n<!-- result -->\n' + lines.join('\n') + '\n<!-- /result -->\n'
  })

  doc = replaceSection(doc, 'stamp', [
    `_Last run: ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC, commit \`${gitHead()}\`, ${ROUNDS.toLocaleString()} rounds, in ${((Date.now() - started) / 1000).toFixed(1)} s._`,
  ])
  writeFileSync(DOC, doc)
  console.log(`✓ SANDBOX.md  (parity: ${failed ? `${failed} failing` : 'all match'}, experiment errors: ${errors})`)
  process.exit(failed || errors ? 1 : 0)
}

main().catch((e) => {
  console.error(e.message ?? e)
  process.exit(1)
})
