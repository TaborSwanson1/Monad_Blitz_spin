import { encodeAbiParameters, keccak256, type Hex } from 'viem'
import type { GameDef } from './games'

/** Same as BlockCasino.gameSeed: keccak256(abi.encode(roundSeed, gameId)). */
export function gameSeed(roundSeed: Hex, gameId: number): Hex {
  return keccak256(encodeAbiParameters([{ type: 'bytes32' }, { type: 'uint8' }], [roundSeed, gameId]))
}

/** Same as UniformGame.rawResult and UniformGame.outcome. */
export function resolveGame(roundSeed: Hex, g: GameDef): { raw: number; outcome: number } {
  const raw = BigInt(gameSeed(roundSeed, g.id)) % BigInt(g.range)
  return { raw: Number(raw), outcome: Number(raw / BigInt(g.range / g.outcomes)) }
}

export function payoutFor(amount: bigint, won: boolean, g: GameDef): bigint {
  return won ? (amount * BigInt(g.payoutBps)) / 10_000n : 0n
}
