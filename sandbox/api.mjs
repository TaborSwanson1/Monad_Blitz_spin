#!/usr/bin/env node
// JSON front end to the engine, for the notebook (sandbox.py calls this).
//
//   node api.mjs parity
//   node api.mjs frontend   [--rounds N] [--beauty-rounds N] [--guesses 0,5,10 | 0-40]
//   node api.mjs experiment [--rounds N] [--keep]      experiment source on stdin
//
// Prints one JSON document on stdout. Big integers come out as numbers when
// they fit exactly, otherwise as decimal strings. Errors go to stderr, exit 1.

import { readFileSync } from 'node:fs'
import { load, frontendGames, parity, runExperiment } from './lib/engine.mjs'

const [cmd, ...rest] = process.argv.slice(2)
const flag = (name) => {
  const i = rest.indexOf(`--${name}`)
  return i < 0 ? undefined : (rest[i + 1] ?? true)
}
const num = (name) => (flag(name) === undefined ? undefined : Number(flag(name)))

function parseGuesses(s) {
  if (!s) return undefined
  const range = s.match(/^(\d+)-(\d+)$/)
  if (range) {
    const [a, b] = [Number(range[1]), Number(range[2])]
    return Array.from({ length: b - a + 1 }, (_, k) => a + k)
  }
  return s.split(',').map(Number)
}

const replacer = (_, v) => (typeof v === 'bigint' ? (v <= BigInt(Number.MAX_SAFE_INTEGER) && v >= -BigInt(Number.MAX_SAFE_INTEGER) ? Number(v) : v.toString()) : v)

async function main() {
  const ctx = await load()
  let out
  if (cmd === 'parity') out = parity(ctx, { rounds: num('rounds') })
  else if (cmd === 'frontend') {
    const opts = { rounds: num('rounds') ?? 10_000, guesses: parseGuesses(flag('guesses')) }
    if (num('beauty-rounds')) opts.beautyRounds = num('beauty-rounds')
    out = { files: ctx.fe.files, games: frontendGames(ctx, opts) }
  } else if (cmd === 'experiment') {
    const code = readFileSync(0, 'utf8')
    out = runExperiment(ctx, code, { rounds: num('rounds'), keep: flag('keep') === true || flag('keep') === 'true' })
  } else {
    throw new Error(`unknown command "${cmd}". Use parity, frontend or experiment.`)
  }
  process.stdout.write(JSON.stringify(out, replacer))
}

main().catch((e) => {
  process.stderr.write(String(e.message ?? e) + '\n')
  process.exit(1)
})
