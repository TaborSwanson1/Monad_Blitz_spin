import { useState } from 'react'
import { fmtChips, fmtDuration } from '../lib/format'
import type { Limits } from '../hooks/useSession'

export function RealityCheck({ elapsedMs, net, rounds, onContinue }: { elapsedMs: number; net: bigint; rounds: number; onContinue: () => void }) {
  return (
    <div className="modal-bg">
      <div className="modal" role="alertdialog" aria-labelledby="rc-title">
        <h3 id="rc-title">Reality check</h3>
        <p>
          You've played for <strong>{fmtDuration(elapsedMs)}</strong> over <strong>{rounds}</strong> rounds.
        </p>
        <p>
          Your net result is{' '}
          <strong className={net > 0n ? 'pos' : net < 0n ? 'neg' : ''}>{fmtChips(net, { sign: true })} CHIP</strong>.
        </p>
        <p className="muted">These are play chips with no real value. The house edge is 2% on every bet.</p>
        <button className="btn primary wide" onClick={onContinue}>
          Got it
        </button>
      </div>
    </div>
  )
}

export function LimitsDialog({ limits, onSave, onClose }: { limits: Limits; onSave: (l: Limits) => void; onClose: () => void }) {
  const [draft, setDraft] = useState(limits)
  const field = (k: keyof Limits, label: string, unit: string) => (
    <label className="field">
      <span>{label}</span>
      <input
        type="number"
        min={0}
        value={draft[k]}
        onChange={(e) => setDraft({ ...draft, [k]: Math.max(0, Number(e.target.value) || 0) })}
      />
      <span className="muted">{unit}</span>
    </label>
  )
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-labelledby="lim-title">
        <h3 id="lim-title">Session limits</h3>
        <p className="muted">Set any of these to 0 to turn it off.</p>
        {field('timeMin', 'Session time', 'minutes')}
        {field('lossChips', 'Loss limit', 'CHIP')}
        {field('checkEveryMin', 'Reality check every', 'minutes')}
        <div className="row">
          <button className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn primary"
            onClick={() => {
              onSave(draft)
              onClose()
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
