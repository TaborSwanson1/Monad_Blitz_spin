#!/usr/bin/env node
// Drift check: does the frontend still match the backend?   npm run check-seam
//
// READS (never edits) the frontend's hand-written contract calls and game list,
// and compares them with the compiled contracts and the latest deployment:
//   frontend/src/client/abi.ts   every 'function …' line must exist with the same inputs and outputs
//   frontend/src/lib/games.ts    game IDs, names and outcome counts must match the deployed games
// Exits 1 on drift, so it can gate a commit or CI.
// Covers INTEGRATION.md sync items 1 (ABIs) and 2 (game order). Item 3 (outcome
// math) is covered by test/SeedLib.t.sol::test_GameSeedMatchesFrontendLayout.

import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadAbis } from './export.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const FRONTEND = join(ROOT, '..', 'frontend', 'src')

// frontend abi.ts export name -> backend artifact
const MAP = { casinoAbi: 'blockCasinoAbi', chipAbi: 'chipTokenAbi', randomnessAbi: 'randomnessSourceAbi' }

const sig = (params = []) => params.map((p) => (p.type === 'tuple' ? `(${sig(p.components)})` : p.type)).join(',')
const typesOf = (list) =>
  list
    .split(',')
    .map((s) => s.trim().split(/\s+/)[0])
    .filter(Boolean)
    .join(',')

function parseFrontendAbi(src) {
  const out = {}
  const block = /export const (\w+)\s*=\s*parseAbi\(\[([\s\S]*?)\]\)/g
  for (const [, name, body] of src.matchAll(block)) {
    out[name] = [...body.matchAll(/'function ([^']+)'/g)].map(([, line]) => {
      const m = line.match(/^(\w+)\(([^)]*)\)(?:.*?returns \((.*)\))?/)
      return { text: line, name: m[1], inputs: typesOf(m[2]), outputs: m[3] ? typesOf(m[3]) : '' }
    })
  }
  return out
}

let problems = 0
const bad = (msg) => {
  problems++
  console.log(`  ✗ ${msg}`)
}

// --- 1. ABIs
const abiFile = join(FRONTEND, 'client', 'abi.ts')
if (!existsSync(abiFile)) {
  console.log('frontend/src/client/abi.ts not found. Nothing to check.')
  process.exit(0)
}
const abis = loadAbis()
const frontend = parseFrontendAbi(readFileSync(abiFile, 'utf8'))
console.log('ABI calls in frontend/src/client/abi.ts:')
for (const [feName, calls] of Object.entries(frontend)) {
  const be = abis[MAP[feName]]
  if (!be) {
    bad(`${feName}: no matching backend contract (update MAP in check-seam.mjs)`)
    continue
  }
  for (const c of calls) {
    const fns = be.filter((x) => x.type === 'function' && x.name === c.name)
    if (fns.length === 0) {
      bad(`${feName}.${c.name}: does not exist in the backend anymore`)
      continue
    }
    const hit = fns.find((f) => sig(f.inputs) === c.inputs)
    if (!hit) {
      bad(`${feName}.${c.name}(${c.inputs}): backend now takes (${fns.map((f) => sig(f.inputs)).join(' | ')})`)
    } else if (c.outputs && sig(hit.outputs) !== c.outputs) {
      bad(`${feName}.${c.name}: returns (${c.outputs}) in frontend, (${sig(hit.outputs)}) in backend`)
    } else {
      console.log(`  ✓ ${feName}.${c.name}(${c.inputs})`)
    }
  }
}

// --- 2. Game list vs the latest deployment
const gamesFile = join(FRONTEND, 'lib', 'games.ts')
const exportsDir = join(ROOT, 'exports')
const deployments = existsSync(exportsDir)
  ? readdirSync(exportsDir)
      .map((d) => join(exportsDir, d, 'deployment.json'))
      .filter(existsSync)
  : []
if (existsSync(gamesFile) && deployments.length) {
  const src = readFileSync(gamesFile, 'utf8')
  const feGames = [...src.matchAll(/game\((\d+),\s*'([^']+)',\s*'[^']*',\s*(\d+),\s*\[([^\]]*)\]/g)].map(([, id, name, range, labels]) => ({
    id: Number(id),
    name,
    range: Number(range),
    numOutcomes: labels.split(',').filter((s) => s.trim()).length,
  }))
  for (const file of deployments) {
    const dep = JSON.parse(readFileSync(file, 'utf8'))
    console.log(`Games in frontend/src/lib/games.ts vs ${dep.network} deployment:`)
    for (const g of dep.games) {
      const fe = feGames.find((x) => x.id === g.id)
      if (!fe) bad(`game ${g.id} "${g.name}" is deployed but missing in games.ts`)
      else if (fe.name !== g.name || fe.numOutcomes !== g.numOutcomes || (g.range !== null && fe.range !== g.range))
        bad(`game ${g.id}: games.ts has "${fe.name}" (${fe.numOutcomes} outcomes, range ${fe.range}), deployed is "${g.name}" (${g.numOutcomes}, range ${g.range})`)
      else console.log(`  ✓ ${g.id} ${g.name}`)
    }
    for (const fe of feGames) if (!dep.games.some((g) => g.id === fe.id)) bad(`games.ts has game ${fe.id} "${fe.name}" but it isn't deployed`)
  }
}

console.log(problems ? `\n${problems} mismatch(es). Fix the backend, or tell the frontend owners in docs/TEAM_CONTEXT.md.` : '\nSeam OK.')
process.exit(problems ? 1 : 0)
