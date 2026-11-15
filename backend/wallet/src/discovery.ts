import type { EIP1193Provider } from 'viem'

/** EIP-6963 wallet metadata, as each wallet announces itself. */
export interface WalletInfo {
  uuid: string
  /** Display name, like "MetaMask" or "Phantom". */
  name: string
  /** Data URI of the wallet's icon, ready for an <img src>. */
  icon: string
  /** Reverse-DNS id, like "io.metamask". Stable across page loads; used to reconnect. */
  rdns: string
}

export interface DiscoveredWallet {
  info: WalletInfo
  provider: EIP1193Provider
}

type Target = Pick<EventTarget, 'addEventListener' | 'removeEventListener' | 'dispatchEvent'> & { ethereum?: EIP1193Provider }

const defaultTarget = (): Target | undefined => (typeof window === 'undefined' ? undefined : (window as unknown as Target))

/**
 * Lists installed wallets as they announce themselves (EIP-6963) and calls
 * `onChange` with the full list each time one appears. Wallets that only inject
 * `window.ethereum` show up as "Browser wallet". Returns a stop function.
 */
export function watchWallets(onChange: (wallets: DiscoveredWallet[]) => void, target: Target | undefined = defaultTarget()): () => void {
  if (!target) {
    onChange([])
    return () => {}
  }
  const found = new Map<string, DiscoveredWallet>()
  const emit = () => onChange([...found.values()])
  const onAnnounce = (event: Event) => {
    const detail = (event as CustomEvent<DiscoveredWallet>).detail
    if (!detail?.info?.rdns || !detail.provider) return
    found.set(detail.info.rdns, { info: detail.info, provider: detail.provider })
    emit()
  }
  target.addEventListener('eip6963:announceProvider', onAnnounce)
  target.dispatchEvent(new Event('eip6963:requestProvider'))

  // Legacy wallets that don't speak EIP-6963. Added only if nothing else announced.
  const legacy = setTimeout(() => {
    if (found.size === 0 && target.ethereum) {
      found.set('injected', {
        info: { uuid: 'injected', name: 'Browser wallet', icon: '', rdns: 'injected' },
        provider: target.ethereum,
      })
      emit()
    }
  }, 300)
  emit()

  return () => {
    clearTimeout(legacy)
    target.removeEventListener('eip6963:announceProvider', onAnnounce)
  }
}

/** One-shot version of watchWallets: waits `ms` for announcements, then returns the list. */
export function discoverWallets(ms = 400, target: Target | undefined = defaultTarget()): Promise<DiscoveredWallet[]> {
  return new Promise((resolve) => {
    let latest: DiscoveredWallet[] = []
    const stop = watchWallets((w) => (latest = w), target)
    setTimeout(() => {
      stop()
      resolve(latest)
    }, ms)
  })
}
