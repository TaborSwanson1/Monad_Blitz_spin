import { toHex, type Address, type Hex } from 'viem'
import { lockBlock, roundIdAt, type RoundConfig } from '../lib/rounds'
import { toChips } from '../lib/format'
import { GAMES } from '../lib/games'
import type { BlockInfo, CasinoClient, PlacedBet, RoundState } from './types'

// A fake chain that runs in the browser. Blocks every 300 ms, Monad testnet's measured pace.
// Round timing matches the contract's 60/40 blocks. The seed comes from
// crypto.getRandomValues. Fine for a demo, not verifiable.

const BLOCK_MS = 300
const SETTLE_DELAY = 6n // blocks after lock before the "VRF" answers
const GAS_LIMIT = 150_000_000n

const randomHex = (bytes: number): Hex => toHex(crypto.getRandomValues(new Uint8Array(bytes)))

export function createSimClient(): CasinoClient {
  const cfg: RoundConfig = {
    genesisBlock: 18_400_000n,
    roundLength: 60n,
    bettingWindow: 40n,
    minBet: toChips('1'),
    maxBet: toChips('500'),
  }
  let head = cfg.genesisBlock + 3n
  let balance = 0n
  const seeds = new Map<bigint, Hex>()
  const betCounts = new Map<bigint, number>()
  const listeners = new Set<(b: BlockInfo) => void>()
  let timer: ReturnType<typeof setInterval> | undefined

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
    }
  }

  function tick() {
    head += 1n
    const b = makeBlock(head)
    listeners.forEach((l) => l(b))
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
      if (!timer) timer = setInterval(tick, BLOCK_MS)
      return () => {
        listeners.delete(cb)
        if (listeners.size === 0 && timer) {
          clearInterval(timer)
          timer = undefined
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
