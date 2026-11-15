// Crash math. PROPOSED, sim mode only. The backend hasn't agreed to it yet.
// See frontend/GAMES.md (Crash) and frontend/INTEGRATION.md (Proposed: Crash).
//
// Players pick a cash-out target before betting closes. One crash point per round.
// A bet wins if crashPoint >= target, and then pays stake * target.
//
//   r          = uint256(gameSeed) % 2^52
//   crashX100  = 98 * 2^52 / (2^52 - r)        // integer division, hundredths (237 = 2.37x)
//   if crashX100 < 100: crashX100 = 100         // instant crash, about 2% of rounds
//   win        = crashX100 >= targetX100
//   payout     = amount * targetX100 / 100       // rounded down
//
// P(crashX100 >= T) = 98 / T, so the expected return is (98 / T) * (T / 100) = 0.98
// for every target. That's the same 2% edge as the other games.

import type { Hex } from 'viem'

/** Targets a player can pick, in hundredths. `choice` is the index into this list. */
export const CRASH_TARGETS_X100 = [110, 125, 150, 200, 300, 500, 1000, 2000, 5000] as const

/** 2.00x, the default pick. */
export const CRASH_DEFAULT_CHOICE = 3

const TWO_52 = 2n ** 52n

export function crashPointX100(gameSeed: Hex): number {
  const r = BigInt(gameSeed) % TWO_52
  const x = (98n * TWO_52) / (TWO_52 - r)
  return Number(x < 100n ? 100n : x)
}

export const crashWinChance = (targetX100: number) => 98 / targetX100

export const fmtX = (x100: number) =>
  `${(x100 / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}×`
