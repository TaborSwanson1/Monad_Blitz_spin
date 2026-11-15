import { useState } from 'react'
import { CRASH_DEFAULT_CHOICE, CRASH_TARGETS_X100 } from '../lib/crash'
import { GAMES, HOUSE_EDGE_BPS, LANE_COLORS, chanceFor, gamesFor, multiplierFor, payoutBpsFor } from '../lib/games'
import { fmtChips, toChips } from '../lib/format'
import type { PlacedBet } from '../client'

interface Props {
  mode: 'sim' | 'chain'
  canBet: boolean
  disabledReason: string | null
  busy: string | null
  minBet: bigint
  maxBet: bigint
  myBets: PlacedBet[]
  onPlace: (gameId: number, choice: number, amount: bigint) => void
}

const QUICK = ['5', '10', '25', '50', '100']

const pct = (p: number) => `${(p * 100).toFixed(p < 0.1 ? 1 : 0)}%`

export function BetPanel({ mode, canBet, disabledReason, busy, minBet, maxBet, myBets, onPlace }: Props) {
  const games = gamesFor(mode)
  const [gameId, setGameId] = useState(0)
  const [choice, setChoice] = useState<number | null>(null)
  const [amount, setAmount] = useState('10')
  const g = GAMES[gameId]
  const isCrash = g.kind === 'crash'

  let amt = 0n
  try {
    amt = toChips(amount)
  } catch {
    amt = 0n
  }
  const inRange = amt >= minBet && amt <= maxBet
  // Odds for the current pick. Uniform games have the same odds for every pick.
  const oddsChoice = choice ?? 0
  const winPays = (amt * BigInt(payoutBpsFor(g, oddsChoice))) / 10_000n
  const ready = canBet && choice !== null && inRange && !busy

  return (
    <section className="panel bet">
      <div className="tabs" role="tablist">
        {games.map((x) => (
          <button
            key={x.id}
            role="tab"
            aria-selected={x.id === gameId}
            className={`tab ${x.id === gameId ? 'on' : ''}`}
            onClick={() => {
              setGameId(x.id)
              setChoice(x.kind === 'crash' ? CRASH_DEFAULT_CHOICE : null)
            }}
          >
            {x.short}
          </button>
        ))}
      </div>

      <h2 className="game-name">
        {g.name}
        {g.simOnly && <span className="sim-only">SIM ONLY</span>}
      </h2>
      <p className="muted">{g.describe}</p>

      <dl className="odds">
        <div>
          <dt>Win chance</dt>
          <dd>{pct(chanceFor(g, oddsChoice))}</dd>
        </div>
        <div>
          <dt>Payout</dt>
          <dd>{multiplierFor(g, oddsChoice)}×</dd>
        </div>
        <div>
          <dt>House edge</dt>
          <dd>{HOUSE_EDGE_BPS / 100}%</dd>
        </div>
      </dl>

      {isCrash ? (
        <div className="crash-picker">
          <label className="amount">
            <span>Cash-out target</span>
            <input
              type="range"
              min={0}
              max={CRASH_TARGETS_X100.length - 1}
              step={1}
              value={choice ?? CRASH_DEFAULT_CHOICE}
              onChange={(e) => setChoice(Number(e.target.value))}
              aria-valuetext={g.labels[choice ?? CRASH_DEFAULT_CHOICE]}
            />
          </label>
          <div className="choices choices-crash">
            {g.labels.map((label, i) => (
              <button key={label} className={`choice ${choice === i ? 'on' : ''}`} onClick={() => setChoice(i)}>
                {label}
                <span className="choice-sub">{pct(chanceFor(g, i))}</span>
              </button>
            ))}
          </div>
          <p className="note">
            Your target locks with your bet. The climb you see after the round is a replay of a result that's already
            settled. Higher targets pay more and hit less often. The edge is 2% at every target.
          </p>
        </div>
      ) : (
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
      )}

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
            Stake <strong>{fmtChips(amt)}</strong>.{' '}
            {isCrash && choice !== null && (
              <>If the crash point reaches <strong>{g.labels[choice]}</strong>, </>
            )}
            {isCrash ? 'you' : 'If you win you'} get <strong>{fmtChips(winPays)}</strong> back (net{' '}
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
