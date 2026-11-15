// Crash math. PROPOSED, sim mode only. The backend hasn't agreed to it yet.
// See frontend/GAMES.md (Crash) and frontend/INTEGRATION.md (Proposed: Crash).
//
// One crash point per round. After betting locks, the multiplier climbs live and players
// cash out by hand. A bet can also carry an optional auto cash-out target as a backup.
// The bet's effective cash-out is whichever comes first: the click or the auto target.
// A bet wins if crashPoint >= that cash-out, and then pays stake * cash-out.
//
// Sim mode only. On-chain, the crash point must stay unknown while people decide, so
// the contract would decide it only after the round (see frontend/INTEGRATION.md).
//
//   r          = uint256(gameSeed) % 2^52
//   crashX100  = 98 * 2^52 / (2^52 - r)        // integer division, hundredths (237 = 2.37x)
//   if crashX100 < 100: crashX100 = 100         // instant crash, about 2% of rounds
//   win        = crashX100 >= cashoutX100
//   payout     = amount * cashoutX100 / 100      // rounded down
//
// P(crashX100 >= T) = 98 / T, so the expected return is (98 / T) * (T / 100) = 0.98
// for every cash-out point. That's the same 2% edge as the other games, whether you
// click or set a target.

import type { Hex } from 'viem'

/** Auto cash-out targets, in hundredths. `choice` is the index into this list. */
export const CRASH_TARGETS_X100 = [110, 125, 150, 200, 300, 500, 1000, 2000, 5000] as const

/** `choice` for "no auto cash-out": the player cashes out by hand. The default. */
export const CRASH_MANUAL = CRASH_TARGETS_X100.length
export const CRASH_DEFAULT_CHOICE = CRASH_MANUAL

/** The auto target for a choice, or Infinity for a manual-only bet. */
export const autoTargetX100 = (choice: number): number =>
  choice >= 0 && choice < CRASH_TARGETS_X100.length ? CRASH_TARGETS_X100[choice] : Infinity

/** The bet's cash-out: the earlier of a manual click and its auto target. Infinity = never. */
export const effectiveCashoutX100 = (choice: number, manualX100?: number): number =>
  Math.min(autoTargetX100(choice), manualX100 ?? Infinity)

const TWO_52 = 2n ** 52n

export function crashPointX100(gameSeed: Hex): number {
  const r = BigInt(gameSeed) % TWO_52
  const x = (98n * TWO_52) / (TWO_52 - r)
  return Number(x < 100n ? 100n : x)
}

export const crashWinChance = (targetX100: number) => 98 / targetX100

export const fmtX = (x100: number) =>
  `${(x100 / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}×`
