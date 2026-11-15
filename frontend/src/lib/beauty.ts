// Beauty Contest. PROPOSED, sim mode only. See frontend/GAMES.md (Beauty Contest).
//
// Everyone pays the same entry and picks a whole number from 0 to 100.
// Target = 2/3 of the average guess. The closest guess wins; ties split the prize.
// The target can't go above 66.67, so guesses above 67 never win.
//
// PAYOUT (changed 2026-11-15, was "the pot minus 2%"): against the sim bots the bot entries were minted,
// so a player who learned where the bots guess won about 3.4x per entry. Now a win pays
// entry x BEAUTY_PAYOUT_BPS[guess] / 10,000, shared between tied winners, and that multiplier is
// 98% divided by the guess's real win share against the bot crowd (lib/beautyOdds.ts, made by
// sandbox/beauty-odds.mjs). So every guess returns about 98%, like Crash's targets, and a guess the
// bots rarely agree with pays more. Guesses 0-2 and 40+ hit the 200x cap and return less than 98%.
//
// In sim mode the other players are bots. Their guesses come from the round seed,
// which only exists after betting locks, so nobody can see them early. On-chain,
// real players would commit a hash of (guess, salt), then reveal after commits close.

import { encodeAbiParameters, keccak256, type Hex } from 'viem'
import { BEAUTY_PAYOUT_BPS } from './beautyOdds'

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

/** What a win pays per 1 staked for this guess (before splitting with ties). Shown before you enter. */
export const beautyMultiplier = (guess: number) => BEAUTY_PAYOUT_BPS[guess] / 10_000

/** A win pays entry x the guess's multiplier, split between tied winners, rounded down. */
export function beautyPayout(entry: bigint, r: BeautyResult): bigint {
  if (!r.youWon) return 0n
  return (entry * BigInt(BEAUTY_PAYOUT_BPS[r.guesses[0]])) / 10_000n / BigInt(r.winners.length)
}
