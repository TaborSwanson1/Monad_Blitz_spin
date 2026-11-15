import { createPublicClient, webSocket } from 'viem'
import type { BlockInfo } from './types'

// Live Monad testnet blocks for the sim's clock and block display.
//
// DISPLAY AND TIMING ONLY. Nothing here feeds a game result: sim results come
// from crypto.getRandomValues, chain results from the VRF. Block data can be
// steered by whoever builds the block (CLAUDE.md non-negotiables).
//
// Verified 2026-11-15: wss://testnet-rpc.monad.xyz streams newHeads, about one
// block every 0.3 s. The /ws path does not work.

const env = import.meta.env

export const LIVE_BLOCKS_WS = env.VITE_LIVE_BLOCKS_WS || 'wss://testnet-rpc.monad.xyz'

/** On by default. Set VITE_LIVE_BLOCKS=off for a fully offline simulator. */
export const liveBlocksEnabled = env.VITE_LIVE_BLOCKS !== 'off'

// Etherscan-style /block/<number> paths. Not checked in a browser: the explorer blocks scripted requests.
export const MONAD_EXPLORER = 'https://testnet.monadscan.com'

/**
 * Calls onBlock for every new Monad testnet block. Returns an unsubscribe function.
 * viem reconnects the socket by itself. onError is informational.
 */
export function watchLiveBlocks(onBlock: (b: BlockInfo) => void, onError?: (e: Error) => void): () => void {
  const client = createPublicClient({ transport: webSocket(LIVE_BLOCKS_WS) })
  let closed = false
  const unwatch = client.watchBlocks({
    onBlock: (b) => {
      if (b.number === null || b.hash === null) return // pending block, skip
      onBlock({
        number: b.number,
        hash: b.hash,
        txCount: b.transactions.length,
        gasUsed: b.gasUsed,
        gasLimit: b.gasLimit,
        timestamp: Number(b.timestamp),
        source: 'monad',
      })
    },
    onError: (e) => {
      if (!closed) onError?.(e) // closing the socket ourselves also raises an error
    },
  })
  return () => {
    closed = true
    unwatch()
    client.transport.getRpcClient?.().then((c: { close: () => void }) => c.close()).catch(() => {})
  }
}
