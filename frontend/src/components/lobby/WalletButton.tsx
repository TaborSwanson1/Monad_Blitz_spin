import { useEffect, useRef, useState, type ReactElement } from 'react'
import { MON_FAUCET_URL } from '@block-casino/wallet'
import type { WalletApi } from '../../hooks/useWallet'
import { NETWORK_NAMES, hasContracts } from '../../wallet/session'
import { fmtChips, shortHash } from '../../lib/format'

/** Connect button, wallet picker and account menu. Owner: Zander. Talks to backend/wallet through useWallet. */
export function WalletButton({ w }: { w: WalletApi }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { state } = w
  const network = NETWORK_NAMES[state.targetChainId] ?? `Chain ${state.targetChainId}`

  // Close the menu on an outside click or Escape.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  useEffect(() => {
    if (state.status !== 'connected') setOpen(false)
  }, [state.status])

  const copy = async () => {
    if (!state.address) return
    try {
      await navigator.clipboard.writeText(state.address)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {
      /* clipboard blocked: nothing to do */
    }
  }

  let button: ReactElement
  if (state.status === 'connecting') {
    button = (
      <button className="btn wb-btn" disabled>
        <WalletGlyph /> Connecting…
      </button>
    )
  } else if (state.status === 'wrong-network') {
    button = (
      <button className="btn wb-btn wb-warn" onClick={w.switchNetwork}>
        <WalletGlyph /> Switch to {network}
      </button>
    )
  } else if (state.status === 'connected' && state.address) {
    button = (
      <button className="btn wb-btn wb-on" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {state.wallet?.icon ? <img className="wb-icon" src={state.wallet.icon} alt="" /> : <WalletGlyph />}
        <span className="mono">{shortHash(state.address)}</span>
        <Caret />
      </button>
    )
  } else {
    button = (
      <button className="btn primary wb-btn" onClick={w.connect} disabled={!w.available}>
        <WalletGlyph /> Connect wallet
      </button>
    )
  }

  return (
    <div className="wb" ref={ref}>
      {button}

      {open && state.address && (
        <div className="wb-menu" role="menu">
          <div className="wb-menu-head">
            <span className="muted small">Connected with {state.wallet?.name ?? 'your wallet'}</span>
            <button className="wb-addr mono" onClick={copy} title="Copy address">
              {shortHash(state.address)} <span className="muted small">{copied ? 'copied' : 'copy'}</span>
            </button>
          </div>
          <div className="wb-row">
            <span className="muted">Network</span>
            <span>
              <span className="dot wb-dot" /> {network}
            </span>
          </div>
          {w.mon !== null && (
            <div className="wb-row">
              <span className="muted">Gas balance</span>
              <span className="mono">{fmtChips(w.mon)} MON</span>
            </div>
          )}
          {!hasContracts && (
            <p className="wb-note">
              The casino isn't deployed on {network} yet, so games use simulator chips for now. Your wallet is connected and
              ready for when it is.
            </p>
          )}
          <a className="wb-link" href={MON_FAUCET_URL} target="_blank" rel="noreferrer" role="menuitem">
            Get free testnet MON for gas ↗
          </a>
          <button className="wb-link wb-danger" role="menuitem" onClick={w.disconnect}>
            Disconnect
          </button>
        </div>
      )}

      {w.error && (
        <div className="wb-error" role="alert" onClick={w.clearError}>
          {w.error}
        </div>
      )}

      {w.picker && <WalletPicker w={w} />}
    </div>
  )
}

function WalletPicker({ w }: { w: WalletApi }) {
  const list = w.picker ?? []
  return (
    <div className="modal-bg" onClick={w.closePicker}>
      <div className="modal wb-picker" role="dialog" aria-labelledby="wb-pick-title" onClick={(e) => e.stopPropagation()}>
        <h3 id="wb-pick-title">Connect a wallet</h3>
        <p className="muted small">Pick the wallet to use. It will ask to switch to Monad Testnet.</p>
        {list.length === 0 ? (
          <p className="muted">No wallet found in this browser. Install one, like MetaMask or Rabby, and reload.</p>
        ) : (
          <div className="wb-list">
            {list.map((d) => (
              <button key={d.info.rdns} className="wb-choice" onClick={() => w.choose(d)}>
                {d.info.icon ? <img src={d.info.icon} alt="" /> : <WalletGlyph />}
                <span>{d.info.name}</span>
              </button>
            ))}
          </div>
        )}
        <button className="btn ghost wide" onClick={w.closePicker}>
          Cancel
        </button>
      </div>
    </div>
  )
}

const WalletGlyph = () => (
  <svg className="icon" width="16" height="16" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.8">
    <rect x="3" y="6" width="18" height="13" rx="3" />
    <path d="M3 9h13a2 2 0 0 0 0-4H6" />
    <circle cx="16.5" cy="12.5" r="1.2" fill="currentColor" stroke="none" />
  </svg>
)

const Caret = () => (
  <svg className="icon" width="12" height="12" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="2">
    <path d="m6 9 6 6 6-6" />
  </svg>
)
