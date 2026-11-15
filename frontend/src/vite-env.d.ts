/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MODE?: 'sim' | 'chain'
  readonly VITE_CHAIN_ID?: string
  readonly VITE_RPC_HTTP?: string
  readonly VITE_RPC_WS?: string
  readonly VITE_CASINO_ADDRESS?: string
  readonly VITE_CHIP_ADDRESS?: string
}
