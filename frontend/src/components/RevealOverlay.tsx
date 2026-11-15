import { useEffect } from 'react'
import type { RoundRecord } from '../hooks/useCasino'
import { GAMES, LANE_COLORS } from '../lib/games'
import { fmtChips } from '../lib/format'
import { Burst } from './Burst'

/**
 * Effect size follows the real net result for the round:
 * - net > 0: burst and shake, bigger for bigger multiples
 * - net <= 0: plain result, no fanfare, even if one bet in the round won
 */
export function revealIntensity(r: RoundRecord): number {
  if (r.net <= 0n || r.staked === 0n) return 0
  const ratio = Number((r.paid * 1000n) / r.staked) / 1000
  return Math.max(0.2, Math.min(1, Math.log2(ratio) / Math.log2(10)))
}

export function RevealOverlay({ record, onClose }: { record: RoundRecord; onClose: () => void }) {
  const intensity = revealIntensity(record)
  const up = intensity > 0

  useEffect(() => {
    const t = setTimeout(onClose, up ? 5200 : 3200)
    return () => clearTimeout(t)
  }, [record, up, onClose])

  return (
    <div className={`reveal ${up ? 'reveal-up' : 'reveal-down'}`} onClick={onClose} role="dialog" aria-live="polite">
      {up && <Burst intensity={intensity} />}
      <div className="reveal-card" style={{ '--intensity': intensity } as React.CSSProperties}>
        <div className="reveal-round">ROUND {record.roundId.toString()} SETTLED</div>
        <div className="reveal-results">
          {record.bets.map((b) => {
            const g = GAMES[b.gameId]
            return (
              <div key={b.index} className="reveal-row">
                <div className="reveal-game">{g.name}</div>
                <div
                  className="reveal-raw"
                  style={g.id === 2 ? { color: LANE_COLORS[b.outcome] } : undefined}
                >
                  {g.id === 2 ? g.labels[b.outcome] : b.raw}
                </div>
                <div className="reveal-pick">
                  You picked {g.labels[b.choice]} · {b.won ? `paid ${fmtChips(b.payout)}` : 'no payout'}
                </div>
              </div>
            )
          })}
        </div>
        <div className={`reveal-net ${up ? 'pos' : record.net < 0n ? 'neg' : ''}`}>
          {fmtChips(record.net, { sign: true })} CHIP
        </div>
        <div className="reveal-seed">seed {record.seed.slice(0, 18)}…</div>
      </div>
    </div>
  )
}
