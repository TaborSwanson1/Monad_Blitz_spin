// Beauty Contest. PROPOSED, sim mode only. See frontend/GAMES.md (Beauty Contest).
//
// Everyone pays the same entry and picks a whole number from 0 to 100.
// Target = 2/3 of the average guess. Closest guess wins the pot minus a 2% fee.
// Ties split it. The target can't go above 66.67, so guesses above 67 never win.
//
// In sim mode the other players are bots. Their guesses come from the round seed,
// which only exists after betting locks, so nobody can see them early. On-chain,
// real players would commit a hash of (guess, salt), then reveal after commits close.

import { encodeAbiParameters, keccak256, type Hex } from 'viem'

/** 10 CHIP (18 decimals). Same for every player, so the pot is fair. */
export const BEAUTY_ENTRY = 10n * 10n ** 18n
export const BEAUTY_FEE_BPS = 200
export const BEAUTY_MIN_BOTS = 4
export const BEAUTY_MAX_BOTS = 9

function draw(seed: Hex, i: number): bigint {
  return BigInt(keccak256(encodeAbiParameters([{ type: 'bytes32' }, { type: 'uint256' }], [seed, BigInt(i)])))
}
const unit = (seed: Hex, i: number) => Number(draw(seed, i) % 1_000_000n) / 1_000_000

/**
 * Bot guesses, a mix of the reasoning levels seen in lab experiments:
 * 20% guess at random, 35% think one step (around 33), 30% two steps
 * (around 22), 15% three or more steps (around 8, some at 0).
 */
export function botGuesses(gameSeed: Hex): number[] {
  const n = BEAUTY_MIN_BOTS + Number(draw(gameSeed, 0) % BigInt(BEAUTY_MAX_BOTS - BEAUTY_MIN_BOTS + 1))
  const out: number[] = []
  for (let b = 0; b < n; b++) {
    const k = 1 + b * 4
    const kind = unit(gameSeed, k)
    // Average of three uniforms: a rough bell from -0.5 to 0.5.
    const bell = (unit(gameSeed, k + 1) + unit(gameSeed, k + 2) + unit(gameSeed, k + 3)) / 3 - 0.5
    let g: number
    if (kind < 0.2) g = unit(gameSeed, k + 1) * 100
    else if (kind < 0.55) g = 33 + bell * 24
    else if (kind < 0.85) g = 22 + bell * 18
    else g = 8 + bell * 20
    out.push(Math.min(100, Math.max(0, Math.round(g))))
  }
  return out
}

export interface BeautyResult {
  /** Index 0 is you. The rest are bots. */
  guesses: number[]
  average: number
  target: number
  /** Indexes into guesses. */
  winners: number[]
  youWon: boolean
}

export function resolveBeauty(gameSeed: Hex, yourGuess: number): BeautyResult {
  const guesses = [yourGuess, ...botGuesses(gameSeed)]
  const n = guesses.length
  const sum = guesses.reduce((s, g) => s + g, 0)
  // Distance to 2/3 of the average, scaled by 3n so it stays an exact integer:
  // |g - 2*sum/(3n)| * 3n = |3n*g - 2*sum|. No rounding decides a winner.
  const dist = guesses.map((g) => Math.abs(3 * n * g - 2 * sum))
  const best = Math.min(...dist)
  const winners = dist.flatMap((d, i) => (d === best ? [i] : []))
  return { guesses, average: sum / n, target: (2 * sum) / (3 * n), winners, youWon: winners.includes(0) }
}

/** Pot = entry x players. Winners split it after the fee, rounded down. */
export function beautyPayout(entry: bigint, r: BeautyResult): bigint {
  if (!r.youWon) return 0n
  const pot = entry * BigInt(r.guesses.length)
  return (pot * BigInt(10_000 - BEAUTY_FEE_BPS)) / 10_000n / BigInt(r.winners.length)
}
