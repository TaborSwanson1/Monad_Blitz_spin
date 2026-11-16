import { useEffect, useRef, useState, type RefObject } from 'react'

// The Crash rocket: gray body, red nose and fins, blue porthole, flickering flame.
// One drawing used everywhere Crash climbs (lobby header, tile, live graph, replay).
// It points right (+x) and is centered on its body, about 54 units nose to flame.

export function Rocket() {
  return (
    <g className="rocket">
      <g className="rocket-flame">
        <path d="M-17 -5 Q-27 -8 -33 0 Q-27 8 -17 5 Z" fill="#f59e0b" />
        <path d="M-17 -3 Q-23 -4 -27 0 Q-23 4 -17 3 Z" fill="#ffd84a" />
      </g>
      {/* fins */}
      <path d="M-8 -7 Q-15 -16 -22 -15 Q-17 -9 -15 -4 Z" fill="#d7262f" />
      <path d="M-8 7 Q-15 16 -22 15 Q-17 9 -15 4 Z" fill="#b51d25" />
      {/* nozzle */}
      <rect x="-19" y="-5" width="4" height="10" rx="1" fill="#7c7f86" />
      {/* body: light top half, shaded bottom half */}
      <path d="M-15 -8 Q2 -12 11 -6 L11 6 Q2 12 -15 8 Z" fill="#e4e6ea" />
      <path d="M-15 0 L11 0 L11 6 Q2 12 -15 8 Z" fill="#c4c7cd" />
      {/* nose cone */}
      <path d="M10 -6.6 Q17 -4 21 0 Q17 4 10 6.6 Q12 0 10 -6.6 Z" fill="#e0282f" />
      {/* porthole */}
      <circle cx="0" cy="0" r="4.6" fill="#8fc6ef" stroke="#8b8f96" strokeWidth="1.6" />
      <path d="M-2.4 -1.6 A3 3 0 0 1 1.4 -3" stroke="#fff" strokeWidth="1.2" fill="none" strokeLinecap="round" opacity="0.8" />
    </g>
  )
}

/** Size of an element in CSS pixels, kept current. */
export function useSize(ref: RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ w: 0, h: 0 })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return size
}

/**
 * The rocket over a chart that stretches (preserveAspectRatio="none"), so it isn't squashed.
 * Give the head and a point a little behind it in the chart's viewBox units, plus the
 * viewBox size. Place it inside a positioned box the same size as the chart.
 */
export function RocketMarker({
  head,
  back,
  view,
  size = 1,
}: {
  head: [number, number]
  back: [number, number]
  view: [number, number]
  size?: number
}) {
  const box = useRef<HTMLDivElement>(null)
  const { w, h } = useSize(box)
  const sx = w / view[0]
  const sy = h / view[1]
  // Angle on screen, after the chart is stretched to its box.
  const angle = w ? (Math.atan2((head[1] - back[1]) * sy, (head[0] - back[0]) * sx) * 180) / Math.PI : -60
  const s = 56 * size
  return (
    <div ref={box} className="rocket-marker-box" aria-hidden>
      {w > 0 && (
        <svg
          className="rocket-marker"
          viewBox="-28 -28 56 56"
          width={s}
          height={s}
          style={{ left: head[0] * sx - s / 2, top: head[1] * sy - s / 2 }}
        >
          <g transform={`rotate(${angle.toFixed(1)})`}>
            <Rocket />
          </g>
        </svg>
      )}
    </div>
  )
}
