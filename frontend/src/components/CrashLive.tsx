import { CRASH_MANUAL, CRASH_TARGETS_X100, fmtX } from '../lib/crash'
import { fmtChips } from '../lib/format'
import { MAX_CLIMB_MS, multAt } from '../lib/liveCrash'
import type { LiveCrash } from '../hooks/useCasino'

// The live Crash climb, in the game page (not a popup). The multiplier climbs after betting
// locks; the big button cashes out every bet still riding at the multiplier on screen. The
// crash point doesn't exist until it happens (lib/liveCrash.ts), so nothing here can leak it.
// Re-renders on every engine tick (useCasino's liveTick), about every 40 ms.

const W = 560
const H = 180

export function CrashLive({ live, onCashOut }: { live: LiveCrash; onCashOut: () => void }) {
  const s = live.state
  const crashed = s.crashedX100 !== null
  const m = crashed ? (s.crashedX100 as number) / 100 : s.m
  const elapsed = Math.min(MAX_CLIMB_MS, performance.now() - s.startedAt)

  const riding = live.bets.filter((b) => !s.cashouts.has(b.index))
  const nowPays = riding.reduce((sum, b) => sum + (b.amount * BigInt(Math.round(m * 100))) / 100n, 0n)
  const canCash = !crashed && riding.length > 0

  // Curve: time across, log multiplier up. Axes grow with the climb only, never with the
  // (unknown) crash point.
  const span = Math.max(5000, elapsed)
  const top = Math.max(2, m) * 1.15
  const x = (t: number) => (t / span) * W
  const y = (v: number) => H - (Math.log(v) / Math.log(top)) * (H - 10)
  const pts: string[] = []
  for (let i = 0; i <= 60; i++) {
    const t = (elapsed * i) / 60
    pts.push(`${x(t).toFixed(1)},${y(Math.min(multAt(t), m)).toFixed(1)}`)
  }

  return (
    <section className={`card crash-live ${crashed ? 'is-crashed' : ''}`} aria-live="off">
      <header className="card-head">
        <span className={`badge ${crashed ? 'badge-neg' : 'badge-pos'}`}>
          <span className="dot" /> {crashed ? 'Crashed' : 'Live'}
        </span>
        <h3>Crash · Round {live.roundId.toString()}</h3>
        <div className="card-actions muted small">Drawn live: nobody knows the crash point until it happens.</div>
      </header>
      <div className="card-body crash-live-body">
        <div className="crash-live-left">
          <div className="crash-live-mult">{fmtX(Math.round(m * 100))}</div>
          <div className="crash-live-status">{crashed ? `Crashed at ${fmtX(s.crashedX100 as number)}` : 'Climbing'}</div>
          <button className="btn primary crash-cashout" disabled={!canCash} onClick={onCashOut}>
            {canCash ? (
              <>
                Cash out <span className="crash-cashout-amt">+{fmtChips(nowPays)} CHIP</span>
              </>
            ) : crashed ? (
              'Crashed'
            ) : (
              'All cashed out'
            )}
          </button>
          <ul className="crash-live-bets">
            {live.bets.map((b) => {
              const at = s.cashouts.get(b.index)
              const target = b.choice === CRASH_MANUAL ? null : CRASH_TARGETS_X100[b.choice]
              return (
                <li key={b.index}>
                  <span>{fmtChips(b.amount)} CHIP</span>
                  <span className="muted">{target ? `auto ${fmtX(target)}` : 'manual'}</span>
                  <span className={at !== undefined ? 'pos' : crashed ? 'neg' : ''}>
                    {at !== undefined
                      ? `cashed ${fmtX(at)} · +${fmtChips((b.amount * BigInt(at)) / 100n)}`
                      : crashed
                        ? 'lost'
                        : 'riding'}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
        <svg className="crash-live-chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden>
          {CRASH_TARGETS_X100.filter((t) => t / 100 < top).map((t) => (
            <g key={t} className="crash-live-grid">
              <line x1={0} x2={W} y1={y(t / 100)} y2={y(t / 100)} />
              <text x={4} y={y(t / 100) - 3}>
                {fmtX(t)}
              </text>
            </g>
          ))}
          {elapsed > 0 && <polyline className="crash-line" points={pts.join(' ')} />}
        </svg>
      </div>
    </section>
  )
}
