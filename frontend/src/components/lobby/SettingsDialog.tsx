import { PRESETS } from '../../lib/themes'
import type { WalletApi } from '../../hooks/useWallet'
import { NETWORK_NAMES, hasContracts } from '../../wallet/session'
import { shortHash } from '../../lib/format'

interface Props {
  mode: 'sim' | 'chain'
  presetId: string | null
  onPreset: (id: string) => void
  onCustomize: () => void
  onLimits: () => void
  wallet: WalletApi
  onClose: () => void
}

/**
 * Settings, reached from the gear in the top bar. It gathers what already exists
 * (Tabor's theme panel, the session limits) plus the wallet. Owner: Zander.
 */
export function SettingsDialog({ mode, presetId, onPreset, onCustomize, onLimits, wallet, onClose }: Props) {
  const { state } = wallet
  const network = NETWORK_NAMES[state.targetChainId] ?? `Chain ${state.targetChainId}`

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal settings" role="dialog" aria-labelledby="settings-title" onClick={(e) => e.stopPropagation()}>
        <div className="settings-head">
          <h3 id="settings-title">Settings</h3>
          <button className="btn ghost small" onClick={onClose} aria-label="Close settings">
            ✕
          </button>
        </div>

        <section className="settings-sec">
          <div className="settings-title">Appearance</div>
          <div className="theme-picker" role="radiogroup" aria-label="Theme preset">
            {PRESETS.map((t) => (
              <button
                key={t.id}
                role="radio"
                aria-checked={t.id === presetId}
                className={`theme-opt ${t.id === presetId ? 'on' : ''}`}
                onClick={() => onPreset(t.id)}
                title={t.describe}
              >
                <span className={`swatch swatch-${t.settings.base}`} aria-hidden />
                {t.name}
              </button>
            ))}
          </div>
          <button className="btn wide settings-btn" onClick={onCustomize}>
            Customize colors and effects…
          </button>
        </section>

        <section className="settings-sec">
          <div className="settings-title">Responsible play</div>
          <p className="muted small">Time and loss limits, and how often you get a check-in with your net result.</p>
          <button className="btn wide settings-btn" onClick={onLimits}>
            Limits and check-ins…
          </button>
        </section>

        <section className="settings-sec">
          <div className="settings-title">Wallet</div>
          {state.status === 'connected' && state.address ? (
            <div className="settings-row">
              <span>
                {state.wallet?.name ?? 'Wallet'} <span className="mono muted">{shortHash(state.address)}</span>
                <br />
                <span className="muted small">{network}</span>
              </span>
              <button className="btn small" onClick={wallet.disconnect}>
                Disconnect
              </button>
            </div>
          ) : (
            <div className="settings-row">
              <span className="muted">Not connected</span>
              <button className="btn primary small" onClick={wallet.connect} disabled={!wallet.available}>
                Connect wallet
              </button>
            </div>
          )}
        </section>

        <section className="settings-sec">
          <div className="settings-title">Play mode</div>
          <p className="muted small">
            {mode === 'sim'
              ? 'Simulator: chips and results live in this browser. Blocks come from Monad testnet for the clock only.'
              : `${network}: bets and results are on-chain. Results come from Pyth Entropy, never from block data.`}
            {!hasContracts && mode === 'sim' && ' Wallet play turns on once the contracts are deployed.'}
          </p>
          <p className="muted small">Play chips only, with no real value. Every game has a 2% house edge or fee.</p>
        </section>
      </div>
    </div>
  )
}
