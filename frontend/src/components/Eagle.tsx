import { useEffect, useRef } from 'react'
import { prefersReducedMotion } from '../lib/themes'
import { Fireworks } from './Fireworks'
import { FlagRow } from './Flags'

// Americana BIG win effect (stake >= BIG_STAKE and the round is a net win).
//
// A mascot-style bald eagle, drawn by us in a three-quarter view: bold outlines, three
// shading tones, layered feathers, a big golden eye and a determined brow. Both wings
// flap around the shoulder (the near wing foreshortens on the downstroke) and the body
// bobs on each downbeat.
//
// Flight: one pass left to right through the open strip BELOW the result card, so it
// never covers the result. It flaps in, swoops down into a short glide with wings held,
// then flaps back up and out. Flags wave along the bottom and fireworks go off behind.

const DURATION = 3600
const FLAP_MS = 340
const GLIDE: [number, number] = [1350, 2050] // ms window where the wings are held

const INK = '#1b1007'

// Wing drawn spread up and back from the shoulder at (150, 100).
const WING = 'M150 100 C132 70 104 46 70 34 C56 30 40 30 28 34 L18 30 L30 44 L12 46 L32 56 L10 64 L36 70 L16 82 L44 82 L30 96 L60 92 C84 104 112 112 140 116 Z'
const WING_PRIMARIES = 'M28 34 L18 30 L30 44 L12 46 L32 56 L10 64 L36 70 L16 82 L44 82 L30 96 L60 92 C58 76 54 58 46 42 Z'
const WING_COVERTS = 'M148 102 C130 76 106 56 78 46 C66 42 56 42 48 46 C70 56 96 74 116 92 C126 100 136 106 144 110 Z'
const WING_LINES = 'M60 92 L84 70 M78 98 L100 76 M98 104 L116 84 M118 110 L132 92'

function Wing({ far = false }: { far?: boolean }) {
  return (
    <>
      <path d={WING} fill={far ? 'url(#eg-wing-far)' : 'url(#eg-wing)'} stroke={INK} strokeWidth={3} strokeLinejoin="round" />
      <path d={WING_PRIMARIES} fill={far ? '#26160a' : '#3a2212'} />
      <path d={WING_COVERTS} fill={far ? '#5a3a1e' : 'url(#eg-coverts)'} />
      {!far && <path d="M140 98 C124 76 104 60 82 50" stroke="#f3c98d" strokeWidth={3} strokeLinecap="round" fill="none" opacity={0.75} />}
      <path d={WING_LINES} stroke={INK} strokeWidth={2} strokeLinecap="round" fill="none" opacity={0.7} />
      <path d={WING} fill="none" stroke={INK} strokeWidth={3} strokeLinejoin="round" />
    </>
  )
}

