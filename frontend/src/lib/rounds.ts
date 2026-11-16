// Round timing. Same formulas as BlockCasino.sol.

export interface RoundConfig {
  genesisBlock: bigint
  roundLength: bigint
  bettingWindow: bigint
  minBet: bigint
  maxBet: bigint
  /** How many games the contract has. Chain mode shows Crash (3) and Beauty Contest (4) only when it has them. */
  gameCount?: number
  /** On-chain Crash: blocks of climb after lock (lib/crashChain.ts). Unset = no on-chain Crash, or sim mode. */
  crashClimbBlocks?: number
}

export const roundIdAt = (block: bigint, c: RoundConfig) =>
  block < c.genesisBlock ? 0n : (block - c.genesisBlock) / c.roundLength

export const roundStart = (id: bigint, c: RoundConfig) => c.genesisBlock + id * c.roundLength

export const lockBlock = (id: bigint, c: RoundConfig) => roundStart(id, c) + c.bettingWindow

export interface RoundClock {
  roundId: bigint
  start: bigint
  lock: bigint
  end: bigint
  open: boolean
  blocksToLock: bigint
  blocksToNext: bigint
  /** 0 to 1 through the whole round. */
  progress: number
  /** 0 to 1 through the locked part. 0 while open. */
  heat: number
}

export function roundClock(head: bigint, c: RoundConfig): RoundClock {
  const roundId = roundIdAt(head, c)
  const start = roundStart(roundId, c)
  const lock = lockBlock(roundId, c)
  const end = start + c.roundLength
  const open = head < lock
  const lockedLen = Number(c.roundLength - c.bettingWindow)
  return {
    roundId,
    start,
    lock,
    end,
    open,
    blocksToLock: open ? lock - head : 0n,
    blocksToNext: end - head,
    progress: Number(head - start) / Number(c.roundLength),
    heat: open ? 0 : Math.min(1, (Number(head - lock) + 1) / lockedLen),
  }
}
