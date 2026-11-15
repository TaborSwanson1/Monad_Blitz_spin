import { useEffect, useRef } from 'react'
import { prefersReducedMotion } from '../lib/themes'

// Particle fire, drawn by us. Hot white-yellow cores, orange tongues, red tips, gray
// smoke and sparks, with additive blending so overlapping flames glow. Optional burning
// bills (play money, "CHIP" notes) fly up from the fire, char and burn away.
//
// Emitters are lines in canvas pixels. The canvas sits on top of whatever is burning.

export interface Emitter {
  x0: number
  x1: number
  y: number
  /** Flame particles per frame at full intensity. */
  rate: number
  /** Base flame size in px. */
  size: number
}

interface Props {
  width: number
  height: number
  emitters: Emitter[]
  /** 0 to 1. Scales how many flames spawn. */
  intensity: number
  /** How long the fire burns, in ms. It dies down over the last ~700 ms. */
  duration: number
  /** Burning bills that fly up out of the fire. */
  bills?: number
  /** Where bills start, in canvas px. Defaults to the first emitter's middle. */
  billFrom?: { x: number; y: number }
  /** Draw everything this many times larger. Coordinates stay in base px. */
  scale?: number
  className?: string
}

// Pre-rendered soft sprites, tinted. Drawing images is much cheaper than gradients per particle.
function sprite(inner: string, mid: string, outer: string, size = 64) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')!
  const r = size / 2
  const grad = g.createRadialGradient(r, r, 0, r, r, r)
  grad.addColorStop(0, inner)
  grad.addColorStop(0.4, mid)
  grad.addColorStop(1, outer)
  g.fillStyle = grad
  g.fillRect(0, 0, size, size)
  return c
}

function billSprite() {
  const c = document.createElement('canvas')
  c.width = 60
  c.height = 28
  const g = c.getContext('2d')!
  g.fillStyle = '#c9dcb8'
  g.fillRect(0, 0, 60, 28)
  g.strokeStyle = '#4c7a44'
  g.lineWidth = 2
  g.strokeRect(2, 2, 56, 24)
  g.strokeRect(5, 5, 50, 18)
  g.fillStyle = '#7fa572'
  g.beginPath()
  g.ellipse(30, 14, 8, 7, 0, 0, Math.PI * 2)
  g.fill()
  g.fillStyle = '#2f5a2a'
  g.font = 'bold 7px sans-serif'
  g.fillText('CHIP', 8, 12)
  g.fillText('100', 40, 22)
  return c
}

type P = { x: number; y: number; vx: number; vy: number; age: number; max: number; size: number; kind: 0 | 1 | 2; seed: number }
type Bill = { x: number; y: number; vx: number; vy: number; rot: number; vr: number; char: number; born: number; s: number }

