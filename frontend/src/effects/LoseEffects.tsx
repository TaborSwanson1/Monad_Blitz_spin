import { useState, type CSSProperties } from 'react'

const rand = (a: number, b: number) => a + Math.random() * (b - a)
const EMBER_COLORS = ['#ff7a1a', '#ff4d1f', '#f31260', '#ffb020']

/** Embers rising from the bottom of the result card. Goes inside `.reveal-card`, behind its text. */
export function Embers({ count = 22 }: { count?: number }) {
  const [embers] = useState(() =>
    Array.from({ length: count }, () => {
      const size = rand(3, 6)
      return {
        left: `${rand(4, 96)}%`,
        width: size,
        height: size,
        '--c': EMBER_COLORS[(Math.random() * EMBER_COLORS.length) | 0],
        '--dx': `${rand(-24, 24)}px`,
        '--rise': `${rand(60, 170)}px`,
        '--delay': `${rand(0, 250)}ms`,
        '--dur': `${rand(650, 950)}ms`,
      } as CSSProperties
    }),
  )
  return (
    <div className="fx-embers" aria-hidden>
      {embers.map((style, i) => (
        <span key={i} className="fx-ember" style={style} />
      ))}
    </div>
  )
}

/** Brief red vignette around the edges of the screen, 500 ms. */
export function LossVignette() {
  return <div className="fx-layer fx-vignette" aria-hidden />
}
