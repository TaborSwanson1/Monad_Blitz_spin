import { Rocket } from '../Rocket'

// The lobby header's art: a Crash climb to 100x on a log scale, drawn to sit straight on the
// header (no box of its own). Decoration only. The tiles keep their small GameArt.

const W = 300
const H = 200
const X0 = 34
const X1 = 262
const BOTTOM = 172
const TOP = 34

/** Log scale: 1x at the bottom, 100x at the top. */
const y = (m: number) => BOTTOM - (Math.log10(m) / 2) * (BOTTOM - TOP)

// Same shape as the real climb: slow at first, then faster and faster.
const points = Array.from({ length: 41 }, (_, i) => {
  const s = i / 40
  const m = 10 ** (2 * (0.5 * s + 0.5 * s * s))
  return [X0 + s * (X1 - X0), y(m)] as const
})
const line = points.map(([px, py], i) => `${i ? 'L' : 'M'}${px.toFixed(1)} ${py.toFixed(1)}`).join(' ')
const area = `${line} L${X1} ${BOTTOM} L${X0} ${BOTTOM} Z`
const [ex, ey] = points[points.length - 1]
const [px, py] = points[points.length - 3]
/** The rocket points along the curve at its tip. */
const tilt = (Math.atan2(ey - py, ex - px) * 180) / Math.PI

export function HeroCrashArt() {
  return (
    <svg className="hero-crash" viewBox={`0 0 ${W} ${H}`} aria-hidden>
      <defs>
        <linearGradient id="hc-line" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="var(--gold, #ffd23f)" />
          <stop offset="1" stopColor="var(--primary, #ff2d87)" />
        </linearGradient>
        <linearGradient id="hc-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="var(--primary, #ff2d87)" stopOpacity="0.35" />
          <stop offset="1" stopColor="var(--primary, #ff2d87)" stopOpacity="0" />
        </linearGradient>
      </defs>

      {[1, 10, 100].map((m) => (
        <g key={m} className="hc-grid">
          <line x1={X0} x2={W - 6} y1={y(m)} y2={y(m)} />
          <text x={X0 - 6} y={y(m) + 4} textAnchor="end">
            {m}×
          </text>
        </g>
      ))}

      <path d={area} fill="url(#hc-fill)" />
      <path d={line} className="hc-line" stroke="url(#hc-line)" />
      <circle cx={ex} cy={ey} r="20" className="hc-halo" />
      <g transform={`translate(${ex.toFixed(1)} ${ey.toFixed(1)}) rotate(${tilt.toFixed(1)}) scale(1.7)`}>
        <Rocket />
      </g>
      <text x={ex - 38} y={ey + 22} textAnchor="end" className="hc-label">
        100×
      </text>
    </svg>
  )
}
