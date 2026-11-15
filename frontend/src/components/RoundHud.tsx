import type { RoundClock } from '../lib/rounds'
import { IconTimer } from './icons'

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
    <section className="card round-card">
      <header className="card-head">
        <IconTimer />
        <h3>Round {clock.roundId.toString()}</h3>
        <div className="card-actions">
          <span className={`badge ${clock.open ? 'badge-primary' : 'badge-warn'}`}>
            {clock.open ? 'Betting open' : myStakeInRound ? 'Locked · awaiting result' : 'Locked'}
          </span>
        </div>
      </header>
      <div className="card-body">
        <div className="count">
          <span className="count-num">{big.toString()}</span>
          <span className="count-label">{clock.open ? 'blocks until betting locks' : 'blocks until the next round'}</span>
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
        <div className="track-legend">
          <span>
            <i className="key key-open" /> Betting · {bettingWindow} blocks
          </span>
          <span>
            <i className="key key-lock" /> Locked · {roundLength - bettingWindow} blocks
          </span>
        </div>
      </div>
    </section>
  )
}
