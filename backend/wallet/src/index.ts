// @block-casino/wallet: wallet connection + casino actions for any frontend.
// Docs: backend/wallet/README.md

export { createWalletSession } from './session'
export type {
  WalletSession,
  SessionOptions,
  CasinoDeployment,
  WalletState,
  ConnectionStatus,
  Balances,
  RoundConfig,
  RoundInfo,
  RoundStatus,
  Bet,
  TxResult,
  PlacedBet,
  ClaimResult,
} from './session'
export { discoverWallets, watchWallets } from './discovery'
export type { DiscoveredWallet, WalletInfo } from './discovery'
export { WalletError, toWalletError } from './errors'
export type { WalletErrorCode } from './errors'
export { monadTestnet, localAnvil, CHAINS, MON_FAUCET_URL } from './chains'
export { blockCasinoAbi, chipTokenAbi, randomnessSourceAbi } from '../../exports/abis'
