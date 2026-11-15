import { useCallback, useEffect, useState } from 'react'
import type { RoundRecord } from '../hooks/useCasino'
import { CRASH_TARGETS_X100, fmtX } from '../lib/crash'
import { GAMES, LANE_COLORS } from '../lib/games'
import { fmtChips } from '../lib/format'
import { BeautyResult } from './BeautyResult'
import { Burst } from './Burst'
import { CrashClimb } from './CrashClimb'

/**
 * Effect size follows the real net result for the round:
 * - net > 0: a short burst, bigger for bigger multiples
 * - net <= 0: plain result, no fanfare, even if one bet in the round won
 */
export function revealIntensity(r: RoundRecord): number {
  if (r.net <= 0n || r.staked === 0n) return 0
  const ratio = Number((r.paid * 1000n) / r.staked) / 1000
  return Math.max(0.2, Math.min(1, Math.log2(ratio) / Math.log2(10)))
}

const crashBetsOf = (r: RoundRecord) => r.bets.filter((b) => GAMES[b.gameId].kind === 'crash')

interface Props {
  record: RoundRecord
  onClose: () => void
  /** Called once a crash replay ends, so the rest of the page can show the result. */
  onReplayDone: () => void
}

export function RevealOverlay({ record, onClose, onReplayDone }: Props) {
  const crashBets = crashBetsOf(record)
  const [climbDone, setClimbDone] = useState(crashBets.length === 0)
  const markDone = useCallback(() => {
    setClimbDone(true)
    onReplayDone()
  }, [onReplayDone])

  // Nothing hints at the result until the replay finishes.
  const intensity = climbDone ? revealIntensity(record) : 0
  const up = intensity > 0

  useEffect(() => {
    if (!climbDone) return
    const t = setTimeout(onClose, up ? 5200 : 3200)
    return () => clearTimeout(t)
  }, [record, up, onClose, climbDone])

  const crashTargets = [...new Set(crashBets.map((b) => CRASH_TARGETS_X100[b.choice]))]

  return (
    <div
      className={`reveal ${up ? 'reveal-up' : 'reveal-down'}`}
      onClick={climbDone ? onClose : undefined}
      role="dialog"
      aria-live="polite"
    >
      {up && <Burst intensity={intensity} />}
      <div className="reveal-card" style={{ '--intensity': intensity } as React.CSSProperties}>
        <div className="reveal-round">Round {record.roundId.toString()} settled</div>

        {crashBets.length > 0 && <CrashClimb crashX100={crashBets[0].raw} targetsX100={crashTargets} onDone={markDone} />}

        {climbDone && (
          <>
            <div className="reveal-results">
              {record.bets.map((b) => {
                const g = GAMES[b.gameId]
                if (g.kind === 'beauty') {
                  return (
                    <div key={b.index} className="reveal-row reveal-row-wide">
                      <div className="reveal-game">{g.name}</div>
                      <BeautyResult roundSeed={record.seed} yourGuess={b.choice} />
                      <div className="reveal-pick">
                        Your guess {b.choice} · {b.won ? `paid ${fmtChips(b.payout)}` : 'no payout'}
                      </div>
                    </div>
                  )
                }
                const shown = g.kind === 'crash' ? fmtX(b.raw) : g.id === 2 ? g.labels[b.outcome] : b.raw
                return (
                  <div key={b.index} className="reveal-row">
                    <div className="reveal-game">{g.name}</div>
                    <div
                      className={`reveal-raw ${g.kind === 'crash' ? 'reveal-raw-sm' : ''}`}
                      style={g.id === 2 ? { color: LANE_COLORS[b.outcome] } : undefined}
                    >
                      {shown}
                    </div>
                    <div className="reveal-pick">
                      {g.kind === 'crash' ? 'Your target' : 'You picked'} {g.labels[b.choice]} ·{' '}
                      {b.won ? `paid ${fmtChips(b.payout)}` : 'no payout'}
                    </div>
                  </div>
                )
              })}
            </div>
            <div className={`reveal-net ${up ? 'pos' : record.net < 0n ? 'neg' : ''}`}>
              {fmtChips(record.net, { sign: true })} CHIP
            </div>
          </>
        )}
        <div className="reveal-seed">seed {record.seed.slice(0, 18)}…</div>
      </div>
    </div>
  )
}
