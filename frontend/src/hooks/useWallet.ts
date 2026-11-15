import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { watchWallets, type DiscoveredWallet, type WalletState } from '@block-casino/wallet'
import { hasContracts, walletSession } from '../wallet/session'

const IDLE: WalletState = { status: 'disconnected', wallet: null, address: null, chainId: null, targetChainId: 10143 }
const noSubscribe = () => () => {}
const idleState = () => IDLE

/** Wallet connection state and actions for the UI. Wraps backend/wallet's session. */
export function useWallet() {
  const s = walletSession
  const state = useSyncExternalStore(s ? s.subscribe : noSubscribe, s ? s.getState : idleState)
  const [wallets, setWallets] = useState<DiscoveredWallet[]>([])
  /** Set when several wallets are installed and the player has to pick one. */
  const [picker, setPicker] = useState<DiscoveredWallet[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mon, setMon] = useState<bigint | null>(null)
  const triedReconnect = useRef(false)

  useEffect(() => watchWallets(setWallets), [])

  // Silent reconnect on page load, once wallets have had a moment to announce. Never opens a popup.
  useEffect(() => {
    if (!s || triedReconnect.current || wallets.length === 0) return
    triedReconnect.current = true
    const t = setTimeout(() => s.reconnect(wallets).catch(() => {}), 300)
    return () => clearTimeout(t)
  }, [s, wallets])

  // MON balance for gas, only when the casino is deployed (the SDK reads chips in the same call).
  useEffect(() => {
    setMon(null)
    if (!s || !hasContracts || state.status !== 'connected' || !state.address) return
    let live = true
    s.balances()
      .then((b) => live && setMon(b.mon))
      .catch(() => {})
    return () => {
      live = false
    }
  }, [s, state.status, state.address])

  const fail = useCallback(
    (e: unknown) => {
      const err = e as { code?: string; message?: string; wallets?: DiscoveredWallet[] }
      if (err?.code === 'CHOOSE_WALLET') setPicker(err.wallets?.length ? err.wallets : wallets)
      else if (err?.code === 'USER_REJECTED') setError(null) // the player said no: stay quiet
      else setError(err?.message ?? String(e))
    },
    [wallets],
  )

  const connect = useCallback(async () => {
    if (!s) return setError('Wallet support failed to load. Check the chain settings in .env.')
    setError(null)
    try {
      await s.connectWallet(wallets.length ? { wallets } : {})
    } catch (e) {
      fail(e)
    }
  }, [s, wallets, fail])

  const choose = useCallback(
    async (w: DiscoveredWallet) => {
      setPicker(null)
      if (!s) return
      try {
        await s.connect(w)
      } catch (e) {
        fail(e)
      }
    },
    [s, fail],
  )

  const switchNetwork = useCallback(async () => {
    try {
      await s?.switchNetwork()
    } catch (e) {
      fail(e)
    }
  }, [s, fail])

  const disconnect = useCallback(() => s?.disconnect(), [s])

  return {
    available: !!s,
    state,
    wallets,
    picker,
    closePicker: () => setPicker(null),
    error,
    clearError: () => setError(null),
    mon,
    connect,
    choose,
    switchNetwork,
    disconnect,
  }
}

export type WalletApi = ReturnType<typeof useWallet>
