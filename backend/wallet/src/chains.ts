import { defineChain, type Chain } from 'viem'

/** Verified 2026-11-15: chain ID 10143 (live eth_chainId), RPC and explorers from docs.monad.xyz. */
export const monadTestnet = defineChain({
  id: 10143,
  name: 'Monad Testnet',
  nativeCurrency: { name: 'Monad', symbol: 'MON', decimals: 18 },
  rpcUrls: { default: { http: ['https://testnet-rpc.monad.xyz'] } },
  blockExplorers: { default: { name: 'Monadscan', url: 'https://testnet.monadscan.com' } },
  testnet: true,
})

/** Local anvil from `cd backend && npm run dev`. */
export const localAnvil = defineChain({
  id: 31337,
  name: 'Local (anvil)',
  nativeCurrency: { name: 'Monad', symbol: 'MON', decimals: 18 },
  rpcUrls: { default: { http: ['http://127.0.0.1:8545'] } },
  testnet: true,
})

export const CHAINS: Record<number, Chain> = { [monadTestnet.id]: monadTestnet, [localAnvil.id]: localAnvil }

/** Where players get testnet MON for gas. The host answered on 2026-11-15 (rate-limited, so its page wasn't checked). */
export const MON_FAUCET_URL = 'https://faucet.monad.xyz'
