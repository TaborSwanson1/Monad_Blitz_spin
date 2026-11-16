import { useEffect, useRef, useState } from 'react'
import { fmtX } from '../lib/crash'
import { prefersReducedMotion } from '../lib/themes'
import { Rocket } from './Rocket'
import { CrashScene, zoneOf } from './CrashScene'

// The climb is a replay. The crash point is already settled by the time this runs.
//
// Every round follows the SAME curve, m(t) = e^(A t + B t^2): about 2x at 1.4 s,
// 10x at 3.9 s, 100x at 6 s. Only the stopping point differs. The axes don't depend
// on the crash point either. If the speed or scale came from the crash point, a
// player could read the result off the chart before it finished.

const A = 0.412 / 1000 // per ms
const B = 0.0592 / 1_000_000 // per ms^2
const MAX_MS = 9000 // past this (about 1,000x, roughly 1 round in 1,000) it jumps to the result

export const multAt = (ms: number) => Math.exp(A * ms + B * ms * ms)

export function climbDurationMs(crashX100: number): number {
  const L = Math.log(crashX100 / 100)
  if (L <= 0) return 0
  return Math.min(MAX_MS, (-A + Math.sqrt(A * A + 4 * B * L)) / (2 * B))
}

interface Props {
  crashX100: number
  /** The player's targets this round, in hundredths. */
  targetsX100: number[]
  onDone: () => void
}

const W = 320
const H = 150
const MIN_SPAN_MS = 5000

export function CrashClimb({ crashX100, targetsX100, onDone }: Props) {
  const duration = prefersReducedMotion() ? 0 : climbDurationMs(crashX100)
  const [elapsed, setElapsed] = useState(0)
  const doneRef = useRef(onDone)
  doneRef.current = onDone

  useEffect(() => {
    if (duration === 0) {
      doneRef.current()
      return
    }
    let raf = 0
    const start = performance.now()
    const step = (now: number) => {
      const t = Math.min(duration, now - start)
      setElapsed(t)
      if (t < duration) raf = requestAnimationFrame(step)
      else doneRef.current()
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [duration])

  const finished = elapsed >= duration
  const mult = finished ? crashX100 / 100 : multAt(elapsed)

  // Axes grow with the climb and the player's own targets, never with the crash point.
  const span = Math.max(MIN_SPAN_MS, elapsed)
  const topMult = Math.max(2, mult, ...targetsX100.map((t) => t / 100)) * 1.15
  const y = (m: number) => H - (Math.log(m) / Math.log(topMult)) * (H - 8)
  // Leave room at the right edge for the rocket.
  const x = (t: number) => 4 + (t / span) * (W - 22)

  const points: string[] = []
  const samples = 48
  for (let i = 0; i <= samples; i++) {
    const t = (elapsed * i) / samples
    points.push(`${x(t).toFixed(1)},${y(multAt(t)).toFixed(1)}`)
  }

  // The rocket rides the head of the line, pointed along the curve.
  const hx = x(elapsed)
  const hy = y(mult)
  const back = Math.max(0, elapsed - 120)
  const angle = elapsed > 0 ? (Math.atan2(hy - y(multAt(back)), hx - x(back)) * 180) / Math.PI : -60

  return (
    <div className={`crash-climb ${finished ? 'is-crashed' : ''}`}>
      <div className="crash-mult" aria-live="off">
        {fmtX(Math.floor(mult * 100))}
      </div>
      <div className="crash-status">{finished ? `CRASHED AT ${fmtX(crashX100)}` : 'REPLAYING SETTLED RESULT'}</div>
      <div className="crash-stage">
      <CrashScene mult={mult} crashed={finished} />
      <div className="crash-zone">{zoneOf(mult)}</div>
      <svg className="crash-chart" viewBox={`0 0 ${W} ${H}`} aria-hidden>
        {targetsX100.map((t) => {
          const reached = mult * 100 >= t
          const ty = y(t / 100)
          return (
            <g key={t} className={`crash-target ${reached ? 'reached' : ''}`}>
              <line x1={0} x2={W} y1={ty} y2={ty} />
              <text x={W - 4} y={ty - 4} textAnchor="end">
                {reached ? `CASHED OUT ${fmtX(t)}` : `TARGET ${fmtX(t)}`}
              </text>
            </g>
          )
        })}
        {elapsed > 0 && <polyline className="crash-line" points={points.join(' ')} />}
        {finished ? (
          <g className="crash-boom" transform={`translate(${hx} ${hy})`}>
            <circle r="16" />
            <circle r="10" />
            <circle r="5" />
          </g>
        ) : (
          <g transform={`translate(${hx} ${hy}) rotate(${angle}) scale(0.7)`}>
            <Rocket />
          </g>
        )}
      </svg>
      </div>
    </div>
  )
}
