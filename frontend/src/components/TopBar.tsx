import type { Address } from 'viem'
import { fmtBlock, fmtChips, shortHash } from '../lib/format'
import { BrandMark } from './icons'

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
        <BrandMark />
        Block Casino
      </div>
      <span className={`badge ${mode === 'sim' ? 'badge-warn' : 'badge-pos'}`}>
        <span className="dot" /> {label === 'SIMULATOR' ? 'Simulator' : label}
      </span>
      <div className="head-readout">
        Block <span className="mono">{head === null ? '—' : `#${fmtBlock(head)}`}</span>
      </div>
      <div className="spacer" />
      {account ? (
        <>
          <div className="balance">
            <span className="muted">Balance</span> <strong>{fmtChips(balance)}</strong> <span className="muted">CHIP</span>
          </div>
          <button className="btn" onClick={onFaucet} disabled={!!busy}>
            Get chips
          </button>
          <div className="account mono">{shortHash(account)}</div>
        </>
      ) : (
        <button className="btn primary" onClick={onConnect} disabled={!!busy}>
          {mode === 'sim' ? 'Start session' : 'Connect wallet'}
        </button>
      )}
    </header>
  )
}
