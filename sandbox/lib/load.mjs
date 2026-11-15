// Loads the two things the sandbox simulates, both READ ONLY:
//   frontend/src/lib/*.ts        the UI's game models (Tabor and Lucas)
//   backend/sdk/seedlib.mjs      the backend's seed toolkit, equal to SeedLib.sol
//
// esbuild bundles each into sandbox/.cache/. 'viem' stays external and resolves
// from sandbox/node_modules, so neither frontend/ nor backend/ needs `npm install`.

import { build } from 'esbuild'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { existsSync } from 'node:fs'

const HERE = dirname(fileURLToPath(import.meta.url))
export const ROOT = join(HERE, '..', '..')
export const FRONTEND_LIB = join(ROOT, 'frontend', 'src', 'lib')
export const SEEDLIB = join(ROOT, 'backend', 'sdk', 'seedlib.mjs')
const CACHE = join(HERE, '..', '.cache')

/** Frontend model files the sandbox pulls in. Add new ones when the frontend adds a game. */
export const MODEL_FILES = ['games.ts', 'outcomes.ts', 'crash.ts', 'beauty.ts']

async function bundle(contents, resolveDir, loader, name) {
  const outfile = join(CACHE, name)
  await build({
    stdin: { contents, resolveDir, loader },
    bundle: true,
    format: 'esm',
    platform: 'node',
    external: ['viem'],
    outfile,
    logLevel: 'error',
  })
  // Cache-bust so a second load in the same process sees fresh code.
  return import(`${pathToFileURL(outfile).href}?t=${Date.now()}`)
}

export async function loadFrontendModels() {
  const files = MODEL_FILES.filter((f) => existsSync(join(FRONTEND_LIB, f)))
  if (!files.includes('games.ts') || !files.includes('outcomes.ts')) {
    throw new Error(`frontend models not found in ${FRONTEND_LIB}. Run git pull?`)
  }
  const src = files.map((f) => `export * from ${JSON.stringify(join(FRONTEND_LIB, f))}`).join('\n')
  return { mod: await bundle(src, FRONTEND_LIB, 'ts', 'frontend-models.mjs'), files }
}

export async function loadSeedlib() {
  if (!existsSync(SEEDLIB)) throw new Error(`backend toolkit not found at ${SEEDLIB}. Run git pull?`)
  return bundle(`export * from ${JSON.stringify(SEEDLIB)}`, dirname(SEEDLIB), 'js', 'seedlib.mjs')
}
