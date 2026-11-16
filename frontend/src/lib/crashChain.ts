// On-chain Crash, "blind window" version. PROPOSED: the contract doesn't have it yet.
// Spec: frontend/INTEGRATION.md (Proposed: Crash on-chain). The sim keeps its live engine (liveCrash.ts).
//
// After betting locks, the multiplier steps up once per block for `climbBlocks` blocks:
//   multX100(0) = 100, multX100(k) = multX100(k - 1) * 120 / 100   (integer division, each step)
// so block 1 is 1.20x, block 4 is 2.07x, block 20 is about 38x.
//
// cashOut(roundId, betIndex) is allowed for blocks k = 1..climbBlocks after lock. The contract
// saves k for the block the transaction lands in. The round's seed can only be requested once
// the window is over, so nobody (player, house or node) knows the crash point while deciding.
//
// The bet's cash-out is the lowest of: its auto target, its manual cash-out, and the final
// multiplier (a bet still riding when the window ends cashes out there). Then the same seeded
// formula as crash.ts decides: win if crashPointX100(gameSeed) >= cash-out, pay stake x cash-out.
// P(crash >= x) = 98 / x, so every cash-out point returns 98%, clicked or automatic.
//
// k starts at 1 on purpose: a cash-out at 1.00x would always win (the formula floors at 1.00x),
// which would return 100%.

/** Multiplier in hundredths, k blocks after lock. Same loop the contract runs. */
export function blockMultX100(k: number): number {
  let x = 100
  for (let i = 0; i < k; i++) x = Math.floor((x * 120) / 100)
  return x
}

/** The cash-out to pass to resolveBet as the manual one: the click, or the end of the window. */
export function chainManualX100(cashoutBlock: number | undefined, climbBlocks: number): number {
  const k = cashoutBlock === undefined ? climbBlocks : Math.min(Math.max(cashoutBlock, 1), climbBlocks)
  return blockMultX100(k)
}

/** Where the window is right now, from the head block. */
export function climbAt(head: bigint, lock: bigint, climbBlocks: number) {
  const k = Number(head - lock)
  return {
    /** Blocks since lock, clamped to the window. */
    k: Math.max(0, Math.min(k, climbBlocks)),
    open: k >= 0 && k < climbBlocks,
    over: k >= climbBlocks,
  }
}
