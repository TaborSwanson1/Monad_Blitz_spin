import { useState } from 'react'
import { BEAUTY_ENTRY, BEAUTY_FEE_BPS, BEAUTY_MAX_BOTS, BEAUTY_MIN_BOTS } from '../lib/beauty'
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
  const isBeauty = g.kind === 'beauty'

  let amt = 0n
  try {
    amt = isBeauty ? BEAUTY_ENTRY : toChips(amount)
  } catch {
    amt = 0n
  }
  const inRange = amt >= minBet && amt <= maxBet
  // Odds for the current pick. Uniform games have the same odds for every pick.
  const oddsChoice = choice ?? 0
  const winPays = (amt * BigInt(payoutBpsFor(g, oddsChoice))) / 10_000n
  // Pending bets only last until their round settles, so a pending entry means this round.
  const enteredBeauty = isBeauty && myBets.some((b) => GAMES[b.gameId].kind === 'beauty')
  const ready = canBet && choice !== null && inRange && !busy && !enteredBeauty

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

      {isBeauty ? (
        <dl className="odds">
          <div>
            <dt>Entry</dt>
            <dd>{fmtChips(BEAUTY_ENTRY)}</dd>
          </div>
          <div>
            <dt>Players</dt>
            <dd>
              {BEAUTY_MIN_BOTS + 1}–{BEAUTY_MAX_BOTS + 1}
            </dd>
          </div>
          <div>
            <dt>Fee</dt>
            <dd>{BEAUTY_FEE_BPS / 100}% of pot</dd>
          </div>
        </dl>
      ) : (
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
      )}

      {isBeauty ? (
        <div className="beauty-picker">
          <label className="amount">
            <span>Your guess (0 to 100)</span>
            <input
              inputMode="numeric"
              placeholder="Type a number"
              value={choice ?? ''}
              onChange={(e) => {
                const v = e.target.value.replace(/[^0-9]/g, '')
                setChoice(v === '' ? null : Math.min(100, Number(v)))
              }}
            />
          </label>
          <p className="note">
            Target = ⅔ of the average guess, so it can't go above 66.7. Your guess is sealed until betting closes. In sim
            mode the other players are bots, and their guesses come from the round's random seed.
          </p>
        </div>
      ) : isCrash ? (
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

      {!isBeauty && (
        <>
          <label className="amount">
            <span>Stake (CHIP)</span>
            <input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
            />
          </label>
          <div className="quick">
            {QUICK.map((q) => (
              <button key={q} className="btn ghost small" onClick={() => setAmount(q)}>
                {q}
              </button>
            ))}
          </div>
        </>
      )}

      <p className="summary">
        {isBeauty ? (
          <>
            Entry <strong>{fmtChips(BEAUTY_ENTRY)}</strong>. The pot is {fmtChips(BEAUTY_ENTRY)} × the number of players.
            The closest guess wins the pot minus {BEAUTY_FEE_BPS / 100}%, and ties split it. If you don't win, you lose{' '}
            {fmtChips(BEAUTY_ENTRY)}. One entry per round.
          </>
        ) : inRange ? (
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
        {busy ??
          (disabledReason ||
            (enteredBeauty
              ? 'Entered this round'
              : choice === null
                ? isBeauty
                  ? 'Type a guess'
                  : 'Pick an outcome'
                : isBeauty
                  ? 'Enter guess'
                  : 'Place bet'))}
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
