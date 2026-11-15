import { useEffect, useRef } from 'react'
import { prefersReducedMotion } from '../lib/themes'

// Exact Digit's game-show wheel: one segment per digit, 0 to 9.
//
// As a picker (no `landOn`), clicking a segment chooses that number.
// As a result (with `landOn`), it spins and stops on the digit the round's seed gave.
//
// Honest stop: the result is already settled; the spin only shows it. Where the pointer
// lands inside the winning segment is random and never depends on the player's pick, so
// the wheel can't be steered to crawl past your number on purpose. No near-miss staging.

const N = 10
const SEG = 360 / N
export const SPIN_MS = 3800

// Bright game-show colors, alternating so neighbors never match.
const COLORS = ['#e63946', '#f4a261', '#2a9d8f', '#457b9d', '#9b5de5', '#f15bb5', '#e9c46a', '#00b4d8', '#ef476f', '#06d6a0']

interface Props {
  size?: number
  /** Digit to land on. Omit for picker mode. */
  landOn?: number
  /** Digits the player picked, outlined on the wheel. */
  picked?: number[]
  onPick?: (digit: number) => void
  onDone?: () => void
}

function segmentPath(i: number, r: number, cx: number, cy: number) {
  const a0 = ((i * SEG - SEG / 2 - 90) * Math.PI) / 180
  const a1 = ((i * SEG + SEG / 2 - 90) * Math.PI) / 180
  const x0 = cx + r * Math.cos(a0)
  const y0 = cy + r * Math.sin(a0)
  const x1 = cx + r * Math.cos(a1)
  const y1 = cy + r * Math.sin(a1)
  return `M${cx} ${cy} L${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`
}

export function Wheel({ size = 260, landOn, picked = [], onPick, onDone }: Props) {
  const rotor = useRef<SVGGElement>(null)
  const done = useRef(onDone)
  done.current = onDone

  useEffect(() => {
    if (landOn === undefined) return
    const el = rotor.current
    // Segment i sits at angle i*36 (0 = top). To bring `landOn` under the top pointer the
    // wheel turns to -landOn*36, plus whole turns, plus a random spot inside the segment.
    const jitter = (Math.random() - 0.5) * SEG * 0.7
    const end = 360 * 6 + (360 - landOn * SEG) + jitter
    if (!el || prefersReducedMotion()) {
      if (el) el.style.transform = `rotate(${end}deg)`
      done.current?.()
      return
    }
    const anim = el.animate([{ transform: 'rotate(0deg)' }, { transform: `rotate(${end}deg)` }], {
      duration: SPIN_MS,
      easing: 'cubic-bezier(.12,.6,.12,1)',
      fill: 'forwards',
    })
    anim.onfinish = () => done.current?.()
    return () => anim.cancel()
  }, [landOn])

  const c = 120
  const r = 100
  const bulbs = 20
  const picker = landOn === undefined && !!onPick

  return (
    <div className={`wheel ${picker ? 'wheel-picker' : ''} ${landOn !== undefined ? 'wheel-spinning' : ''}`} style={{ width: size }}>
      <svg viewBox="0 0 240 250" role={picker ? 'radiogroup' : 'img'} aria-label={picker ? 'Pick a number on the wheel' : 'Wheel'}>
        <defs>
          <radialGradient id="wheel-rim" cx="50%" cy="45%" r="60%">
            <stop offset="0" stopColor="#fff2a8" />
            <stop offset="0.6" stopColor="#e3a72f" />
            <stop offset="1" stopColor="#8a5a10" />
          </radialGradient>
          <radialGradient id="wheel-hub" cx="40%" cy="35%" r="70%">
            <stop offset="0" stopColor="#fff7d1" />
            <stop offset="0.5" stopColor="#f0b93b" />
            <stop offset="1" stopColor="#7a4c0a" />
          </radialGradient>
          <radialGradient id="wheel-shine" cx="35%" cy="25%" r="75%">
            <stop offset="0" stopColor="#fff" stopOpacity="0.35" />
            <stop offset="0.5" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Gold rim with bulbs */}
        <circle cx={c} cy={c + 6} r={r + 14} fill="url(#wheel-rim)" stroke="#5a3a08" strokeWidth={2} />
        {Array.from({ length: bulbs }, (_, i) => {
          const a = ((i * 360) / bulbs - 90) * (Math.PI / 180)
          return (
            <circle
              key={i}
              className="wheel-bulb"
              cx={c + (r + 7) * Math.cos(a)}
              cy={c + 6 + (r + 7) * Math.sin(a)}
              r={3.4}
              style={{ animationDelay: `${(i % 2) * 0.35}s` }}
            />
          )
        })}

        {/* Spinning part */}
        <g transform={`translate(0 6)`}>
          <g ref={rotor} className="wheel-rotor" style={{ transformOrigin: `${c}px ${c}px` }}>
            {Array.from({ length: N }, (_, i) => {
              const mid = ((i * SEG - 90) * Math.PI) / 180
              const isPicked = picked.includes(i)
              return (
                <g
                  key={i}
                  className={`wheel-seg ${isPicked ? 'picked' : ''}`}
                  onClick={picker ? () => onPick?.(i) : undefined}
                  role={picker ? 'radio' : undefined}
                  aria-checked={picker ? isPicked : undefined}
                  aria-label={picker ? `Number ${i}` : undefined}
                  tabIndex={picker ? 0 : undefined}
                  onKeyDown={picker ? (e) => (e.key === 'Enter' || e.key === ' ') && onPick?.(i) : undefined}
                >
                  <path d={segmentPath(i, r, c, c)} fill={COLORS[i]} stroke="#3b2405" strokeWidth={1.5} />
                  <text
                    x={c + r * 0.68 * Math.cos(mid)}
                    y={c + r * 0.68 * Math.sin(mid)}
                    transform={`rotate(${i * SEG} ${c + r * 0.68 * Math.cos(mid)} ${c + r * 0.68 * Math.sin(mid)})`}
                    className="wheel-num"
                    textAnchor="middle"
                    dominantBaseline="central"
                  >
                    {i}
                  </text>
                  {isPicked && <path d={segmentPath(i, r - 3, c, c)} className="wheel-pick-ring" />}
                </g>
              )
            })}
          </g>
          <circle cx={c} cy={c} r={r} fill="url(#wheel-shine)" pointerEvents="none" />
          <circle cx={c} cy={c} r={20} fill="url(#wheel-hub)" stroke="#5a3a08" strokeWidth={2} />
          <circle cx={c - 6} cy={c - 6} r={5} fill="#fff" opacity={0.55} />
        </g>

        {/* Pointer at the top */}
        <path d={`M${c - 13} 2 L${c + 13} 2 L${c} 30 Z`} className="wheel-pointer" />
        <circle cx={c} cy={6} r={4} fill="#fff7d1" />
      </svg>
    </div>
  )
}
