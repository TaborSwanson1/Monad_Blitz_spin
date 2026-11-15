import { encodeAbiParameters, keccak256, type Hex } from 'viem'
import { beautyPayout, resolveBeauty } from './beauty'
import { CRASH_TARGETS_X100, crashPointX100, fmtX } from './crash'
import { GAMES, payoutBpsFor, type GameDef } from './games'

/** Same as BlockCasino.gameSeed: keccak256(abi.encode(roundSeed, gameId)). */
export function gameSeed(roundSeed: Hex, gameId: number): Hex {
  return keccak256(encodeAbiParameters([{ type: 'bytes32' }, { type: 'uint8' }], [roundSeed, gameId]))
}

/** Same as UniformGame.rawResult and UniformGame.outcome. */
export function resolveGame(roundSeed: Hex, g: GameDef): { raw: number; outcome: number } {
  const raw = BigInt(gameSeed(roundSeed, g.id)) % BigInt(g.range)
  return { raw: Number(raw), outcome: Number(raw / BigInt(g.range / g.outcomes)) }
}

export interface BetResult {
  /** Uniform: the number shown (0-99 etc). Crash: the crash point in hundredths. */
  raw: number
  /** Uniform: the winning outcome index. Crash: the highest target reached, or -1. */
  outcome: number
  won: boolean
  payout: bigint
}

/** Works for every game kind. Payouts round down, same as the contract. */
export function resolveBet(roundSeed: Hex, gameId: number, choice: number, amount: bigint): BetResult {
  const g = GAMES[gameId]
  if (g.kind === 'beauty') {
    const r = resolveBeauty(gameSeed(roundSeed, g.id), choice)
    // raw: the target in hundredths. outcome: the first winning guess.
    return {
      raw: Math.round(r.target * 100),
      outcome: r.guesses[r.winners[0]],
      won: r.youWon,
      payout: beautyPayout(amount, r),
    }
  }
  if (g.kind === 'crash') {
    const raw = crashPointX100(gameSeed(roundSeed, g.id))
    let outcome = -1
    CRASH_TARGETS_X100.forEach((t, i) => {
      if (raw >= t) outcome = i
    })
    const won = raw >= CRASH_TARGETS_X100[choice]
    return { raw, outcome, won, payout: won ? (amount * BigInt(payoutBpsFor(g, choice))) / 10_000n : 0n }
  }
  const { raw, outcome } = resolveGame(roundSeed, g)
  const won = outcome === choice
  return { raw, outcome, won, payout: won ? (amount * BigInt(g.payoutBps)) / 10_000n : 0n }
}

/** Short result text for history rows, like "HI·LO HIGH 50–99" or "CRASH 2.37×". */
export function resultLabel(gameId: number, raw: number, outcome: number): string {
  const g = GAMES[gameId]
  if (g.kind === 'beauty') return `${g.short} target ${(raw / 100).toFixed(1)}`
  return g.kind === 'crash' ? `${g.short} ${fmtX(raw)}` : `${g.short} ${g.labels[outcome]}`
}
