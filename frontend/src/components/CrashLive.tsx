import { CRASH_MANUAL, CRASH_TARGETS_X100, fmtX } from '../lib/crash'
import { fmtChips } from '../lib/format'
import { MAX_CLIMB_MS, multAt } from '../lib/liveCrash'
import type { ChainCrash, LiveCrash } from '../hooks/useCasino'
import { blockMultX100 } from '../lib/crashChain'
import { RocketMarker } from './Rocket'
import { CrashScene, zoneOf } from './CrashScene'

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
        <div className="crash-live-stage">
        {/* Ground below 5x, atmosphere to 20x, space above. Follows the multiplier on screen. */}
        <CrashScene mult={m} crashed={crashed} />
        <div className="crash-zone">{zoneOf(m)}</div>
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
        {!crashed && (
          <RocketMarker
            head={[x(elapsed), y(m)]}
            back={[x(Math.max(0, elapsed - 150)), y(Math.min(multAt(Math.max(0, elapsed - 150)), m))]}
            view={[W, H]}
            size={0.9}
          />
        )}
        </div>
      </div>
    </section>
  )
}

/**
 * On-chain Crash, blind window: the multiplier steps up once per block after lock, and the
 * crash point doesn't exist yet. It's drawn from the round seed after the window closes, so this
 * panel can only show where the climb is, never whether it has crashed.
 */
export function ChainCrashLive({
  live,
  busy,
  onCashOut,
}: {
  live: ChainCrash
  busy: boolean
  onCashOut: () => void
}) {
  const m = blockMultX100(live.k)
  const riding = live.bets.filter((b) => !live.cashouts.has(b.index))
  const nowPays = riding.reduce((sum, b) => sum + (b.amount * BigInt(m)) / 100n, 0n)
  const canCash = live.open && live.k >= 1 && riding.length > 0 && !busy
  const left = live.climbBlocks - live.k

  // One bar per block of the window, filled up to the head block.
  const steps = Array.from({ length: live.climbBlocks }, (_, i) => i + 1)
  const top = blockMultX100(live.climbBlocks)
  const y = (x100: number) => H - (Math.log(x100 / 100) / Math.log(top / 100)) * (H - 14)

  return (
    <section className="card crash-live" aria-live="off">
      <header className="card-head">
        <span className={`badge ${live.open ? 'badge-pos' : 'badge-neg'}`}>
          <span className="dot" /> {live.open ? 'Climbing' : 'Window closed'}
        </span>
        <h3>Crash · Round {live.roundId.toString()}</h3>
        <div className="card-actions muted small">The crash point is drawn after the window closes.</div>
      </header>
      <div className="card-body crash-live-body">
        <div className="crash-live-left">
          <div className="crash-live-mult">{fmtX(m)}</div>
          <div className="crash-live-status">
            {live.open ? `Block ${live.k} of ${live.climbBlocks} · ${left} left` : 'Waiting for the result'}
          </div>
          <button className="btn primary crash-cashout" disabled={!canCash} onClick={onCashOut}>
            {busy ? (
              'Sending…'
            ) : canCash ? (
              <>
                Cash out <span className="crash-cashout-amt">≈ +{fmtChips(nowPays)} CHIP</span>
              </>
            ) : riding.length === 0 ? (
              'All cashed out'
            ) : live.k < 1 ? (
              'Starts next block'
            ) : (
              'Riding to the end'
            )}
          </button>
          <ul className="crash-live-bets">
            {live.bets.map((b) => {
              const k = live.cashouts.get(b.index)
              const target = b.choice === CRASH_MANUAL ? null : CRASH_TARGETS_X100[b.choice]
              return (
                <li key={b.index}>
                  <span>{fmtChips(b.amount)} CHIP</span>
                  <span className="muted">{target ? `auto ${fmtX(target)}` : 'manual'}</span>
                  <span className={k !== undefined ? 'pos' : ''}>
                    {k !== undefined ? `cash-out at ${fmtX(blockMultX100(k))} (block ${k})` : 'riding'}
                  </span>
                </li>
              )
            })}
          </ul>
          <p className="note">
            Your cash-out counts at the block it lands in, which can be a block after your click. Whether it
            wins depends on the crash point, shown when the round settles.
          </p>
        </div>
        <div className="crash-live-stage">
          <CrashScene mult={m / 100} crashed={false} />
          <div className="crash-zone">{zoneOf(m / 100)}</div>
          <svg className="crash-live-chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden>
            {CRASH_TARGETS_X100.filter((t) => t < top).map((t) => (
              <g key={t} className="crash-live-grid">
                <line x1={0} x2={W} y1={y(t)} y2={y(t)} />
                <text x={4} y={y(t) - 3}>
                  {fmtX(t)}
                </text>
              </g>
            ))}
            {live.k > 0 && (
              <polyline
                className="crash-line"
                points={[0, ...steps.filter((k) => k <= live.k)]
                  .map((k) => `${((k / live.climbBlocks) * W).toFixed(1)},${y(blockMultX100(k)).toFixed(1)}`)
                  .join(' ')}
              />
            )}
          </svg>
          {live.open && live.k > 0 && (
            <RocketMarker
              head={[(live.k / live.climbBlocks) * W, y(blockMultX100(live.k))]}
              back={[((live.k - 1) / live.climbBlocks) * W, y(blockMultX100(live.k - 1))]}
              view={[W, H]}
              size={0.9}
            />
          )}
        </div>
      </div>
    </section>
  )
}
