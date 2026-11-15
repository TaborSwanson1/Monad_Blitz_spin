import type { RoundClock } from '../lib/rounds'

interface Props {
  clock: RoundClock
  roundLength: number
  bettingWindow: number
  myStakeInRound: boolean
}

/** Round state and a segmented track with one cell per block. */
export function RoundHud({ clock, roundLength, bettingWindow, myStakeInRound }: Props) {
  const pos = Math.round(clock.progress * roundLength)
  const big = clock.open ? clock.blocksToLock : clock.blocksToNext
  return (
    <div className="hud">
      <div className="hud-row">
        <div className="hud-round">
          ROUND <strong>{clock.roundId.toString()}</strong>
        </div>
        <div className={`phase phase-${clock.open ? 'open' : 'locked'}`}>
          {clock.open ? 'BETTING OPEN' : myStakeInRound ? 'LOCKED · AWAITING RESULT' : 'LOCKED'}
        </div>
      </div>
      <div className="hud-count">
        <span key={big.toString()} className="count-num">
          {big.toString()}
        </span>
        <span className="count-label">{clock.open ? 'blocks until lock' : 'blocks until next round'}</span>
      </div>
      <div className="track" style={{ gridTemplateColumns: `repeat(${roundLength}, 1fr)` }}>
        {Array.from({ length: roundLength }, (_, i) => (
          <div
            key={i}
            className={['cell', i < bettingWindow ? 'cell-open' : 'cell-lock', i < pos ? 'past' : '', i === pos ? 'now' : '']
              .filter(Boolean)
              .join(' ')}
          />
        ))}
      </div>
    </div>
  )
}
