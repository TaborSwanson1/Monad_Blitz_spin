// Every wallet transaction the chain client sends, so the UI can show it with a
// Monadscan link. Chain mode only: the simulator sends no transactions.

import type { Hex } from 'viem'
import { MONAD_EXPLORER } from './liveBlocks'

export interface TxEntry {
  id: number
  /** What the player did, in plain words: "Claimed 1,000 free CHIP". */
  label: string
  hash: Hex
  status: 'pending' | 'confirmed' | 'failed'
  at: number
}

const listeners = new Set<(list: TxEntry[]) => void>()
let list: TxEntry[] = []
let nextId = 1

const emit = () => listeners.forEach((f) => f(list))

export function txStarted(label: string, hash: Hex): number {
  const id = nextId++
  list = [{ id, label, hash, status: 'pending' as const, at: Date.now() }, ...list].slice(0, 12)
  emit()
  return id
}

export function txFinished(id: number, ok: boolean) {
  list = list.map((t) => (t.id === id ? { ...t, status: ok ? 'confirmed' : 'failed' } : t))
  emit()
}

export function onTxs(f: (list: TxEntry[]) => void) {
  listeners.add(f)
  f(list)
  return () => {
    listeners.delete(f)
  }
}

export const txUrl = (hash: string) => `${MONAD_EXPLORER}/tx/${hash}`
export const addressUrl = (addr: string) => `${MONAD_EXPLORER}/address/${addr}`