function EagleArt() {
  return (
    <svg className="eagle-art" viewBox="0 0 290 200" overflow="visible">
      <defs>
        {/* Slot-machine finish: lit from the top-left, glossy highlights, deep shadows. */}
        <linearGradient id="eg-wing" x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0" stopColor="#8a5530" />
          <stop offset="0.55" stopColor="#5a3519" />
          <stop offset="1" stopColor="#331d0c" />
        </linearGradient>
        <linearGradient id="eg-wing-far" x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0" stopColor="#5c3a1e" />
          <stop offset="1" stopColor="#24140a" />
        </linearGradient>
        <linearGradient id="eg-coverts" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#c4884a" />
          <stop offset="1" stopColor="#8a5a30" />
        </linearGradient>
        <radialGradient id="eg-body" cx="0.6" cy="0.25" r="0.85">
          <stop offset="0" stopColor="#8f5a31" />
          <stop offset="0.6" stopColor="#5a3519" />
          <stop offset="1" stopColor="#2e1a0b" />
        </radialGradient>
        <radialGradient id="eg-head" cx="0.42" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.7" stopColor="#f2eee6" />
          <stop offset="1" stopColor="#cfc6b6" />
        </radialGradient>
        <linearGradient id="eg-beak" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffd75a" />
          <stop offset="0.6" stopColor="#f5b21a" />
          <stop offset="1" stopColor="#c97f08" />
        </linearGradient>
        <radialGradient id="eg-iris" cx="0.4" cy="0.35" r="0.7">
          <stop offset="0" stopColor="#ffe48a" />
          <stop offset="1" stopColor="#d99a12" />
        </radialGradient>
      </defs>
      {/* Far wing, behind the body: smaller and darker. */}
      <g className="wing-far">
        <g transform="translate(34 -14) scale(0.74)">
          <Wing far />
        </g>
      </g>

      <g className="eagle-bodygroup">
        {/* Tail */}
        <path d="M104 124 L56 112 L48 120 L42 116 L36 128 L44 132 L38 140 L50 142 L46 150 L104 140 Z" fill="#f4f1ea" stroke={INK} strokeWidth={3} strokeLinejoin="round" />
        <path d="M100 130 L52 126 M100 136 L56 144" stroke="#cfc7b8" strokeWidth={2} fill="none" />
        {/* Body with shading */}
        <path d="M100 118 C112 92 150 86 182 92 C204 96 214 116 206 136 C196 160 160 168 130 160 C112 156 98 140 100 118 Z" fill="url(#eg-body)" stroke={INK} strokeWidth={3} />
        <path d="M120 150 C140 162 176 160 196 142 C192 156 168 168 136 164 C124 162 118 158 120 150 Z" fill="#3f2410" />
        <path d="M170 98 C188 100 200 110 202 124 C194 116 182 108 168 104 Z" fill="#7a4a28" />
        {/* Talons tucked under */}
        <path d="M150 158 C152 170 156 176 162 178 M168 156 C170 168 174 174 180 176" stroke="#e8a317" strokeWidth={7} strokeLinecap="round" fill="none" />
        <path d="M150 158 C152 170 156 176 162 178 M168 156 C170 168 174 174 180 176" stroke={INK} strokeWidth={1.5} strokeLinecap="round" fill="none" opacity={0.6} />
        <path d="M160 178 l6 2 M178 176 l6 2" stroke={INK} strokeWidth={3} strokeLinecap="round" />
        {/* Head: white with a jagged neck ruff, shaded underneath */}
        <path d="M180 100 L176 88 L184 92 L182 78 L192 86 L194 70 C200 58 214 52 228 56 C246 60 254 74 250 90 C246 104 232 112 216 112 C204 112 194 108 186 104 Z" fill="url(#eg-head)" stroke={INK} strokeWidth={3} strokeLinejoin="round" />
        <path d="M190 104 C206 112 230 112 246 98 C240 110 224 116 208 114 C200 113 194 110 190 104 Z" fill="#dcd5c8" />
        {/* Hooked beak */}
        <path d="M244 74 C258 72 272 78 276 90 C278 98 272 102 266 98 C266 92 260 88 252 90 L246 92 Z" fill="url(#eg-beak)" stroke={INK} strokeWidth={3} strokeLinejoin="round" />
        <path d="M246 92 L262 94 C262 98 256 102 248 100 Z" fill="#e09a0e" stroke={INK} strokeWidth={2.5} strokeLinejoin="round" />
        <circle cx="258" cy="80" r="1.8" fill={INK} />
        <path d="M250 76 C258 75 266 78 270 84" stroke="#fff6cf" strokeWidth={2.5} strokeLinecap="round" fill="none" />
        <path d="M206 64 C212 60 220 58 228 59" stroke="#fff" strokeWidth={3} strokeLinecap="round" fill="none" opacity={0.9} />
        {/* Eye with highlight and a determined brow */}
        <ellipse cx="229" cy="77" rx="9" ry="8" fill="#fff" stroke={INK} strokeWidth={2.5} />
        <circle cx="232" cy="78" r="5.5" fill="url(#eg-iris)" />
        <circle cx="233" cy="78" r="3.2" fill="#111" />
        <circle cx="235" cy="75.5" r="2" fill="#fff" />
        <circle cx="230" cy="80.5" r="0.9" fill="#fff" opacity={0.8} />
        <path d="M213 66 L243 71 L241 76 L213 71 Z" fill={INK} />
      </g>

      {/* Near wing, in front of the body */}
      <g className="wing-near">
        <Wing />
      </g>
    </svg>
  )
}

/** Wing and body keyframes for the whole flight: flap, hold during the glide, flap. */
function flightFrames() {
  const near: Keyframe[] = []
  const far: Keyframe[] = []
  const body: Keyframe[] = []
  let down = false
  for (let t = 0; t <= DURATION; t += FLAP_MS / 2) {
    const offset = t / DURATION
    const gliding = t >= GLIDE[0] && t <= GLIDE[1]
    if (gliding) {
      near.push({ offset, transform: 'rotate(-10deg) scaleY(1)' })
      far.push({ offset, transform: 'rotate(-8deg)' })
      body.push({ offset, transform: 'translateY(0px)' })
    } else {
      near.push({ offset, transform: down ? 'rotate(32deg) scaleY(0.72)' : 'rotate(-40deg) scaleY(1)' })
      far.push({ offset, transform: down ? 'rotate(26deg)' : 'rotate(-32deg)' })
      body.push({ offset, transform: down ? 'translateY(-6px)' : 'translateY(2px)' })
      down = !down
    }
  }
  return { near, far, body }
}

// Four-point sparkle, like the glints on slot-machine symbols.
function sparkle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.moveTo(x, y - r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.quadraticCurveTo(x, y, x, y + r)
  ctx.quadraticCurveTo(x, y, x - r, y)
  ctx.quadraticCurveTo(x, y, x, y - r)
  ctx.fill()
}

