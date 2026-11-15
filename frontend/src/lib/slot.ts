import { encodeAbiParameters, keccak256, toHex, type Hex } from 'viem'

// Slot math (the "Lucky Leprechaun" slot). Same model, weights and draw indices as the "Slot" experiment in
// sandbox/SANDBOX.md, where the exact return (0.97993) is derived and simulated.
// `draw` equals backend/sdk/seedlib.mjs, so a contract version can replay a spin from its seed.
// Sim-only demo for now: the seed comes from the browser (crypto.getRandomValues), like
// other sim results. Owner: Zander.

export const SYM = { blank: 0, clover: 1, horseshoe: 2, pot: 3, hat: 4, wild: 5, rainbow: 6, coin: 7 } as const
// Theme: Lucky Leprechaun. The ids (and so every payout) are unchanged from the first version of
// the slot: 1 clover pays like the old cherry, 2 horseshoe like the bell, 3 pot of gold like the
// bar, 4 hat like the seven, 5 leprechaun is the wild, 6 rainbow is the jackpot, 7 coin is the scatter.
export const SYMBOL_NAMES = ['Blank', 'Clover', 'Horseshoe', 'Pot of gold', 'Hat', 'Leprechaun', 'Rainbow', 'Gold coin']

export const WEIGHTS = [10, 38, 16, 11, 7, 10, 3, 5] // per reel, out of 100
export const PAY = [0, 2, 8, 12, 30] // three of a kind; wild stands in for clover, horseshoe, pot of gold, hat
export const WILD_PAY = 50
export const JACKPOT = 1000 // three rainbows, flat
export const FREE_SPINS = 8
export const FREE_MULT = 2
export const MAX_LINES = 8
export const SCATTERS = 3
/** Exact long-run return per chip, from sandbox/SANDBOX.md. */
export const EXACT_RTP = 0.97993

/**
 * Buy feature: pay BUY_PRICE_X times the bet to start with a free-spins trigger, which is a spin
 * drawn from exactly the seeds that trigger it (see `randomTriggerSeed`). Expected payout of such a
 * spin is BUY_EXPECTED_X times the bet (exact, from `sandbox/slot-exact.mjs`: 0.1754x from the
 * opening line plus 8 x 1.70094x from the free spins). So the purchase returns
 * BUY_EXPECTED_X / BUY_PRICE_X = 98.45%, a 1.55% house edge, and the price is whole chips at every stake.
 */
export const BUY_PRICE_X = 14
export const BUY_EXPECTED_X = 13.782941553070454
export const BUY_RTP = BUY_EXPECTED_X / BUY_PRICE_X

const WEIGHT_TOTAL = BigInt(WEIGHTS.reduce((a, b) => a + b, 0))

/** uint256(keccak256(abi.encode(seed, index))), as SeedLib.draw. */
export const draw = (seed: Hex, index: number) =>
  BigInt(keccak256(encodeAbiParameters([{ type: 'bytes32' }, { type: 'uint256' }], [seed, BigInt(index)])))

/** The symbol at draw index i, as SeedLib.weighted(seed, i, WEIGHTS). */
export function symbolAt(seed: Hex, i: number): number {
  let r = Number(draw(seed, i) % WEIGHT_TOTAL)
  for (let k = 0; k < WEIGHTS.length; k++) {
    if (r < WEIGHTS[k]) return k
    r -= WEIGHTS[k]
  }
  return 0
}

export interface Line {
  symbols: number[]
  /** Base pay of the combination (before the cascade multiplier); 0 = no win. */
  base: number
  /** Multiplier applied (cascade step × free-spin multiplier). The jackpot ignores it. */
  mult: number
  /** What this line paid, in multiples of the stake. */
  pay: number
  jackpot: boolean
}

export interface Spin {
  /** Draw index this spin starts at. */
  start: number
  /** Every line shown, in order: wins, then the losing line it stops on (unless it hit MAX_LINES). */
  lines: Line[]
  /** Top row after each line: the symbols that fall in next. lines[k] pairs with above[k]. */
  above: number[][]
  /** Bottom row, fixed for the spin. */
  below: number[]
  pay: number
  jackpot: boolean
}

export interface SlotResult {
  seed: Hex
  base: Spin
  /** Gold coins (scatters) on the opening 3×3 grid (top, line, bottom rows). */
  stars: number
  free: Spin[]
  /** Total paid, in multiples of the stake. */
  total: number
  jackpot: boolean
}

export function lineWin(l: number[]): { base: number; jackpot: boolean } | null {
  if (l.every((s) => s === SYM.rainbow)) return { base: JACKPOT, jackpot: true }
  if (l.every((s) => s === SYM.wild)) return { base: WILD_PAY, jackpot: false }
  let best = 0
  for (let x = 1; x <= 4; x++) if (l.every((s) => s === x || s === SYM.wild)) best = Math.max(best, PAY[x])
  return best ? { base: best, jackpot: false } : null
}

const row = (seed: Hex, start: number) => [0, 1, 2].map((r) => symbolAt(seed, start + r))

