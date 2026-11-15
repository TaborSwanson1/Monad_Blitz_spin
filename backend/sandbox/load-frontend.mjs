// Loads the frontend's game models straight from frontend/src/lib/ (read only).
//
// Those files are TypeScript with extensionless imports, which Node can't run as
// is, so esbuild bundles them into sandbox/.cache/frontend-models.mjs first.
// 'viem' stays external and resolves from backend/node_modules.

import { build } from 'esbuild'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { existsSync } from 'node:fs'

const HERE = dirname(fileURLToPath(import.meta.url))
export const FRONTEND_LIB = join(HERE, '..', '..', 'frontend', 'src', 'lib')

/** Model files the sandbox pulls in. Add new ones here when the frontend adds a game. */
export const MODEL_FILES = ['games.ts', 'outcomes.ts', 'crash.ts', 'beauty.ts']

export async function loadFrontendModels() {
  const files = MODEL_FILES.filter((f) => existsSync(join(FRONTEND_LIB, f)))
  if (!files.includes('games.ts') || !files.includes('outcomes.ts')) {
    throw new Error(`frontend models not found in ${FRONTEND_LIB}. Run git pull?`)
  }
  const outfile = join(HERE, '.cache', 'frontend-models.mjs')
  await build({
    stdin: {
      contents: files.map((f) => `export * from ${JSON.stringify(join(FRONTEND_LIB, f))}`).join('\n'),
      resolveDir: FRONTEND_LIB,
      loader: 'ts',
    },
    bundle: true,
    format: 'esm',
    platform: 'node',
    external: ['viem'],
    outfile,
    logLevel: 'error',
  })
  // Cache-bust so a second load in the same process sees fresh code.
  const mod = await import(`${pathToFileURL(outfile).href}?t=${Date.now()}`)
  return { mod, files }
}