/** Slot-style "BIG WIN" marquee with chasing bulbs, placed just above the result card. */
function BigWinMarquee() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    const card = document.querySelector('.reveal-card')?.getBoundingClientRect()
    if (!el || !card) return
    const h = el.getBoundingClientRect().height
    el.style.top = `${Math.max(8, card.top - h - 12)}px`
  }, [])
  const bulbs = 28
  return (
    <div className="bigwin" ref={ref} aria-hidden>
      <div className="bigwin-bulbs">
        {Array.from({ length: bulbs }, (_, i) => (
          <span key={i} className="bulb" style={{ '--i': i, '--n': bulbs } as React.CSSProperties} />
        ))}
      </div>
      <div className="bigwin-text">BIG WIN</div>
    </div>
  )
}

export function Eagle() {
  const mover = useRef<HTMLDivElement>(null)
  const trail = useRef<HTMLCanvasElement>(null)
  const reduced = prefersReducedMotion()

  useEffect(() => {
    const el = mover.current
    if (!el || reduced) return
    const vw = window.innerWidth
    const vh = window.innerHeight
    const w = Math.max(170, Math.min(300, vw * 0.22))
    const h = (w * 200) / 290
    el.style.width = `${w}px`

    // Find the open strip below the result card.
    const card = document.querySelector('.reveal-card')?.getBoundingClientRect()
    const cardBottom = card ? card.bottom : vh * 0.6
    const top = Math.min(cardBottom + 14, vh - h - 24) // eagle's top edge
    const dip = Math.min(48, Math.max(12, vh - (top + h) - 10))

    const x = (p: number) => -w * 1.2 + p * (vw + w * 2.4)
    const path: Keyframe[] = [
      { offset: 0, transform: `translate(${x(0)}px, ${top}px) rotate(-4deg)` },
      { offset: 0.3, transform: `translate(${x(0.3)}px, ${top + 6}px) rotate(4deg)` },
      { offset: 0.47, transform: `translate(${x(0.47)}px, ${top + dip}px) rotate(9deg)` },
      { offset: 0.6, transform: `translate(${x(0.6)}px, ${top + dip * 0.6}px) rotate(-3deg)` },
      { offset: 1, transform: `translate(${x(1)}px, ${top - 18}px) rotate(-9deg)` },
    ]
    const { near, far, body } = flightFrames()
    const opts: KeyframeAnimationOptions = { duration: DURATION, fill: 'forwards' }
    const anims = [
      el.animate(path, { ...opts, easing: 'cubic-bezier(.35,.1,.45,1)' }),
      el.querySelector('.wing-near')?.animate(near, opts),
      el.querySelector('.wing-far')?.animate(far, opts),
      el.querySelector('.eagle-bodygroup')?.animate(body, opts),
    ]

    // Sparkle trail streaming off the tail as it flies.
    const canvas = trail.current
    const ctx = canvas?.getContext('2d')
    let raf = 0
    if (canvas && ctx) {
      const dpr = window.devicePixelRatio || 1
      canvas.width = vw * dpr
      canvas.height = vh * dpr
      ctx.scale(dpr, dpr)
      type S = { x: number; y: number; vx: number; vy: number; born: number; r: number; c: string }
      const ss: S[] = []
      const colors = ['#ffe27a', '#fff6d6', '#ffd23f', '#ffffff']
      const t0 = performance.now()
      const frame = (now: number) => {
        const t = now - t0
        ctx.clearRect(0, 0, vw, vh)
        const r = el.getBoundingClientRect()
        if (t < DURATION) {
          for (let i = 0; i < 2; i++) {
            ss.push({
              x: r.left + r.width * (0.12 + Math.random() * 0.1),
              y: r.top + r.height * (0.55 + Math.random() * 0.2),
              vx: -0.6 - Math.random() * 1.2,
              vy: (Math.random() - 0.5) * 0.8,
              born: t,
              r: 4 + Math.random() * 6,
              c: colors[(Math.random() * colors.length) | 0],
            })
          }
        }
        for (let i = ss.length - 1; i >= 0; i--) {
          const p = ss[i]
          const k = (t - p.born) / 700
          if (k >= 1) {
            ss.splice(i, 1)
            continue
          }
          p.x += p.vx
          p.y += p.vy
          ctx.globalAlpha = 1 - k
          sparkle(ctx, p.x, p.y, p.r * (1 - k * 0.5), p.c)
        }
        ctx.globalAlpha = 1
        if (t < DURATION + 800) raf = requestAnimationFrame(frame)
      }
      raf = requestAnimationFrame(frame)
    }
    return () => {
      anims.forEach((a) => a?.cancel())
      cancelAnimationFrame(raf)
    }
  }, [reduced])

  if (reduced) return null
  return (
    <>
      <Fireworks intensity={1} duration={3600} />
      <FlagRow />
      <BigWinMarquee />
      <div className="eagle-flight" aria-hidden>
        <canvas className="eagle-trail" ref={trail} />
        <div className="eagle-mover" ref={mover}>
          <EagleArt />
        </div>
      </div>
    </>
  )
}
