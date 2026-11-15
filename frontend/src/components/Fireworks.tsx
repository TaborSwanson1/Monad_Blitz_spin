import { useEffect, useRef } from 'react'
import { prefersReducedMotion } from '../lib/themes'
import { makeSprite } from './MonadTokens'

// Americana win effect, drawn by us:
//  1. Red, white and blue rockets launch from the bottom of the screen with glowing
//     trails, climb, and explode into bursts.
//  2. Right after the first bursts, Monad tokens fly out of the result popup in every
//     direction and fall away with gravity.
// The canvas sits behind the result card, so the result stays readable and the tokens
// look like they burst out from behind the popup.
// `intensity` (0 to 1) comes from revealIntensity(): more rockets and tokens for a bigger win.

const COLORS = ['#c8102e', '#f5f3ee', '#3c6be0', '#ffd166']
const RISE_MS = 700
const TOKENS_AT = 950

export function Fireworks({ intensity, duration = 3200 }: { intensity: number; duration?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx || prefersReducedMotion()) return

    const dpr = window.devicePixelRatio || 1
    const W = innerWidth
    const H = innerHeight
    canvas.width = W * dpr
    canvas.height = H * dpr
    ctx.scale(dpr, dpr)

    // Sized to the screen so it reads as big on a laptop and still fits a phone.
    const big = Math.max(1, Math.min(1.8, W / 800))

    // Rockets: launch from the bottom, climb to a burst point.
    const rocketCount = Math.round(4 + 6 * intensity)
    const rockets = Array.from({ length: rocketCount }, (_, b) => {
      const x = W * (0.08 + Math.random() * 0.84)
      return {
        x0: x + (Math.random() - 0.5) * 60,
        x1: x,
        y1: H * (0.1 + Math.random() * 0.4),
        launch: (b / rocketCount) * duration * 0.4,
        color: COLORS[b % COLORS.length],
        burst: false,
      }
    })
    type P = { x: number; y: number; vx: number; vy: number; c: string; born: number; life: number; s: number }
    const sparks: P[] = []

    // Monad tokens burst out from the middle of the screen, where the popup is.
    const sprite = makeSprite(64)
    const tokens = Array.from({ length: Math.round(16 + 34 * intensity) }, () => {
      const a = Math.random() * Math.PI * 2
      const v = (4 + Math.random() * 6) * big
      return {
        x: W / 2,
        y: H / 2,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - 3 * big,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.2,
        s: (22 + Math.random() * 18) * big,
        delay: TOKENS_AT + Math.random() * 350,
      }
    })

    const t0 = performance.now()
    let raf = 0
    const frame = (t: number) => {
      const now = t - t0
      ctx.clearRect(0, 0, W, H)
      if (now >= duration + 1200) return

      // Rockets climbing, with a trail.
      for (const r of rockets) {
        const k = (now - r.launch) / RISE_MS
        if (k < 0) continue
        if (k < 1) {
          const e = 1 - Math.pow(1 - k, 2)
          const x = r.x0 + (r.x1 - r.x0) * e
          const y = H + 10 - (H + 10 - r.y1) * e
          ctx.globalAlpha = 1
          ctx.fillStyle = '#fff4cc'
          ctx.beginPath()
          ctx.arc(x, y, 2.6 * big, 0, Math.PI * 2)
          ctx.fill()
          sparks.push({ x, y, vx: (Math.random() - 0.5) * 0.6, vy: 1 + Math.random(), c: '#ffb347', born: now, life: 380, s: 2 * big })
        } else if (!r.burst) {
          r.burst = true
          const n = 60 + Math.round(40 * intensity)
          for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2
            const v = (3 + Math.random() * 3.6) * big
            sparks.push({ x: r.x1, y: r.y1, vx: Math.cos(a) * v, vy: Math.sin(a) * v, c: Math.random() < 0.2 ? '#fff' : r.color, born: now, life: 1500, s: 3.6 * big })
          }
        }
      }

      // Trails and burst sparks.
      for (let i = sparks.length - 1; i >= 0; i--) {
        const p = sparks[i]
        const age = now - p.born
        if (age > p.life) {
          sparks.splice(i, 1)
          continue
        }
        p.x += p.vx
        p.y += p.vy
        p.vx *= 0.975
        p.vy = p.vy * 0.975 + 0.05
        ctx.globalAlpha = Math.max(0, 1 - age / p.life)
        ctx.fillStyle = p.c
        ctx.fillRect(p.x, p.y, p.s, p.s)
      }

      // Monad tokens flying out of the popup.
      for (const k of tokens) {
        if (now < k.delay) continue
        k.x += k.vx
        k.y += k.vy
        k.vx *= 0.99
        k.vy += 0.22
        k.rot += k.vr
        ctx.globalAlpha = Math.max(0, Math.min(1, (duration + 1200 - now) / 600))
        ctx.save()
        ctx.translate(k.x, k.y)
        ctx.rotate(k.rot)
        ctx.drawImage(sprite, -k.s / 2, -k.s / 2, k.s, k.s)
        ctx.restore()
      }
      ctx.globalAlpha = 1
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [intensity, duration])

  return <canvas ref={ref} className="burst" aria-hidden />
}
