import { useState } from 'react'
import { GAMES, HOUSE_EDGE_BPS, LANE_COLORS, multiplier, winChance } from '../lib/games'
import { fmtChips, toChips } from '../lib/format'
import type { PlacedBet } from '../client'

interface Props {
  canBet: boolean
  disabledReason: string | null
  busy: string | null
  minBet: bigint
  maxBet: bigint
  myBets: PlacedBet[]
  onPlace: (gameId: number, choice: number, amount: bigint) => void
}

const QUICK = ['5', '10', '25', '50', '100']

export function BetPanel({ canBet, disabledReason, busy, minBet, maxBet, myBets, onPlace }: Props) {
  const [gameId, setGameId] = useState(0)
  const [choice, setChoice] = useState<number | null>(null)
  const [amount, setAmount] = useState('10')
  const g = GAMES[gameId]

  let amt = 0n
  try {
    amt = toChips(amount)
  } catch {
    amt = 0n
  }
  const inRange = amt >= minBet && amt <= maxBet
  const winPays = (amt * BigInt(g.payoutBps)) / 10_000n
  const ready = canBet && choice !== null && inRange && !busy

  return (
    <section className="panel bet">
      <div className="tabs" role="tablist">
        {GAMES.map((x) => (
          <button
            key={x.id}
            role="tab"
            aria-selected={x.id === gameId}
            className={`tab ${x.id === gameId ? 'on' : ''}`}
            onClick={() => {
              setGameId(x.id)
              setChoice(null)
            }}
          >
            {x.short}
          </button>
        ))}
      </div>

      <h2 className="game-name">{g.name}</h2>
      <p className="muted">{g.describe}</p>

      <dl className="odds">
        <div>
          <dt>Win chance</dt>
          <dd>{(winChance(g) * 100).toFixed(winChance(g) < 0.1 ? 1 : 0)}%</dd>
        </div>
        <div>
          <dt>Payout</dt>
          <dd>{multiplier(g)}×</dd>
        </div>
        <div>
          <dt>House edge</dt>
          <dd>{HOUSE_EDGE_BPS / 100}%</dd>
        </div>
      </dl>

      <div className={`choices choices-${g.outcomes}`}>
        {g.labels.map((label, i) => (
          <button
            key={label}
            className={`choice ${choice === i ? 'on' : ''}`}
            style={g.id === 2 ? ({ '--lane': LANE_COLORS[i] } as React.CSSProperties) : undefined}
            onClick={() => setChoice(i)}
          >
            {label}
          </button>
        ))}
      </div>

      <label className="amount">
        <span>Stake (CHIP)</span>
        <input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))} />
      </label>
      <div className="quick">
        {QUICK.map((q) => (
          <button key={q} className="btn ghost small" onClick={() => setAmount(q)}>
            {q}
          </button>
        ))}
      </div>

      <p className="summary">
        {inRange ? (
          <>
            Stake <strong>{fmtChips(amt)}</strong>. If you win you get <strong>{fmtChips(winPays)}</strong> back (net{' '}
            {fmtChips(winPays - amt, { sign: true })}). If you lose, you lose {fmtChips(amt)}.
          </>
        ) : (
          <>
            Stake must be between {fmtChips(minBet)} and {fmtChips(maxBet)} CHIP.
          </>
        )}
      </p>

      <button
        className="btn primary wide"
        disabled={!ready}
        onClick={() => choice !== null && onPlace(gameId, choice, amt)}
      >
        {busy ?? (disabledReason || (choice === null ? 'Pick an outcome' : 'Place bet'))}
      </button>

      {myBets.length > 0 && (
        <ul className="mybets">
          {myBets.map((b) => (
            <li key={`${b.roundId}-${b.index}`}>
              <span>R{b.roundId.toString()}</span>
              <span>{GAMES[b.gameId].short}</span>
              <span>{GAMES[b.gameId].labels[b.choice]}</span>
              <span>{fmtChips(b.amount)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
