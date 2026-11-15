import { createPublicClient, http, webSocket, type Block } from 'viem'
import type { BlockInfo } from './types'

// Live Monad testnet blocks for the sim's clock and block display.
//
// DISPLAY AND TIMING ONLY. Nothing here feeds a game result: sim results come
// from crypto.getRandomValues, chain results from the VRF. Block data can be
// steered by whoever builds the block (CLAUDE.md non-negotiables).
//
// Two transports, in order:
//   1. websocket newHeads: wss://testnet-rpc.monad.xyz, about one block every 0.3 s.
//      Worked on 2026-11-15, then started refusing upgrades (HTTP 405) the same day.
//   2. HTTP polling: https://testnet-rpc.monad.xyz, once a second, emitting every
//      block including the ones between polls. About 4 requests/s, under the 20 rps limit.
// If both fail, sim.ts falls back to fake blocks.

const env = import.meta.env

export const LIVE_BLOCKS_WS = env.VITE_LIVE_BLOCKS_WS || 'wss://testnet-rpc.monad.xyz'
export const LIVE_BLOCKS_HTTP = env.VITE_RPC_HTTP || 'https://testnet-rpc.monad.xyz'

/** On by default. Set VITE_LIVE_BLOCKS=off for a fully offline simulator. */
export const liveBlocksEnabled = env.VITE_LIVE_BLOCKS !== 'off'

// Etherscan-style /block/<number> paths. Not checked in a browser: the explorer blocks scripted requests.
export const MONAD_EXPLORER = 'https://testnet.monadscan.com'

const POLL_MS = 1_000

function toInfo(b: Block): BlockInfo | null {
  if (b.number === null || b.hash === null) return null // pending block
  return {
    number: b.number,
    hash: b.hash,
    txCount: b.transactions.length,
    gasUsed: b.gasUsed,
    gasLimit: b.gasLimit,
    timestamp: Number(b.timestamp),
    source: 'monad',
  }
}

/**
 * Calls onBlock for every new Monad testnet block. Returns an unsubscribe function.
 * Starts on the websocket. If it errors, switches to HTTP polling for the rest
 * of the session. onError is informational.
 */
export function watchLiveBlocks(onBlock: (b: BlockInfo) => void, onError?: (e: Error) => void): () => void {
  let closed = false
  let stop: () => void = () => {}
  const emit = (b: Block) => {
    const info = toInfo(b)
    if (info && !closed) onBlock(info)
  }

  function startHttp() {
    const client = createPublicClient({ transport: http(LIVE_BLOCKS_HTTP), pollingInterval: POLL_MS })
    stop = client.watchBlocks({
      emitMissed: true,
      onBlock: emit,
      onError: (e) => {
        if (!closed) onError?.(e)
      },
    })
  }

  function startWs() {
    const client = createPublicClient({ transport: webSocket(LIVE_BLOCKS_WS, { retryCount: 1 }) })
    let failed = false
    const unwatch = client.watchBlocks({
      onBlock: emit,
      onError: (e) => {
        if (closed || failed) return
        failed = true
        onError?.(new Error(`websocket failed, polling over HTTP instead (${e.message.split('\n')[0]})`))
        stop()
        startHttp()
      },
    })
    stop = () => {
      unwatch()
      client.transport.getRpcClient?.().then((c: { close: () => void }) => c.close()).catch(() => {})
    }
  }

  startWs()
  return () => {
    closed = true
    stop()
  }
}