export function FireCanvas({ width, height, emitters, intensity, duration, bills = 0, billFrom, scale = 1, className }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx || prefersReducedMotion()) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = width * scale * dpr
    canvas.height = height * scale * dpr
    ctx.scale(dpr * scale, dpr * scale)

    // Flame color by age: white-hot, yellow, orange, red, gone.
    const flames = [
      sprite('rgba(255,250,225,1)', 'rgba(255,214,110,0.75)', 'rgba(255,140,30,0)'),
      sprite('rgba(255,224,130,0.95)', 'rgba(255,150,40,0.6)', 'rgba(230,80,20,0)'),
      sprite('rgba(255,150,50,0.85)', 'rgba(220,70,20,0.45)', 'rgba(150,30,10,0)'),
      sprite('rgba(200,70,25,0.6)', 'rgba(120,30,10,0.25)', 'rgba(60,15,5,0)'),
    ]
    const smoke = sprite('rgba(70,62,58,0.55)', 'rgba(50,45,42,0.25)', 'rgba(30,28,26,0)')
    const spark = sprite('rgba(255,250,210,1)', 'rgba(255,190,80,0.8)', 'rgba(255,120,20,0)', 16)
    const note = billSprite()

    const ps: P[] = []
    const from = billFrom ?? (emitters[0] ? { x: (emitters[0].x0 + emitters[0].x1) / 2, y: emitters[0].y } : { x: width / 2, y: height / 2 })
    const bs: Bill[] = Array.from({ length: bills }, (_, i) => ({
      x: from.x + (Math.random() - 0.5) * 30,
      y: from.y,
      vx: (Math.random() - 0.5) * 1.6,
      vy: -(1.2 + Math.random() * 1.3),
      rot: (Math.random() - 0.5) * 0.8,
      vr: (Math.random() - 0.5) * 0.06,
      char: 0,
      born: 150 + i * 160,
      s: 0.55 + Math.random() * 0.35,
    }))

    const spawn = (x: number, y: number, size: number, kindRoll = Math.random()) => {
      const kind: 0 | 1 | 2 = kindRoll < 0.8 ? 0 : kindRoll < 0.94 ? 1 : 2
      ps.push({
        x,
        y,
        vx: (Math.random() - 0.5) * (kind === 2 ? 2.4 : 0.5),
        vy: -(kind === 1 ? 0.6 + Math.random() * 0.6 : kind === 2 ? 1.5 + Math.random() * 2 : 0.9 + Math.random() * 1.4),
        age: 0,
        max: kind === 1 ? 70 + Math.random() * 40 : kind === 2 ? 40 + Math.random() * 30 : 26 + Math.random() * 22,
        size: size * (kind === 1 ? 1.6 : kind === 2 ? 0.12 : 0.6 + Math.random() * 0.7),
        kind,
        seed: Math.random() * 100,
      })
    }

    const t0 = performance.now()
    let raf = 0
    const frame = (now: number) => {
      const t = now - t0
      ctx.clearRect(0, 0, width, height)
      // Spawn rate ramps up over 300 ms and dies down over the last 700 ms.
      const ramp = Math.min(1, t / 300) * Math.max(0, Math.min(1, (duration - t) / 700))
      for (const e of emitters) {
        const n = e.rate * (0.35 + 0.65 * intensity) * ramp
        const whole = Math.floor(n) + (Math.random() < n % 1 ? 1 : 0)
        for (let i = 0; i < whole; i++) spawn(e.x0 + Math.random() * (e.x1 - e.x0), e.y + (Math.random() - 0.5) * 4, e.size)
      }

      // Bills: rise, tumble, char from the edge, trail flame, burn away.
      for (const b of bs) {
        if (t < b.born || b.char >= 1) continue
        b.x += b.vx + Math.sin((t + b.born) * 0.004) * 0.5
        b.y += b.vy
        b.vy *= 0.995
        b.rot += b.vr
        b.char = Math.min(1, b.char + 0.009)
        if (Math.random() < 0.7) spawn(b.x + (Math.random() - 0.5) * 18 * b.s, b.y + 6 * b.s, 16, Math.random() * 0.9)
      }

      // Smoke first (normal blending), then flame and sparks on top (additive).
      ctx.globalCompositeOperation = 'source-over'
      for (const p of ps) {
        if (p.kind !== 1) continue
        const k = p.age / p.max
        ctx.globalAlpha = Math.sin(Math.PI * k) * 0.7
        const s = p.size * (1 + k * 1.8)
        ctx.drawImage(smoke, p.x - s / 2, p.y - s / 2, s, s)
      }
      for (const b of bs) {
        if (t < b.born || b.char >= 1) continue
        ctx.save()
        ctx.translate(b.x, b.y)
        ctx.rotate(b.rot)
        ctx.globalAlpha = 1 - Math.max(0, (b.char - 0.75) / 0.25)
        const w = note.width * b.s
        const h = note.height * b.s
        ctx.drawImage(note, -w / 2, -h / 2, w, h)
        // Char spreads from the bottom edge up.
        ctx.fillStyle = `rgba(28,14,6,${Math.min(0.95, b.char * 1.2)})`
        ctx.fillRect(-w / 2, h / 2 - h * b.char * 1.1, w, h * b.char * 1.1)
        ctx.restore()
      }
      ctx.globalCompositeOperation = 'lighter'
      for (let i = ps.length - 1; i >= 0; i--) {
        const p = ps[i]
        p.age++
        if (p.age >= p.max) {
          ps.splice(i, 1)
          continue
        }
        p.vx += Math.sin(p.y * 0.06 + p.seed + t * 0.004) * 0.05
        p.x += p.vx
        p.y += p.vy
        if (p.kind === 1) continue
        const k = p.age / p.max
        if (p.kind === 2) {
          ctx.globalAlpha = 1 - k
          const s = 6
          ctx.drawImage(spark, p.x - s / 2, p.y - s / 2, s, s)
          continue
        }
        ctx.globalAlpha = 1 - k * 0.6
        const s = p.size * (1 - k * 0.55)
        ctx.drawImage(flames[Math.min(3, Math.floor(k * 4))], p.x - s / 2, p.y - s / 2, s, s)
      }
      ctx.globalCompositeOperation = 'source-over'
      ctx.globalAlpha = 1
      if (t < duration + 1500) raf = requestAnimationFrame(frame)
      else ctx.clearRect(0, 0, width, height)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [width, height, emitters, intensity, duration, bills, billFrom, scale])

  return <canvas ref={ref} className={className} style={{ width: width * scale, height: height * scale }} aria-hidden />
}
