import { toHex, type Address, type Hex } from 'viem'
import { lockBlock, roundIdAt, type RoundConfig } from '../lib/rounds'
import { toChips } from '../lib/format'
import { GAMES } from '../lib/games'
import { BEAUTY_ENTRY } from '../lib/beauty'
import type { BlockInfo, CasinoClient, PlacedBet, RoundState } from './types'
import { liveBlocksEnabled, watchLiveBlocks } from './liveBlocks'

// A simulated casino that runs in the browser.
//
// Clock: by default it follows LIVE Monad testnet blocks (liveBlocks.ts), so rounds
// open and lock with the real chain. If the feed is unavailable or stalls for
// STALE_MS, fake blocks continue every 300 ms (Monad's measured pace) until it
// comes back. VITE_LIVE_BLOCKS=off gives the old fully offline simulator.
//
// Round timing matches the contract's 60/40 blocks. The seed comes from
// crypto.getRandomValues, NEVER from block data. Fine for a demo, not verifiable.

const BLOCK_MS = 300
const STALE_MS = 3_000
const SETTLE_DELAY = 6n // blocks after lock before the "VRF" answers
const GAS_LIMIT = 150_000_000n

const randomHex = (bytes: number): Hex => toHex(crypto.getRandomValues(new Uint8Array(bytes)))

export function createSimClient(): CasinoClient {
  const cfg: RoundConfig = {
    // Live: rounds are aligned to real Monad block numbers (round r starts at block 60r).
    genesisBlock: liveBlocksEnabled ? 0n : 18_400_000n,
    roundLength: 60n,
    bettingWindow: 40n,
    minBet: toChips('1'),
    maxBet: toChips('500'),
  }
  // Until the first live block arrives (or if it never does), start from a made-up height.
  let head = 18_400_003n
  let balance = 0n
  const seeds = new Map<bigint, Hex>()
  const betCounts = new Map<bigint, number>()
  const beautyEntered = new Set<bigint>()
  const listeners = new Set<(b: BlockInfo) => void>()
  let timer: ReturnType<typeof setInterval> | undefined
  let stopLive: (() => void) | undefined
  let lastLiveAt = 0

  function makeBlock(n: bigint): BlockInfo {
    const load = Math.random() ** 1.8
    const txCount = Math.floor(load * 900)
    return {
      number: n,
      hash: randomHex(32),
      txCount,
      gasUsed: (GAS_LIMIT * BigInt(Math.floor(load * 1000))) / 1000n,
      gasLimit: GAS_LIMIT,
      timestamp: Math.floor(Date.now() / 1000),
      source: 'sim',
    }
  }

  const emit = (b: BlockInfo) => listeners.forEach((l) => l(b))

  /** Fake block. With the live feed on, only while it is stale. */
  function tick() {
    if (liveBlocksEnabled && Date.now() - lastLiveAt < STALE_MS) return
    head += 1n
    emit(makeBlock(head))
  }

  function onLive(b: BlockInfo) {
    lastLiveAt = Date.now()
    // Keep the clock monotonic: after a fallback, wait until the real chain passes the fake head.
    if (b.number <= head) return
    head = b.number
    emit(b)
  }

  return {
    mode: 'sim',
    label: 'SIMULATOR',
    autoSettles: true,
    async init() {
      return cfg
    },
    subscribeBlocks(cb) {
      listeners.add(cb)
      if (liveBlocksEnabled && !stopLive) {
        lastLiveAt = Date.now() // grace period before falling back to fake blocks
        stopLive = watchLiveBlocks(onLive, (e) => console.warn('Live Monad blocks:', e.message))
      }
      if (!timer) timer = setInterval(tick, BLOCK_MS)
      return () => {
        listeners.delete(cb)
        if (listeners.size === 0) {
          if (timer) clearInterval(timer)
          timer = undefined
          stopLive?.()
          stopLive = undefined
        }
      }
    },
    async connect() {
      if (balance === 0n) balance = toChips('1000')
      return '0x5100000000000000000000000000000000000051' as Address
    },
    async balance() {
      return balance
    },
    async faucet() {
      balance += toChips('1000')
    },
    async placeBet(gameId, choice, amount): Promise<PlacedBet> {
      const roundId = roundIdAt(head, cfg)
      if (head >= lockBlock(roundId, cfg)) throw new Error('Betting is closed for this round')
      // Same checks as BlockCasino.placeBet: UnknownGame and BadChoice.
      if (!GAMES[gameId]) throw new Error('Unknown game')
      if (choice < 0 || choice >= GAMES[gameId].outcomes) throw new Error('Bad choice for this game')
      // Beauty Contest: one entry per player per round, at the fixed entry fee.
      if (GAMES[gameId].kind === 'beauty') {
        if (amount !== BEAUTY_ENTRY) throw new Error('Beauty Contest entry is 10 CHIP')
        if (beautyEntered.has(roundId)) throw new Error('You already entered this round')
        beautyEntered.add(roundId)
      }
      if (amount < cfg.minBet || amount > cfg.maxBet) throw new Error('Bet must be between 1 and 500 CHIP')
      if (amount > balance) throw new Error('Not enough chips. Use the faucet.')
      balance -= amount
      const index = betCounts.get(roundId) ?? 0
      betCounts.set(roundId, index + 1)
      return { roundId, index, gameId, choice, amount }
    },
    async roundState(roundId): Promise<RoundState> {
      const lock = lockBlock(roundId, cfg)
      if (head < lock) return { status: 'none' }
      if (head < lock + SETTLE_DELAY) return { status: 'requested' }
      let seed = seeds.get(roundId)
      if (!seed) {
        seed = randomHex(32)
        seeds.set(roundId, seed)
      }
      return { status: 'settled', seed }
    },
    async requestSettlement() {},
    async claim(_bet, payout) {
      balance += payout
    },
  }
}
