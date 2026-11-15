import type { Hex } from 'viem'
import { resolveBeauty } from '../lib/beauty'
import { BEAUTY_ID } from '../lib/games'
import { gameSeed } from '../lib/outcomes'

const W = 320
const H = 96
const PAD = 10
const xOf = (v: number) => PAD + (v / 100) * (W - 2 * PAD)

/** Dot plot of every guess, with the average and the 2/3 target marked. */
export function BeautyResult({ roundSeed, yourGuess }: { roundSeed: Hex; yourGuess: number }) {
  const r = resolveBeauty(gameSeed(roundSeed, BEAUTY_ID), yourGuess)

  // Stack dots that share a value so none hide behind another.
  const seen = new Map<number, number>()
  const dots = r.guesses.map((g, i) => {
    const level = seen.get(g) ?? 0
    seen.set(g, level + 1)
    return { g, i, level }
  })
  const winningGuess = r.guesses[r.winners[0]]

  return (
    <div className="beauty-result">
      <div className="beauty-stats">
        <span>
          Average <strong>{r.average.toFixed(1)}</strong>
        </span>
        <span>
          Target <strong>{r.target.toFixed(1)}</strong>
        </span>
        <span>
          Winning guess <strong>{winningGuess}</strong>
          {r.winners.length > 1 ? ` (${r.winners.length}-way tie)` : ''}
        </span>
      </div>
      <svg className="beauty-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Every player's guess">
        <line className="beauty-axis" x1={PAD} x2={W - PAD} y1={H - 22} y2={H - 22} />
        {[0, 25, 50, 67, 100].map((v) => (
          <text key={v} className="beauty-tick" x={xOf(v)} y={H - 8} textAnchor="middle">
            {v}
          </text>
        ))}
        <line className="beauty-avg" x1={xOf(r.average)} x2={xOf(r.average)} y1={6} y2={H - 22} />
        <line className="beauty-target" x1={xOf(r.target)} x2={xOf(r.target)} y1={6} y2={H - 22} />
        {dots.map(({ g, i, level }) => (
          <circle
            key={i}
            className={`beauty-dot ${i === 0 ? 'you' : ''} ${r.winners.includes(i) ? 'winner' : ''}`}
            cx={xOf(g)}
            cy={H - 30 - level * 10}
            r={i === 0 ? 5 : 4}
          />
        ))}
      </svg>
      <div className="beauty-legend">
        <span className="lg-you">● you ({yourGuess})</span>
        <span className="lg-bot">● bots</span>
        <span className="lg-target">| target</span>
        <span className="lg-avg">| average</span>
      </div>
    </div>
  )
}
