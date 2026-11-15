import { useEffect, useRef } from 'react'
import { PALETTES, onBurst, type BurstEvent } from './bus'
import { motionOff } from './prefs'

// Confetti over the whole screen when a bet goes in. It launches from the bet button,
// sprays across the page, then falls. Stars and ribbons in the game's colors: red,
// white and blue on High / Low, neon everywhere else. On top of everything, and
// clicks pass straight through it. Skipped when motion is off.

interface Bit {
  x: number
  y: number
  vx: number
  vy: number
  rot: number
  vr: number
  w: number
  h: number
  c: string
  star: boolean
  born: number
  life: number
}

export function Overlay() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    let W = 0
    let H = 0
    const resize = () => {
      W = window.innerWidth
      H = window.innerHeight
      canvas.width = W * dpr
      canvas.height = H * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    const bits: Bit[] = []
    let raf = 0
    let running = false

    const frame = (now: number) => {
      ctx.clearRect(0, 0, W, H)
      for (let i = bits.length - 1; i >= 0; i--) {
        const p = bits[i]
        const k = (now - p.born) / p.life
        if (k >= 1 || p.y > H + 40) {
          bits.splice(i, 1)
          continue
        }
        p.x += p.vx
        p.y += p.vy
        p.vx *= 0.985
        p.vy = p.vy * 0.985 + 0.16
        p.rot += p.vr
        ctx.globalAlpha = k > 0.75 ? (1 - k) / 0.25 : 1
        ctx.fillStyle = p.c
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        if (p.star) {
          ctx.beginPath()
          for (let s = 0; s < 10; s++) {
            const a = -Math.PI / 2 + (s * Math.PI) / 5
            const r = s % 2 ? p.w * 0.42 : p.w
            ctx[s ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r)
          }
          ctx.closePath()
          ctx.fill()
        } else {
          // A ribbon that flips as it falls.
          ctx.scale(1, Math.cos(p.rot * 2.3))
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
        }
        ctx.restore()
      }
      ctx.globalAlpha = 1
      if (bits.length) raf = requestAnimationFrame(frame)
      else running = false
    }

    const fire = (e: BurstEvent) => {
      if (motionOff()) return
      const colors = PALETTES[e.palette]
      const power = e.power ?? 0.6
      const x0 = e.x ?? W / 2
      const y0 = e.y ?? H / 2
      const now = performance.now()
      const n = Math.round(110 + 150 * power)
      for (let i = 0; i < n; i++) {
        // Aim across the whole screen: every direction, biased upward.
        const a = Math.random() * Math.PI * 2
        const v = 6 + Math.random() * (14 + 10 * power)
        bits.push({
          x: x0,
          y: y0,
          vx: Math.cos(a) * v * 1.25,
          vy: Math.sin(a) * v - 6,
          rot: Math.random() * Math.PI,
          vr: (Math.random() - 0.5) * 0.4,
          w: 6 + Math.random() * 9,
          h: 10 + Math.random() * 12,
          c: colors[(Math.random() * colors.length) | 0],
          star: Math.random() < 0.4,
          born: now,
          life: 1700 + Math.random() * 1300,
        })
      }
      // And a curtain from the top so the far corners get some too.
      for (let i = 0; i < n / 2; i++) {
        bits.push({
          x: Math.random() * W,
          y: -20 - Math.random() * 160,
          vx: (Math.random() - 0.5) * 3,
          vy: 2 + Math.random() * 5,
          rot: Math.random() * Math.PI,
          vr: (Math.random() - 0.5) * 0.35,
          w: 6 + Math.random() * 8,
          h: 10 + Math.random() * 12,
          c: colors[(Math.random() * colors.length) | 0],
          star: Math.random() < 0.4,
          born: now + Math.random() * 250,
          life: 2400 + Math.random() * 1200,
        })
      }
      if (!running) {
        running = true
        raf = requestAnimationFrame(frame)
      }
    }

    const off = onBurst(fire)
    return () => {
      off()
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return <canvas ref={ref} className="fx-overlay" aria-hidden />
}
