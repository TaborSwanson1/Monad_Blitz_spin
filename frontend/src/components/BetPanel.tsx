import { useState } from 'react'
import { BEAUTY_ENTRY, BEAUTY_MAX_BOTS, BEAUTY_MIN_BOTS, beautyMultiplier } from '../lib/beauty'
import { BEAUTY_PAYOUT_BPS } from '../lib/beautyOdds'
import { CRASH_DEFAULT_CHOICE, CRASH_MANUAL, CRASH_TARGETS_X100 } from '../lib/crash'
import { GAMES, HOUSE_EDGE_BPS, LANE_COLORS, chanceFor, multiplierFor, payoutBpsFor } from '../lib/games'
import { fmtChips, toChips } from '../lib/format'
import type { PlacedBet } from '../client'
import { IconTarget } from './icons'
import { Wheel } from './Wheel'

interface Props {
  gameId: number
  canBet: boolean
  disabledReason: string | null
  busy: string | null
  minBet: bigint
  maxBet: bigint
  myBets: PlacedBet[]
  onPlace: (gameId: number, choice: number, amount: bigint) => void
  /** On-chain: Crash uses the blind block window and Beauty is on the contract. */
  chain?: boolean
}

const QUICK = ['5', '10', '25', '50', '100']

const pct = (p: number) => `${(p * 100).toFixed(p < 0.1 ? 1 : 0)}%`

/** Render with key={gameId} so the pick resets when the game changes. */
export function BetPanel({ gameId, canBet, disabledReason, busy, minBet, maxBet, myBets, onPlace, chain = false }: Props) {
  const [choice, setChoice] = useState<number | null>(GAMES[gameId].kind === 'crash' ? CRASH_DEFAULT_CHOICE : null)
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
    <section className="card bet">
      <header className="card-head">
        <IconTarget />
        <h3>Place a bet</h3>
      </header>
      <div className="card-body">
      <h2 className="game-name">
        {g.name}
        {g.simOnly && !chain && <span className="sim-only">Sim only</span>}
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
            <dt>Win pays</dt>
            <dd>{choice === null ? 'Pick a number' : `${beautyMultiplier(choice).toFixed(2)}×`}</dd>
          </div>
        </dl>
      ) : isCrash && choice === CRASH_MANUAL ? (
        <dl className="odds">
          <div>
            <dt>Cash out at 2×</dt>
            <dd>49% win</dd>
          </div>
          <div>
            <dt>Payout</dt>
            <dd>Stake × your cash-out</dd>
          </div>
          <div>
            <dt>House edge</dt>
            <dd>{HOUSE_EDGE_BPS / 100}% at any point</dd>
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
            Target = ⅔ of the average guess, so it can't go above 66.7. The other players are bots. Their guesses come
            from the round's random seed, which nobody has until betting closes.
          </p>
        </div>
      ) : isCrash ? (
        <div className="crash-picker">
          <div className="amount">
            <span>Auto cash-out (optional backup)</span>
          </div>
          <div className="choices choices-crash">
            <button
              className={`choice ${choice === CRASH_MANUAL ? 'on' : ''}`}
              onClick={() => setChoice(CRASH_MANUAL)}
            >
              Off
              <span className="choice-sub">cash out by hand</span>
            </button>
            {CRASH_TARGETS_X100.map((_, i) => (
              <button key={g.labels[i]} className={`choice ${choice === i ? 'on' : ''}`} onClick={() => setChoice(i)}>
                {g.labels[i]}
                <span className="choice-sub">{pct(chanceFor(g, i))}</span>
              </button>
            ))}
          </div>
          <p className="note">
            {chain ? (
              <>
                After betting locks, the multiplier steps up 20% every block for the locked part of the
                round. Hit Cash Out any time in that window. Your cash-out counts at the
                block it lands in, which can be one block after your click. The crash point is drawn
                from the round's random seed after the window closes, so nobody can know it ahead. A bet
                still riding at the end cashes out at the final multiplier. Every cash-out point has the
                same 2% edge.
              </>
            ) : (
              <>
                After betting locks, the multiplier climbs live. Hit Cash Out any time before it crashes. The
                crash point is drawn as it climbs, so nobody can know it ahead. An auto target cashes you out
                there if you haven't already. Every cash-out point has the same 2% edge.
              </>
            )}
          </p>
        </div>
      ) : g.id === 1 ? (
        // Exact Digit: pick your number on the game-show wheel.
        <div className="wheel-pick-wrap">
          <Wheel size={230} picked={choice === null ? [] : [choice]} onPick={setChoice} />
          <p className="note center">{choice === null ? 'Tap a segment to pick your number.' : `You picked ${choice}.`}</p>
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
            Entry <strong>{fmtChips(BEAUTY_ENTRY)}</strong>. The closest guess to ⅔ of the average wins.{' '}
            {choice === null ? (
              <>Each number pays a different amount, set so that every number returns 98% on average against the bots.</>
            ) : BEAUTY_PAYOUT_BPS[choice] >= 2_000_000 ? (
              <>
                This number almost never wins against the bots, so its payout is capped at 200× and it returns less than 98%.
              </>
            ) : (
              <>
                If you win you get <strong>{fmtChips((BEAUTY_ENTRY * BigInt(BEAUTY_PAYOUT_BPS[choice])) / 10_000n)}</strong> back, split with anyone tied. That
                pays {beautyMultiplier(choice).toFixed(2)}× and returns 98% on average.
              </>
            )}{' '}
            If you don't win, you lose {fmtChips(BEAUTY_ENTRY)}. One entry per round.
          </>
        ) : inRange ? (
          <>
            Stake <strong>{fmtChips(amt)}</strong>.{' '}
            {isCrash && choice === CRASH_MANUAL ? (
              <>
                Cash out at any multiplier to get your stake times it. Cash out at 2× and you get{' '}
                <strong>{fmtChips(amt * 2n)}</strong> back. If it crashes first, you lose {fmtChips(amt)}.
              </>
            ) : (
              <>
                {isCrash && choice !== null && (
                  <>If you haven't cashed out by <strong>{g.labels[choice]}</strong>, auto cash-out pays </>
                )}
                {isCrash ? '' : 'If you win you get '}
                <strong>{fmtChips(winPays)}</strong> back (net {fmtChips(winPays - amt, { sign: true })}). If you
                lose, you lose {fmtChips(amt)}.
              </>
            )}
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
      </div>
    </section>
  )
}
