import { useState, type CSSProperties } from 'react'

const rand = (a: number, b: number) => a + Math.random() * (b - a)
const EMBER_COLORS = ['#ff7a1a', '#ff4d1f', '#f31260', '#ffb020', '#ff9a3c']

/**
 * Full-screen background flash: green/white for a win, red/black for a loss.
 * Kept under 3 flashes a second (the WCAG seizure threshold) and finite.
 */
export function ScreenFlash({ kind }: { kind: 'win' | 'loss' }) {
  return <div className={`fx-layer fx-flash fx-flash-${kind}`} aria-hidden />
}

/**
 * Full-screen loss effects: a red vignette, a fire glow along the bottom edge, and embers
 * rising across the whole width of the screen. All behind the result card.
 */
export function LoseEffects({ count = 90 }: { count?: number }) {
  const [embers] = useState(() =>
    Array.from({ length: count }, () => {
      const size = rand(3, 9)
      return {
        left: `${rand(0, 100)}vw`,
        width: size,
        height: size,
        '--c': EMBER_COLORS[(Math.random() * EMBER_COLORS.length) | 0],
        '--dx': `${rand(-6, 6)}vw`,
        '--rise': `${rand(35, 90)}vh`,
        '--delay': `${rand(0, 600)}ms`,
        '--dur': `${rand(1100, 1700)}ms`,
      } as CSSProperties
    }),
  )
  return (
    <>
      <div className="fx-layer fx-vignette" aria-hidden />
      <div className="fx-layer fx-heat" aria-hidden />
      <div className="fx-layer" aria-hidden>
        {embers.map((style, i) => (
          <span key={i} className="fx-ember" style={style} />
        ))}
      </div>
    </>
  )
}
