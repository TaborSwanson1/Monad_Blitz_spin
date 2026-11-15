import { createWalletSession, type WalletSession } from '@block-casino/wallet'
import { zeroAddress, type Address } from 'viem'

// One wallet session for the whole app, built on finkierstead's SDK (backend/wallet/).
// Owner: Zander (lobby and wallet connect UI).
//
// The SDK needs the casino's addresses. There's no testnet deployment yet, and the
// GitHub Pages demo runs in sim mode, so without addresses the session still finds,
// connects and switches the wallet to Monad Testnet, but the casino reads and actions
// aren't used (`hasContracts` is false and the UI says so).

const env = import.meta.env
const casino = (env.VITE_CASINO_ADDRESS || undefined) as Address | undefined
const chip = (env.VITE_CHIP_ADDRESS || undefined) as Address | undefined

/** True when the frontend knows where the casino contracts are (chain mode or a local deploy). */
export const hasContracts = !!casino && !!chip

function create(): WalletSession | null {
  try {
    return createWalletSession({
      deployment: {
        chainId: Number(env.VITE_CHAIN_ID || 10143),
        rpc: env.VITE_RPC_HTTP || undefined,
        contracts: { blockCasino: casino ?? zeroAddress, chipToken: chip ?? zeroAddress },
      },
    })
  } catch (e) {
    console.warn('Wallet unavailable:', e)
    return null
  }
}

/** Null only if the SDK rejected the config (an unknown chain ID). */
export const walletSession = create()

export const NETWORK_NAMES: Record<number, string> = { 10143: 'Monad Testnet', 31337: 'Local chain' }
