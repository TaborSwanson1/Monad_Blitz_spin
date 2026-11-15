/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MODE?: 'sim' | 'chain'
  readonly VITE_CHAIN_ID?: string
  readonly VITE_RPC_HTTP?: string
  readonly VITE_RPC_WS?: string
  readonly VITE_CASINO_ADDRESS?: string
  readonly VITE_CHIP_ADDRESS?: string
  /** Sim mode: 'off' disables the live Monad block feed. On by default. */
  readonly VITE_LIVE_BLOCKS?: string
  /** Sim mode: websocket for the live block feed. Default wss://testnet-rpc.monad.xyz */
  readonly VITE_LIVE_BLOCKS_WS?: string
}
