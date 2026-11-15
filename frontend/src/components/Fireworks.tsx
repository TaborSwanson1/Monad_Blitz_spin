import { useEffect, useRef } from 'react'
import { prefersReducedMotion } from '../lib/themes'
import { makeGlowSprite } from './MonadTokens'

// Americana win effect, drawn by us:
//  1. Red, white and blue rockets launch from the bottom of the screen with glowing
//     spark trails, climb, and burst. They keep coming in salvos for as long as the
//     result popup is open.
//  2. Right after the first bursts, purple Monad tokens fly out of the result popup in
//     every direction. They bounce around the screen and stay until the popup closes.
// The canvas sits behind the result card, so the result stays readable and the tokens
// look like they burst out from behind the popup.
// `intensity` (0 to 1) comes from revealIntensity(): more rockets and tokens for a bigger win.
// Reduced motion (or Motion off) paints one still picture: bursts frozen mid-air and
// tokens scattered around the popup.

const COLORS = ['#e0162b', '#f5f3ee', '#2f6bff', '#ffd166']
const RISE_MS = 700
const TOKENS_AT = 950
const SALVO_MS = 1700

interface Rocket {
  x0: number
  x1: number
  y1: number
  launch: number
  color: string
}
interface Spark {
  x: number
  y: number
  vx: number
  vy: number
  c: string
  born: number
  life: number
  s: number
}

export function Fireworks({ intensity }: { intensity: number }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const W = innerWidth
    const H = innerHeight
    canvas.width = W * dpr
    canvas.height = H * dpr
    ctx.scale(dpr, dpr)

    // Sized to the screen so it reads as big on a laptop and still fits a phone.
    const big = Math.max(1, Math.min(1.8, W / 800))
    const sprite = makeGlowSprite(64)
    // Laid-out box: the card is still scaling up as it pops in.
    const el = document.querySelector<HTMLElement>('.reveal-card')
    const card = el ? { width: el.offsetWidth, height: el.offsetHeight } : null
    const cx = el ? el.offsetLeft + el.offsetWidth / 2 : W / 2
    const cy = el ? el.offsetTop + el.offsetHeight / 2 : H / 2

    if (prefersReducedMotion()) {
      // Still picture: a few frozen bursts and a ring of tokens around the popup.
      const n = Math.round(4 + 4 * intensity)
      for (let b = 0; b < n; b++) {
        const x = W * (0.1 + (0.8 * (b + 0.5)) / n)
        const y = H * (0.14 + 0.2 * ((b * 37) % 10) * 0.1)
        ctx.fillStyle = COLORS[b % COLORS.length]
        for (let i = 0; i < 44; i++) {
          const a = (i / 44) * Math.PI * 2
          for (const r of [38, 62, 84]) ctx.fillRect(x + Math.cos(a) * r * big, y + Math.sin(a) * r * big, 3.5 * big, 3.5 * big)
        }
      }
      const tokens = Math.round(10 + 14 * intensity)
      for (let i = 0; i < tokens; i++) {
        const a = (i / tokens) * Math.PI * 2
        const r = (card ? Math.max(card.width, card.height) / 2 : 220) + 40 + ((i * 53) % 70)
        const s = 30 * big
        ctx.drawImage(sprite, cx + Math.cos(a) * r - s / 2, cy + Math.sin(a) * r * 0.8 - s / 2, s, s)
      }
      return
    }

    const perSalvo = Math.round(6 + 10 * intensity)
    let rockets: Rocket[] = []
    const sparks: Spark[] = []
    let nextSalvo = 0
    const salvo = (now: number) => {
      for (let b = 0; b < perSalvo; b++) {
        const x = W * (0.06 + Math.random() * 0.88)
        rockets.push({
          x0: x + (Math.random() - 0.5) * 80,
          x1: x,
          y1: H * (0.08 + Math.random() * 0.42),
          launch: now + (b / perSalvo) * SALVO_MS * 0.7,
          color: COLORS[b % COLORS.length],
        })
      }
    }

    // Monad tokens burst out from behind the popup, then keep bouncing around.
    const tokens = Array.from({ length: Math.round(18 + 40 * intensity) }, () => {
      const a = Math.random() * Math.PI * 2
      const v = (5 + Math.random() * 7) * big
      return {
        x: cx,
        y: cy,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - 2 * big,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.2,
        s: (24 + Math.random() * 20) * big,
        delay: TOKENS_AT + Math.random() * 400,
      }
    })

    const t0 = performance.now()
    let raf = 0
    const frame = (t: number) => {
      const now = t - t0
      ctx.clearRect(0, 0, W, H)
      if (now >= nextSalvo) {
        salvo(now)
        nextSalvo = now + SALVO_MS
      }

      // Rockets climbing, each with a trail of sparks.
      rockets = rockets.filter((r) => {
        const k = (now - r.launch) / RISE_MS
        if (k < 0) return true
        if (k < 1) {
          const e = 1 - Math.pow(1 - k, 2)
          const x = r.x0 + (r.x1 - r.x0) * e
          const y = H + 10 - (H + 10 - r.y1) * e
          ctx.globalAlpha = 1
          ctx.fillStyle = '#fff4cc'
          ctx.beginPath()
          ctx.arc(x, y, 3 * big, 0, Math.PI * 2)
          ctx.fill()
          for (let i = 0; i < 2; i++)
            sparks.push({ x, y, vx: (Math.random() - 0.5) * 1.2, vy: 1 + Math.random() * 1.5, c: i ? r.color : '#ffb347', born: now, life: 420, s: 2.2 * big })
          return true
        }
        const n = 70 + Math.round(50 * intensity)
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2
          const v = (3 + Math.random() * 4) * big
          sparks.push({ x: r.x1, y: r.y1, vx: Math.cos(a) * v, vy: Math.sin(a) * v, c: Math.random() < 0.2 ? '#fff' : r.color, born: now, life: 1500, s: 3.6 * big })
        }
        return false
      })

      // Trails and burst sparks.
      ctx.globalCompositeOperation = 'lighter'
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
      ctx.globalCompositeOperation = 'source-over'

      // Monad tokens: out of the popup, then bouncing off the edges until it closes.
      ctx.globalAlpha = 1
      for (const k of tokens) {
        if (now < k.delay) continue
        k.x += k.vx
        k.y += k.vy
        k.vy += 0.07
        k.rot += k.vr
        const h = k.s / 2
        if (k.x < h && k.vx < 0) k.vx = -k.vx
        if (k.x > W - h && k.vx > 0) k.vx = -k.vx
        if (k.y < h && k.vy < 0) k.vy = -k.vy
        if (k.y > H - h && k.vy > 0) k.vy = -Math.max(Math.abs(k.vy) * 0.92, (5 + Math.random() * 5) * big)
        ctx.save()
        ctx.translate(k.x, k.y)
        ctx.rotate(k.rot)
        ctx.drawImage(sprite, -h, -h, k.s, k.s)
        ctx.restore()
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [intensity])

  return <canvas ref={ref} className="burst" aria-hidden />
}
