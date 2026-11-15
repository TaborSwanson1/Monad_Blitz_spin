import type { Address } from 'viem'
import type { WalletApi } from '../../hooks/useWallet'
import { fmtBlock, fmtChips } from '../../lib/format'
import { BrandMark } from '../icons'
import { WalletButton } from './WalletButton'
import { useCountUp } from '../../effects/useCountUp'
import { addChipToWallet, fmtMon } from '../WalletActivity'
import { addressUrl } from '../../client/txlog'

interface Props {
  mode: 'sim' | 'chain'
  label: string
  head: bigint | null
  view: 'lobby' | 'game'
  onHome: () => void
  /** The casino client's account: a sim session, or the chain client's wallet. */
  account: Address | null
  balance: bigint
  /** Session net result. Shown next to the balance (CLAUDE.md honest UI). */
  net: bigint
  busy: string | null
  onStart: () => void
  onGetChips: () => void
  onSettings: () => void
  wallet: WalletApi
  /** Chain mode: the wallet's MON (testnet gas money). Null in sim mode or before it loads. */
  gas?: bigint | null
}

/**
 * Global top bar on every screen, laid out like big casino sites: brand on the left,
 * balance with its add-funds button in the middle, wallet and settings on the right.
 * The add-funds button is the free play-chip faucet. There are no deposits (CLAUDE.md).
 * Owner: Zander.
 */
export function SiteHeader(p: Props) {
  const chainNeedsWallet = p.mode === 'chain' && !p.account
  // Balance counts up or down to its new value (green up, red down) instead of jumping.
  const tick = useCountUp(p.balance)

  return (
    <header className="topbar site-header">
      <button className="brand brand-btn" onClick={p.onHome} aria-label="Back to lobby">
        <BrandMark />
        STIM and SPIN
      </button>
      {p.view === 'game' && (
        <button className="btn ghost small" onClick={p.onHome}>
          ← Lobby
        </button>
      )}
      <span className={`badge ${p.mode === 'sim' ? 'badge-warn' : 'badge-pos'}`}>
        <span className="dot" /> {p.label === 'SIMULATOR' ? 'Simulator' : p.label}
      </span>
      <div className="head-readout hide-narrow">
        Block <span className="mono">{p.head === null ? '—' : `#${fmtBlock(p.head)}`}</span>
      </div>

      <div className="spacer" />

      <div className="purse" aria-label="Chips">
        {p.account ? (
          <>
            <div className="purse-balance">
              <span className="purse-chip" aria-hidden>◎</span>
              <strong className={`mono balance-num ${tick.dir ? `tick-${tick.dir}` : ''}`}>{fmtChips(tick.shown)}</strong>
              <span className="muted small">CHIP</span>
              <span className={`purse-net small ${p.net > 0n ? 'pos' : p.net < 0n ? 'neg' : 'muted'}`} title="Session net result">
                {fmtChips(p.net, { sign: true })}
              </span>
            </div>
            <button
              className="btn primary purse-add"
              onClick={p.onGetChips}
              disabled={!!p.busy}
              title={
                p.mode === 'chain'
                  ? 'Free: your wallet signs a faucet transaction and 1,000 CHIP are minted to it. You pay only gas. Once a day.'
                  : 'Free play chips. No real value.'
              }
            >
              {p.mode === 'chain' ? '+ Claim to wallet' : '+ Get chips'}
            </button>
          </>
        ) : p.mode === 'sim' ? (
          <button className="btn primary purse-add" onClick={p.onStart} disabled={!!p.busy}>
            Start playing: 1,000 free chips
          </button>
        ) : (
          <span className="muted small purse-hint">{chainNeedsWallet ? 'Connect a wallet to get free chips' : ''}</span>
        )}
      </div>

      {p.mode === 'chain' && p.account && (
        <div className="walletstrip hide-narrow">
          <a className="walletstrip-gas" href={addressUrl(p.account)} target="_blank" rel="noreferrer" title="Your wallet on Monadscan. MON pays gas and the Pyth fee.">
            <span className="muted small">Gas</span> <strong className="mono">{p.gas == null ? '…' : fmtMon(p.gas)}</strong>
          </a>
          <button className="btn small" onClick={() => void addChipToWallet()} title="Show your CHIP balance inside MetaMask">
            Add CHIP to MetaMask
          </button>
        </div>
      )}

      <WalletButton w={p.wallet} />

      <button className="btn icon-btn" onClick={p.onSettings} aria-label="Settings" title="Settings">
        <Gear />
      </button>
    </header>
  )
}

const Gear = () => (
  <svg className="icon" width="17" height="17" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
  </svg>
)
