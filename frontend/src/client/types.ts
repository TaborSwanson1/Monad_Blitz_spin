import type { Address, Hex } from 'viem'
import type { RoundConfig } from '../lib/rounds'

export interface BlockInfo {
  number: bigint
  hash: Hex
  txCount: number
  gasUsed: bigint
  gasLimit: bigint
  timestamp: number
  /** Where the block came from: live Monad testnet, the in-browser simulator, or a local chain. */
  source?: 'monad' | 'sim' | 'local'
}

export interface PlacedBet {
  roundId: bigint
  index: number
  gameId: number
  choice: number
  amount: bigint
}

export type RoundStatus = 'none' | 'requested' | 'settled' | 'expired'

export interface RoundState {
  status: RoundStatus
  seed?: Hex
}

/** Everything the UI needs. The sim and chain clients both implement it. */
export interface CasinoClient {
  mode: 'sim' | 'chain'
  label: string
  /** True if rounds settle without the player sending a transaction. */
  autoSettles: boolean
  init(): Promise<RoundConfig>
  subscribeBlocks(cb: (b: BlockInfo) => void): () => void
  connect(): Promise<Address>
  balance(): Promise<bigint>
  faucet(): Promise<void>
  placeBet(gameId: number, choice: number, amount: bigint): Promise<PlacedBet>
  roundState(roundId: bigint): Promise<RoundState>
  requestSettlement(roundId: bigint): Promise<void>
  /** Called only for winning bets. */
  claim(bet: PlacedBet, payout: bigint): Promise<void>
}
