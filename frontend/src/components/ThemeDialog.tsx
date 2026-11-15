import { useEffect, useState } from 'react'
import { toChips } from '../lib/format'
import {
  ACCENTS,
  BASES,
  LOSS_EFFECTS,
  PRESETS,
  WIN_EFFECTS,
  presetOf,
  type Option,
  type ThemeSettings,
} from '../lib/themes'
import { Burst } from './Burst'
import { BurningWallet, BURN_MS } from './BurningWallet'
import { MonadTokens } from './MonadTokens'

type Tab = 'presets' | 'colors' | 'effects'

interface Props {
  settings: ThemeSettings
  wallet: string | null
  onChange: (patch: Partial<ThemeSettings>) => void
  onPreset: (id: string) => void
  onClose: () => void
}

/** Theme panel. Every change applies live, so the page behind it is the preview. */
export function ThemeDialog({ settings, wallet, onChange, onPreset, onClose }: Props) {
  const [tab, setTab] = useState<Tab>('presets')
  // Previews are clearly labeled and only run from this panel, never during play.
  const [preview, setPreview] = useState<{ kind: 'win' | 'loss'; n: number } | null>(null)
  const active = presetOf(settings)

  useEffect(() => {
    if (!preview) return
    const t = setTimeout(() => setPreview(null), preview.kind === 'loss' ? BURN_MS + 800 : 3200)
    return () => clearTimeout(t)
  }, [preview])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal theme-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="theme-title">
        <div className="theme-modal-head">
          <h3 id="theme-title">Theme</h3>
          <span className="muted small">{active ? `Preset: ${active.name}` : 'Custom'}</span>
        </div>

        <div className="seg" role="tablist" aria-label="Theme settings">
          {(['presets', 'colors', 'effects'] as Tab[]).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              className={`seg-opt ${tab === t ? 'on' : ''}`}
              onClick={() => setTab(t)}
            >
              {t[0].toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {tab === 'presets' && (
          <div className="opt-list" role="radiogroup" aria-label="Presets">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                role="radio"
                aria-checked={active?.id === p.id}
                className={`opt-card ${active?.id === p.id ? 'on' : ''}`}
                onClick={() => onPreset(p.id)}
              >
                <span className={`preset-chip base-${p.settings.base}`} aria-hidden>
                  <i />
                </span>
                <span className="opt-text">
                  <strong>{p.name}</strong>
                  <span className="muted small">{p.describe}</span>
                </span>
              </button>
            ))}
          </div>
        )}

        {tab === 'colors' && (
          <>
            <div className="field-label">Base palette</div>
            <Choices options={BASES} value={settings.base} onPick={(base) => onChange({ base })} swatch={(b) => `base-${b}`} />
            <div className="field-label">Accent</div>
            <div className="accent-row" role="radiogroup" aria-label="Accent color">
              <button
                role="radio"
                aria-checked={settings.accent === null}
                className={`accent auto ${settings.accent === null ? 'on' : ''}`}
                onClick={() => onChange({ accent: null })}
              >
                Palette default
              </button>
              {ACCENTS.map((a) => (
                <button
                  key={a.id}
                  role="radio"
                  aria-checked={settings.accent === a.id}
                  aria-label={a.name}
                  title={a.name}
                  className={`accent ${settings.accent === a.id ? 'on' : ''}`}
                  style={{ '--a': a.id } as React.CSSProperties}
                  onClick={() => onChange({ accent: a.id })}
                />
              ))}
            </div>
            <div className="accent-sample">
              <button className="btn primary small" tabIndex={-1}>
                Place bet
              </button>
              <span className="badge badge-primary">Betting open</span>
            </div>
          </>
        )}

        {tab === 'effects' && (
          <>
            <div className="field-label">
              When you win a round
              <button className="btn small" onClick={() => setPreview({ kind: 'win', n: Date.now() })} disabled={settings.win === 'off'}>
                Preview
              </button>
            </div>
            <Choices options={WIN_EFFECTS} value={settings.win} onPick={(win) => onChange({ win })} />
            <div className="field-label">
              When you lose a round
              <button className="btn small" onClick={() => setPreview({ kind: 'loss', n: Date.now() })} disabled={settings.loss === 'off'}>
                Preview
              </button>
            </div>
            <Choices options={LOSS_EFFECTS} value={settings.loss} onPick={(loss) => onChange({ loss })} />
            <p className="note">
              Effects only play on a real net result for the round, and they scale with its size. A round you win one bet in
              but lose overall gets no win effect.
            </p>
            {preview?.kind === 'loss' && (
              <div className="preview-box">
                <span className="preview-tag">Preview</span>
                <BurningWallet key={preview.n} wallet={wallet} lost={toChips('10')} intensity={1} />
              </div>
            )}
          </>
        )}

        <div className="row">
          <button className="btn ghost" onClick={() => onPreset(PRESETS[0].id)}>
            Reset
          </button>
          <button className="btn primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
      {preview?.kind === 'win' &&
        (settings.win === 'monad-tokens' ? (
          <MonadTokens key={preview.n} intensity={0.6} />
        ) : (
          <Burst key={preview.n} intensity={0.6} />
        ))}
    </div>
  )
}

function Choices<T extends string>({
  options,
  value,
  onPick,
  swatch,
}: {
  options: Option<T>[]
  value: T
  onPick: (v: T) => void
  swatch?: (v: T) => string
}) {
  return (
    <div className="opt-grid" role="radiogroup">
      {options.map((o) => (
        <button
          key={o.id}
          role="radio"
          aria-checked={value === o.id}
          className={`opt-card ${value === o.id ? 'on' : ''}`}
          onClick={() => onPick(o.id)}
        >
          {swatch && (
            <span className={`preset-chip ${swatch(o.id)}`} aria-hidden>
              <i />
            </span>
          )}
          <span className="opt-text">
            <strong>{o.name}</strong>
            <span className="muted small">{o.describe}</span>
          </span>
        </button>
      ))}
    </div>
  )
}
