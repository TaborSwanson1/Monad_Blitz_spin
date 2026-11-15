import { useCallback, useEffect, useState } from 'react'
import type { RoundRecord } from '../hooks/useCasino'
import { CRASH_TARGETS_X100, fmtX } from '../lib/crash'
import { GAMES, LANE_COLORS } from '../lib/games'
import { fmtChips } from '../lib/format'
import { BeautyResult } from './BeautyResult'
import { CrashClimb } from './CrashClimb'
import { OutcomeStrip } from './OutcomeStrip'
import { WinEffects } from '../effects/WinEffects'
import { LoseEffects } from '../effects/LoseEffects'
import { useLoseEffects, useWinEffects } from '../effects/useOutcomeEffects'

/*
 * Effects follow the real net result for the round, never a single bet:
 * - net > 0: coins, confetti and a gold glow, bigger for bigger multiples
 * - net < 0: a short ember rise, shake and red vignette
 * - net = 0: plain result
 * The result, your pick and the net are shown at once. The effects sit behind the card.
 */

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
  const win = useWinEffects(record, climbDone)
  const lose = useLoseEffects(record, climbDone)
  const up = win.intensity > 0

  // A winning round stays open until the player closes it. Others close after 3.2 s.
  useEffect(() => {
    if (!climbDone || up) return
    const t = setTimeout(onClose, 3200)
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
      {win.particles && <WinEffects {...win} />}
      {lose.particles && <LoseEffects />}
      <div className={`reveal-card ${win.cardClass} ${lose.cardClass}`} style={win.cardStyle}>
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
                    {g.kind === 'uniform' && <OutcomeStrip game={g} outcome={b.outcome} choice={b.choice} />}
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
        {up && (
          <button className="btn reveal-close" onClick={onClose}>
            Close
          </button>
        )}
      </div>
    </div>
  )
}
