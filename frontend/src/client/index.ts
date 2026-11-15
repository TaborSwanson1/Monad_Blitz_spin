import { createChainClient } from './chain'
import { createSimClient } from './sim'
import type { CasinoClient } from './types'

export function createClient(): CasinoClient {
  return import.meta.env.VITE_MODE === 'chain' ? createChainClient() : createSimClient()
}

export type { CasinoClient, BlockInfo, PlacedBet } from './types'
