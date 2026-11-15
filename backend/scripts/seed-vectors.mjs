#!/usr/bin/env node
// Writes test/vectors/seed.json from sdk/seedlib.mjs.   npm run vectors
//
// test/SeedVectors.t.sol reads the file and checks that contracts/lib/SeedLib.sol
// gives the same answer for every entry. So the vectors pin both copies:
// if either one changes its math, `forge test` fails.

import { writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { keccak256, toHex } from 'viem'
import { gameSeed, draw, uniform, chance, weighted, coin, crashX100 } from '../sdk/seedlib.mjs'

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'test', 'vectors', 'seed.json')
const N = 32
// Fixed parameters, mirrored in test/SeedVectors.t.sol.
const GAME_ID = 3
const INDEX = 7
const UNIFORM_N = 100
const CHANCE_BPS = 2_500
const WEIGHTS = [1, 2, 3, 4]

// Edge seeds first (zero, max, crash boundaries), then pseudo-random ones.
const TWO_52 = 2n ** 52n
const edge = [0n, 2n ** 256n - 1n, TWO_52 - 1n, TWO_52 * 50n / 49n].map((n) => toHex(n % 2n ** 256n, { size: 32 }))
const roundSeeds = [...edge, ...Array.from({ length: N - edge.length }, (_, i) => keccak256(toHex(`vector-${i}`)))]

const v = { roundSeeds, gameSeeds: [], draws: [], uniforms: [], chances: [], weighted: [], coins: [], crash: [], crashRaw: [] }
for (const rs of roundSeeds) {
  const gs = gameSeed(rs, GAME_ID)
  v.gameSeeds.push(gs)
  v.draws.push(draw(gs, INDEX).toString())
  v.uniforms.push(uniform(gs, INDEX, UNIFORM_N).toString())
  v.chances.push(chance(gs, INDEX, CHANCE_BPS))
  v.weighted.push(weighted(gs, INDEX, WEIGHTS).toString())
  v.coins.push(coin(gs))
  v.crash.push(crashX100(gs).toString())
  v.crashRaw.push(crashX100(rs).toString()) // raw seeds hit the edge cases directly
}

writeFileSync(OUT, JSON.stringify(v, null, 2) + '\n')
console.log(`✓ test/vectors/seed.json (${N} seeds)`)
