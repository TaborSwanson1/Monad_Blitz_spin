import { useEffect, useState } from 'react'
import type { Address } from 'viem'
import { monadPublic } from '../client/chain'
import { onTxs, txUrl, type TxEntry } from '../client/txlog'
import { fmtChips } from '../lib/format'

// Chain mode only: shows the real wallet at work.
//  - useGasBalance: the wallet's MON (testnet gas money), refreshed after every transaction.
//  - addChipToWallet: asks MetaMask to list CHIP, so the chips show inside the wallet too.
//  - TxFeed: each transaction the wallet signs, in plain words, with a Monadscan link.
// Chips are still free play chips from the faucet. Nothing here buys them (CLAUDE.md).

const CHIP = import.meta.env.VITE_CHIP_ADDRESS as Address | undefined

/** The wallet's MON balance. Re-read every 10 s and whenever a transaction confirms. */
export function useGasBalance(account: Address | null): bigint | null {
  const [mon, setMon] = useState<bigint | null>(null)
  useEffect(() => {
    setMon(null)
    if (!account) return
    let live = true
    const read = () =>
      monadPublic
        .getBalance({ address: account })
        .then((b) => live && setMon(b))
        .catch(() => {})
    read()
    const t = setInterval(read, 10_000)
    let seen = 0
    const off = onTxs((list) => {
      const done = list.filter((x) => x.status !== 'pending').length
      if (done !== seen) {
        seen = done
        read()
      }
    })
    return () => {
      live = false
      clearInterval(t)
      off()
    }
  }, [account])
  return mon
}

/** Lists CHIP in the player's wallet (EIP-747). The wallet shows its own confirmation. */
export async function addChipToWallet(): Promise<boolean> {
  if (!window.ethereum || !CHIP) return false
  try {
    return Boolean(
      await window.ethereum.request({
        method: 'wallet_watchAsset',
        params: { type: 'ERC20', options: { address: CHIP, symbol: 'CHIP', decimals: 18 } },
      } as never),
    )
  } catch {
    return false
  }
}

const SHOW_MS = 25_000

/** Recent wallet transactions, bottom right, each with a Monadscan link. */
export function TxFeed() {
  const [list, setList] = useState<TxEntry[]>([])
  const [, tick] = useState(0)
  useEffect(() => onTxs(setList), [])
  // Re-render every few seconds so old confirmed entries drop off.
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 3000)
    return () => clearInterval(t)
  }, [])

  const shown = list.filter((t) => t.status === 'pending' || Date.now() - t.at < SHOW_MS).slice(0, 4)
  if (!shown.length) return null
  return (
    <div className="txfeed" aria-live="polite">
      {shown.map((t) => (
        <div key={t.id} className={`txfeed-item is-${t.status}`}>
          <span className="txfeed-dot" aria-hidden />
          <div className="txfeed-body">
            <div className="txfeed-label">{t.label}</div>
            <div className="txfeed-meta">
              {t.status === 'pending' ? 'Waiting for Monad…' : t.status === 'confirmed' ? 'Confirmed on Monad testnet' : 'Failed'}
              {' · '}
              <a href={txUrl(t.hash)} target="_blank" rel="noreferrer">
                View on Monadscan ↗
              </a>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

/** "0.84 MON" for the header. */
export const fmtMon = (v: bigint) => `${fmtChips(v)} MON`
