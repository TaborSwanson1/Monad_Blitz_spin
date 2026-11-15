import type { Address } from 'viem'
import { fmtBlock, fmtChips, shortHash } from '../lib/format'

interface Props {
  label: string
  mode: 'sim' | 'chain'
  head: bigint | null
  account: Address | null
  balance: bigint
  busy: string | null
  onConnect: () => void
  onFaucet: () => void
}

export function TopBar({ label, mode, head, account, balance, busy, onConnect, onFaucet }: Props) {
  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-mark">▣</span> BLOCK<span className="brand-slash">//</span>CASINO
      </div>
      <div className={`net-badge net-${mode}`}>
        <span className="dot" /> {label}
      </div>
      <div className="head-readout">
        HEAD <strong>{head === null ? '—' : `#${fmtBlock(head)}`}</strong>
      </div>
      <div className="spacer" />
      {account ? (
        <>
          <div className="balance">
            <span className="muted">BAL</span> <strong>{fmtChips(balance)}</strong> CHIP
          </div>
          <button className="btn ghost" onClick={onFaucet} disabled={!!busy}>
            Faucet
          </button>
          <div className="account">{shortHash(account)}</div>
        </>
      ) : (
        <button className="btn primary" onClick={onConnect} disabled={!!busy}>
          {mode === 'sim' ? 'Start session' : 'Connect wallet'}
        </button>
      )}
    </header>
  )
}