function spin(seed: Hex, start: number, mult: number, belowStart: number): Spin {
  const lines: Line[] = []
  const above: number[][] = []
  let pay = 0
  let jackpot = false
  for (let k = 0; k < MAX_LINES; k++) {
    const symbols = row(seed, start + 3 * k)
    above.push(row(seed, start + 3 * (k + 1)))
    const w = lineWin(symbols)
    if (!w) {
      lines.push({ symbols, base: 0, mult: 0, pay: 0, jackpot: false })
      break
    }
    const m = mult * (k + 1)
    const p = w.jackpot ? w.base : w.base * m
    lines.push({ symbols, base: w.base, mult: w.jackpot ? 1 : m, pay: p, jackpot: w.jackpot })
    pay += p
    jackpot ||= w.jackpot
  }
  return { start, lines, above, below: row(seed, belowStart), pay, jackpot }
}

/** Resolves a whole spin from its seed: cascades, the free-spin trigger and every free spin. */
export function resolveSlot(seed: Hex): SlotResult {
  const base = spin(seed, 0, 1, 900)
  const grid = [base.above[0], base.lines[0].symbols, base.below]
  const stars = grid.flat().filter((s) => s === SYM.coin).length
  const free: Spin[] = []
  if (stars >= SCATTERS) {
    for (let s = 0; s < FREE_SPINS; s++) free.push(spin(seed, 1000 + 100 * s, FREE_MULT, 1900 + 100 * s))
  }
  const total = base.pay + free.reduce((a, f) => a + f.pay, 0)
  return { seed, base, stars, free, total, jackpot: base.jackpot || free.some((f) => f.jackpot) }
}

export function randomSeed(): Hex {
  const b = new Uint8Array(32)
  crypto.getRandomValues(b)
  return toHex(b)
}

/** Gold coins (scatters) on the opening 3x3 grid, from the draws alone (cheaper than resolving the whole spin). */
export const openingStars = (seed: Hex) =>
  [0, 1, 2, 3, 4, 5, 900, 901, 902].filter((i) => symbolAt(seed, i) === SYM.coin).length

/**
 * A random seed from among the seeds that trigger free spins, for the buy feature. It draws
 * seeds until one has 3 or more coins on the opening grid, so the bought spin is a uniform
 * pick from the triggering spins and BUY_EXPECTED_X is its exact expected payout.
 * About 120 tries on average, each 9 hashes.
 */
export function randomTriggerSeed(): Hex {
  for (let i = 0; i < 20_000; i++) {
    const seed = randomSeed()
    if (openingStars(seed) >= SCATTERS) return seed
  }
  throw new Error('no triggering seed found') // 1 in 120 per try: not going to happen
}

/**
 * The "Demo jackpot" button: a hand-built spin that lands three rainbows on the line, to show what
 * a jackpot looks like without waiting about 28,000 spins. It is not drawn from a seed, costs
 * nothing and pays nothing (the screen leaves the balance and the session numbers alone).
 */
export function demoJackpot(): SlotResult {
  const A = SYM.clover, B = SYM.horseshoe, C = SYM.pot
  const line = (symbols: number[], jackpot: boolean): Line => ({ symbols, base: jackpot ? JACKPOT : 0, mult: jackpot ? 1 : 0, pay: jackpot ? JACKPOT : 0, jackpot })
  const top = [A, C, B]
  const bottom = [B, A, C]
  const base: Spin = {
    start: 0,
    lines: [line([SYM.rainbow, SYM.rainbow, SYM.rainbow], true), line([B, SYM.hat, A], false)],
    above: [top, [C, B, SYM.clover]],
    below: bottom,
    pay: JACKPOT,
    jackpot: true,
  }
  return { seed: ('0x' + '00'.repeat(32)) as Hex, base, stars: 0, free: [], total: JACKPOT, jackpot: true }
}

// ------------------------------------------------------------ presentation only

/**
 * Near-miss demo (CLAUDE.md exception for this screen only). Rewrites what the opening
 * grid SHOWS on a spin that paid nothing, never what it paid. Returns null for no tease.
 * The tease rate rises as the demo balance falls below where it started.
 * `rand` is presentation randomness, separate from the spin's seed.
 */
export function nearMissGrid(r: SlotResult, balanceRatio: number, rand: () => number = Math.random): { grid: number[][]; kind: 'jackpot' | 'free' } | null {
  if (r.total > 0 || r.stars >= SCATTERS) return null
  const rate = Math.min(0.75, 0.12 + Math.max(0, 1 - balanceRatio) * 0.7)
  if (rand() >= rate) return null

  const grid = [[...r.base.above[0]], [...r.base.lines[0].symbols], [...r.base.below]]
  const starsShown = () => grid.flat().filter((s) => s === SYM.coin).length

  if (rand() < 0.65) {
    // Two rainbows on the line, the third just above or below it on the last reel.
    const line = grid[1]
    if (line[0] !== SYM.coin && line[1] !== SYM.coin && line[2] !== SYM.rainbow) {
      line[0] = SYM.rainbow
      line[1] = SYM.rainbow
      const off = rand() < 0.5 ? 0 : 2
      if (grid[off][2] !== SYM.coin) {
        grid[off][2] = SYM.rainbow
        if (!lineWin(line)) return { grid, kind: 'jackpot' }
      }
    }
    return null
  }
  // Two gold coins showing: one short of free spins. Never three (that would show a trigger that didn't happen).
  const cells: [number, number][] = []
  for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) if (grid[y][x] !== SYM.coin && !(y === 1)) cells.push([y, x])
  while (starsShown() < 2 && cells.length) {
    const [y, x] = cells.splice(Math.floor(rand() * cells.length), 1)[0]
    grid[y][x] = SYM.coin
  }
  return starsShown() === 2 ? { grid, kind: 'free' } : null
}
