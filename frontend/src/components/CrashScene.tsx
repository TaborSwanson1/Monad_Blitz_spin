import { useState, type CSSProperties } from 'react'

// Background for the crash replay: a flight from the ground up into space.
//
// Everything here is a function of the multiplier ON SCREEN right now, never the crash
// point, so the scene can't give the result away before the replay reaches it.
//   below 5x   ground level: grass, a launch pad, a small skyline
//   5x to 20x  atmosphere: the sky darkens and clouds stream past
//   20x and up space: black sky, stars, a planet drifting into view

const LN5 = Math.log(5)
const LN20 = Math.log(20)
const LN100 = Math.log(100)

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/** Sky colours (top, bottom) at altitudes ln(mult). */
const SKY: [number, [number, number, number], [number, number, number]][] = [
  [0, [74, 168, 255], [191, 230, 255]],
  [LN5, [31, 95, 191], [111, 176, 232]],
  [LN20, [10, 20, 64], [36, 53, 122]],
  [LN100, [2, 3, 10], [10, 11, 31]],
]

function skyAt(h: number): string {
  let i = 0
  while (i < SKY.length - 2 && h > SKY[i + 1][0]) i++
  const [h0, t0, b0] = SKY[i]
  const [h1, t1, b1] = SKY[i + 1]
  const k = clamp01((h - h0) / (h1 - h0))
  const mix = (a: number[], b: number[]) => `rgb(${a.map((v, j) => Math.round(lerp(v, b[j], k))).join(' ')})`
  return `linear-gradient(180deg, ${mix(t0, t1)} 0%, ${mix(b0, b1)} 100%)`
}

export function zoneOf(mult: number): 'Ground' | 'Atmosphere' | 'Space' {
  return mult < 5 ? 'Ground' : mult < 20 ? 'Atmosphere' : 'Space'
}

const rand = (a: number, b: number) => a + Math.random() * (b - a)

export function CrashScene({ mult, crashed }: { mult: number; crashed: boolean }) {
  const [clouds] = useState(() =>
    Array.from({ length: 9 }, (_, i) => ({
      at: (i + 0.5) / 9, // where in the atmosphere this cloud sits
      left: rand(-10, 80),
      w: rand(60, 120),
      o: rand(0.55, 0.9),
    })),
  )
  const [stars] = useState(() =>
    Array.from({ length: 70 }, () => ({ left: rand(0, 100), top: rand(0, 100), s: rand(1, 2.6), d: rand(0, 3) })),
  )

  const h = Math.log(Math.max(1, mult))
  const ground = clamp01(h / LN5) // 0 on the pad, 1 at 5x
  const atmos = clamp01((h - Math.log(4)) / (Math.log(25) - Math.log(4))) // clouds from 4x to 25x
  const space = clamp01((h - LN20) / (LN100 - LN20)) // 0 at 20x, 1 at 100x

  // The ground sinks out of view as the rocket climbs, gone by 5x.
  const groundY = Math.pow(ground, 1.6) * 105
  const starOpacity = clamp01((h - Math.log(12)) / (LN20 - Math.log(12))) // fade in from 12x, full at 20x
  const planetY = lerp(-60, 18, space)

  return (
    <div className={`crash-scene ${crashed ? 'is-crashed' : ''}`} style={{ background: skyAt(h) }} aria-hidden>
      <div className="cs-stars" style={{ opacity: starOpacity, transform: `translateY(${space * 12}%)` }}>
        {stars.map((s, i) => (
          <span
            key={i}
            className="cs-star"
            style={{ left: `${s.left}%`, top: `${s.top}%`, width: s.s, height: s.s, animationDelay: `${s.d}s` } as CSSProperties}
          />
        ))}
      </div>

      {space > 0 && (
        <div className="cs-planet" style={{ top: `${planetY}%` }}>
          <div className="cs-planet-ring" />
        </div>
      )}

      {atmos > 0 && atmos < 1 &&
        clouds.map((c, i) => {
          const y = (atmos - c.at) * 260 + 40 // streams top to bottom as the rocket climbs
          if (y < -40 || y > 130) return null
          return <span key={i} className="cs-cloud" style={{ top: `${y}%`, left: `${c.left}%`, width: c.w, opacity: c.o }} />
        })}

      {groundY < 105 && (
        <svg className="cs-ground" viewBox="0 0 320 70" preserveAspectRatio="none" style={{ transform: `translateY(${groundY}%)` }}>
          <path d="M0 40 Q 40 22 80 36 T 170 30 T 260 34 T 320 28 V70 H0 Z" fill="#4c9a5a" />
          <path d="M0 48 Q 60 36 120 46 T 240 44 T 320 42 V70 H0 Z" fill="#3b7f48" />
          <g fill="#2c3550" opacity="0.85">
            <rect x="214" y="22" width="12" height="24" />
            <rect x="228" y="14" width="9" height="32" />
            <rect x="239" y="26" width="14" height="20" />
            <rect x="255" y="18" width="8" height="28" />
            <rect x="265" y="28" width="12" height="18" />
          </g>
          <g fill="#2f6b3b">
            <circle cx="140" cy="42" r="6" />
            <circle cx="152" cy="44" r="5" />
            <circle cx="296" cy="38" r="6" />
          </g>
          <rect x="0" y="52" width="40" height="5" fill="#9aa3b5" />
          <rect x="6" y="40" width="3" height="12" fill="#c8ced9" />
          <rect x="0" y="57" width="320" height="13" fill="#2e6a3a" />
        </svg>
      )}
    </div>
  )
}
