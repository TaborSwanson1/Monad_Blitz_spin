// The jackpot as a heap of gold coins across the top of the machine, with the prize on a plaque in
// front of it. Drawn by us in SVG.
//
// In the near-miss demo the heap creeps up as the demo balance drops and the spins lose (the Decision
// of 2026-11-15 allows that on this screen only). It is meant to be subtle: no "almost there" text, no
// marker line, no flashing, just a bigger pile. In the honest view the heap is a fixed decoration.
// Owner: Zander.

import { fmtJackpot } from './format'

interface Coin {
  x: number
  y: number
  /** Row from the bottom (0 = floor). */
  row: number
  /** 0 to 1 across the heap, used to leave coins out at the edges while the heap is low. */
  tone: number
}

const W = 520
const H = 132
const ROW = 7.4
const COIN_W = 22

// A rounded heap: tall in the middle, sloping to the floor at both ends.
const heapHeight = (x: number) => {
  const k = (x - W / 2) / (W / 2 - 14)
  return Math.max(0, 1 - Math.abs(k) ** 1.55)
}

// Deterministic jitter, so every render draws the same heap.
const jitter = (i: number) => {
  const v = Math.sin(i * 127.1 + 311.7) * 43758.5453
  return v - Math.floor(v)
}

const COINS: Coin[] = (() => {
  const out: Coin[] = []
  const rows = 15
  let n = 0
  for (let row = 0; row < rows; row++) {
    const offset = row % 2 ? COIN_W / 2 : 0
    for (let x = 22 + offset; x <= W - 22; x += COIN_W) {
      n++
      const jx = (jitter(n) - 0.5) * 5
      const px = x + jx
      const limit = heapHeight(px) * rows * 0.98
      if (row + 1 > limit) continue
      out.push({ x: px, y: H - 16 - row * ROW - (jitter(n + 9) - 0.5) * 1.6, row, tone: jitter(n + 3) })
    }
  }
  return out
})()
const MAX_ROW = COINS.reduce((m, c) => Math.max(m, c.row), 1)

interface Props {
  /** The jackpot in chips for the current bet. */
  amount: number
  /** How big the heap is, 0 to 1. */
  level: number
  /** The near-miss demo is holding the last reel: the heap shimmers. */
  excited?: boolean
}

export function JackpotPile({ amount, level, excited = false }: Props) {
  return (
    <div className={`sl-pile ${excited ? 'is-excited' : ''}`}>
      <svg className="sl-pile-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMax meet" aria-hidden focusable="false">
        <defs>
          <linearGradient id="sl-pile-face" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff6c4" />
            <stop offset="0.55" stopColor="#f6c443" />
            <stop offset="1" stopColor="#d9a11f" />
          </linearGradient>
          <g id="sl-pile-coin">
            <ellipse cx="0" cy="2.2" rx="10.6" ry="5" fill="#9a6609" />
            <ellipse cx="0" cy="0" rx="10.6" ry="5" fill="url(#sl-pile-face)" stroke="#8a560a" strokeWidth="0.8" />
            <ellipse cx="0" cy="0" rx="6.4" ry="2.8" fill="none" stroke="#b7740c" strokeWidth="0.9" opacity="0.8" />
          </g>
          <radialGradient id="sl-pile-glow" cx="0.5" cy="1" r="0.8">
            <stop offset="0" stopColor="#ffe27a" stopOpacity="0.5" />
            <stop offset="1" stopColor="#ffe27a" stopOpacity="0" />
          </radialGradient>
        </defs>
        <ellipse cx={W / 2} cy={H - 10} rx={W / 2 - 4} ry="12" fill="url(#sl-pile-glow)" />
        {COINS.map((c, i) => {
          // A coin is shown when it sits below the heap's current top at its spot.
          const on = (c.row + 1) / (MAX_ROW + 1) <= heapHeight(c.x) * level + 0.02
          return (
            <use
              key={i}
              href="#sl-pile-coin"
              className={`sl-pile-coin ${on ? 'is-on' : ''}`}
              style={{ transform: `translate(${c.x}px, ${c.y}px)`, filter: `brightness(${0.9 + c.tone * 0.22})` }}
            />
          )
        })}
        {[
          [120, 96, 0],
          [210, 60, 1],
          [270, 36, 2],
          [340, 66, 3],
          [410, 100, 4],
        ].map(([x, y, i]) => (
          <path key={i} className={`sl-pile-twinkle sl-pile-twinkle-${i}`} d={`M${x} ${y - 7} L${x + 2} ${y - 2} L${x + 7} ${y} L${x + 2} ${y + 2} L${x} ${y + 7} L${x - 2} ${y + 2} L${x - 7} ${y} L${x - 2} ${y - 2} Z`} fill="#fffbe0" />
        ))}
      </svg>
      <div className="sl-pile-plaque">
        <span>Jackpot</span>
        <strong>{fmtJackpot(amount)}</strong>
      </div>
    </div>
  )
}
