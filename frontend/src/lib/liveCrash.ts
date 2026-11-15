// Live Crash engine (sim mode). The crash point is NOT decided in advance: it doesn't
// exist until the climb reaches it. Each step draws fresh randomness and decides whether
// the multiplier crashes right now.
//
// The math keeps the same odds as the seeded version in crash.ts. There, the chance the
// crash point is at or above m is 98 / m (for m >= 1), with a 2% instant crash at 1.00x.
// Live, the chance of surviving one step from m1 up to m2 is (98/m2) / (98/m1) = m1 / m2,
// and the run starts with a 2% instant crash. Multiply the steps together and the chance
// of reaching m is still 98 / m, so a cash-out at m returns 0.98 on average: the same 2%
// edge at every point, whether you click or set an auto target.
//
// Cash-outs and auto targets are exact: before a click locks its multiplier, the engine
// draws the stretch up to that exact moment. A click can't sneak past a crash that was due.
//
// Trade-off: the crash point can't be rechecked from the round's seed afterward. Fine for
// the simulator. On-chain this needs per-step randomness (see frontend/INTEGRATION.md).

import { CRASH_TARGETS_X100, autoTargetX100 } from './crash'

export const INSTANT_CRASH = 0.02
/** Longest climb, in ms. A run that gets this far crashes here (about 1,000x). */
export const MAX_CLIMB_MS = 9000

// The same curve as the replay: about 2x at 1.4 s, 10x at 3.9 s, 100x at 6 s.
const A = 0.412 / 1000
const B = 0.0592 / 1_000_000
export const multAt = (ms: number) => Math.exp(A * ms + B * ms * ms)

/** A uniform random number in [0, 1) from the browser's secure generator. */
export function secureRandom(): number {
  const a = new Uint32Array(1)
  crypto.getRandomValues(a)
  return a[0] / 2 ** 32
}

export interface LiveBet {
  index: number
  choice: number
  amount: bigint
}

export interface LiveState {
  startedAt: number
  /** Highest multiplier the run has survived to so far. */
  m: number
  /** Set once it crashes, in hundredths. */
  crashedX100: number | null
  /** Bet index -> the cash-out that locked in (manual click or auto target), in hundredths. */
  cashouts: Map<number, number>
  /** Which of those were auto targets, for the result text. */
  auto: Set<number>
}

export function startLive(now: number, rand = secureRandom): LiveState {
  const s: LiveState = { startedAt: now, m: 1, crashedX100: null, cashouts: new Map(), auto: new Set() }
  if (rand() < INSTANT_CRASH) s.crashedX100 = 100
  return s
}

/**
 * Move the run forward to time `now`, drawing every stretch. Auto targets in the way are
 * reached (and locked) only if the run survives to them.
 */
export function advance(s: LiveState, bets: LiveBet[], now: number, rand = secureRandom): void {
  if (s.crashedX100 !== null) return
  const elapsed = now - s.startedAt
  const capped = elapsed >= MAX_CLIMB_MS
  // Work in whole hundredths: the run only survives to heights it can pay out exactly.
  const goal = Math.floor(multAt(Math.min(elapsed, MAX_CLIMB_MS)) * 100) / 100
  if (goal <= s.m && !capped) return

  // Stops on the way: auto targets of bets still riding, then the goal.
  const stops = [
    ...new Set(
      bets
        .filter((b) => !s.cashouts.has(b.index))
        .map((b) => autoTargetX100(b.choice) / 100)
        .filter((t) => Number.isFinite(t) && t > s.m && t <= goal),
    ),
  ].sort((a, b) => a - b)
  stops.push(goal)

  for (const p of stops) {
    if (p <= s.m) continue
    if (rand() >= s.m / p) {
      // Crashed somewhere in (s.m, p). It counts as the last height it survived to, so
      // every cash-out already locked is at or under the crash point.
      s.crashedX100 = Math.max(100, Math.round(s.m * 100))
      return
    }
    s.m = p
    for (const b of bets) {
      if (!s.cashouts.has(b.index) && autoTargetX100(b.choice) / 100 <= s.m + 1e-9) {
        s.cashouts.set(b.index, autoTargetX100(b.choice))
        s.auto.add(b.index)
      }
    }
  }
  if (capped) s.crashedX100 = Math.max(100, Math.round(s.m * 100))
}

/** Cash out every bet still riding at the current moment. Returns the multiplier, or null if it crashed first. */
export function cashOutAll(s: LiveState, bets: LiveBet[], now: number, rand = secureRandom): number | null {
  advance(s, bets, now, rand)
  if (s.crashedX100 !== null) return null
  const x100 = Math.round(s.m * 100) // s.m is always on the hundredths grid
  for (const b of bets) if (!s.cashouts.has(b.index)) s.cashouts.set(b.index, x100)
  return x100
}

/** Settle one bet against the live result. Payout rounds down, like everywhere else. */
export function settleLive(s: LiveState, b: LiveBet): { raw: number; outcome: number; won: boolean; payout: bigint; cashoutX100?: number } {
  const raw = s.crashedX100 ?? 100
  let outcome = -1
  CRASH_TARGETS_X100.forEach((t, i) => {
    if (raw >= t) outcome = i
  })
  const at = s.cashouts.get(b.index)
  const won = at !== undefined && raw >= at
  return { raw, outcome, won, payout: won ? (b.amount * BigInt(at)) / 100n : 0n, cashoutX100: at }
}
