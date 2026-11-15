import { useEffect, useRef } from 'react'
import { PALETTES, type Palette } from './bus'
import { motionOff, useFxPrefs } from './prefs'

// The animated background behind every screen except the slot demo, drawn by us on a
// canvas. It follows the cursor: a spotlight sits under the pointer, the drifting
// lights lean away from it for depth, and moving the pointer leaves a sparkle trail.
// A click throws a small ring of sparks.
//
//  vegas      purple-to-magenta night, drifting neon lights, card suits, searchlights
//  americana  navy sky, twinkling stars, a huge slow-waving flag, red/white/blue beams
//
// It also publishes the pointer position as CSS variables (--mx, --my from 0 to 1 and
// --mxpx, --mypx in pixels) so cards can show a sheen that follows the cursor.
// With motion off it paints one still frame and stops.

export type BackdropMode = Palette | 'off'

interface Spark {
  x: number
  y: number
  vx: number
  vy: number
  born: number
  life: number
  r: number
  c: string
  rot: number
}

function glowSprite(color: string, size = 256) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')!
  const r = size / 2
  const grad = g.createRadialGradient(r, r, 0, r, r, r)
  grad.addColorStop(0, color)
  grad.addColorStop(0.35, color + 'aa')
  grad.addColorStop(1, color + '00')
  g.fillStyle = grad
  g.fillRect(0, 0, size, size)
  return c
}

function star(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, points: number, rot: number) {
  const inner = points === 4 ? 0.28 : 0.42
  ctx.beginPath()
  for (let k = 0; k < points * 2; k++) {
    const a = rot - Math.PI / 2 + (k * Math.PI) / points
    const rr = k % 2 ? r * inner : r
    ctx[k ? 'lineTo' : 'moveTo'](x + Math.cos(a) * rr, y + Math.sin(a) * rr)
  }
  ctx.closePath()
  ctx.fill()
}

const SUITS = ['♠', '♥', '♦', '♣', '★', '7']

export function Backdrop({ mode }: { mode: BackdropMode }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const { motion } = useFxPrefs()

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx || mode === 'off') return
    const still = motionOff()
    const colors = PALETTES[mode]
    const americana = mode === 'americana'
    const root = document.documentElement

    let W = 0
    let H = 0
    const dpr = Math.min(1.5, window.devicePixelRatio || 1)
    const resize = () => {
      W = window.innerWidth
      H = window.innerHeight
      canvas.width = W * dpr
      canvas.height = H * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()

    const sprites = colors.map((c) => glowSprite(c))
    const white = glowSprite('#ffffff')

    // Drifting lights. `depth` sets how far each one leans away from the cursor.
    const orbs = Array.from({ length: americana ? 14 : 24 }, (_, i) => ({
      x: Math.random(),
      y: Math.random(),
      r: 120 + Math.random() * 240,
      sx: 0.00003 + Math.random() * 0.00006,
      sy: 0.00002 + Math.random() * 0.00005,
      ph: Math.random() * Math.PI * 2,
      depth: 0.02 + Math.random() * 0.08,
      sprite: sprites[i % sprites.length],
      a: 0.16 + Math.random() * 0.2,
    }))
    // Small things that float: card suits in Vegas, stars in Americana.
    const floaters = Array.from({ length: americana ? 70 : 34 }, (_, i) => ({
      x: Math.random(),
      y: Math.random(),
      s: americana ? 3 + Math.random() * 9 : 18 + Math.random() * 46,
      v: 0.000006 + Math.random() * 0.00002,
      ph: Math.random() * Math.PI * 2,
      depth: 0.01 + Math.random() * 0.05,
      glyph: SUITS[i % SUITS.length],
      c: colors[i % colors.length],
    }))
    const sparks: Spark[] = []

    // Pointer: `t` is where it is, `m` eases toward it so nothing jumps.
    const t = { x: W / 2, y: H * 0.4 }
    const m = { x: W / 2, y: H * 0.4 }
    let lastX = t.x
    let lastY = t.y
    const onMove = (e: PointerEvent) => {
      t.x = e.clientX
      t.y = e.clientY
    }
    const onDown = (e: PointerEvent) => {
      if (still) return
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2
        const v = 2.5 + Math.random() * 2.5
        sparks.push({ x: e.clientX, y: e.clientY, vx: Math.cos(a) * v, vy: Math.sin(a) * v, born: performance.now(), life: 650, r: 5 + Math.random() * 5, c: colors[i % colors.length], rot: Math.random() * 3 })
      }
    }

    const draw = (now: number) => {
      m.x += (t.x - m.x) * 0.12
      m.y += (t.y - m.y) * 0.12
      root.style.setProperty('--mx', (m.x / W).toFixed(4))
      root.style.setProperty('--my', (m.y / H).toFixed(4))
      root.style.setProperty('--mxpx', `${m.x.toFixed(1)}px`)
      root.style.setProperty('--mypx', `${m.y.toFixed(1)}px`)
      const px = m.x - W / 2
      const py = m.y - H / 2

      ctx.globalCompositeOperation = 'source-over'
      ctx.clearRect(0, 0, W, H)

      // Americana: one huge flag, waving slowly, low in the picture.
      if (americana) {
        const bands = 7
        const bh = (H * 0.5) / bands
        for (let i = 0; i < bands; i++) {
          ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.075)' : 'rgba(224,22,43,0.2)'
          ctx.beginPath()
          const top = (x: number) => H * 0.52 + i * bh + Math.sin(x * 0.005 + now * 0.0011 + i * 0.35) * 18 + Math.sin(x * 0.013 - now * 0.0017) * 6 - px * 0.02
          ctx.moveTo(0, top(0))
          for (let x = 0; x <= W + 40; x += 40) ctx.lineTo(x, top(x))
          for (let x = W + 40; x >= 0; x -= 40) ctx.lineTo(x, top(x) + bh + 1)
          ctx.closePath()
          ctx.fill()
        }
      }

      ctx.globalCompositeOperation = 'lighter'

      // Searchlights sweeping up from the bottom corners.
      const beams = americana ? 3 : 4
      for (let b = 0; b < beams; b++) {
        const baseX = (W * (b + 0.5)) / beams
        const ang = -Math.PI / 2 + Math.sin(now * 0.00035 * (1 + b * 0.23) + b * 1.7) * 0.55
        const len = Math.hypot(W, H)
        const spread = 0.055
        const grad = ctx.createLinearGradient(baseX, H, baseX + Math.cos(ang) * len * 0.8, H + Math.sin(ang) * len * 0.8)
        const c = americana ? ['#ff3b4e', '#ffffff', '#4f8cff'][b % 3] : colors[b % colors.length]
        grad.addColorStop(0, c + '55')
        grad.addColorStop(1, c + '00')
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.moveTo(baseX, H + 20)
        ctx.lineTo(baseX + Math.cos(ang - spread) * len, H + Math.sin(ang - spread) * len)
        ctx.lineTo(baseX + Math.cos(ang + spread) * len, H + Math.sin(ang + spread) * len)
        ctx.closePath()
        ctx.fill()
      }

      // Drifting lights, leaning away from the pointer.
      for (const o of orbs) {
        const x = (0.5 + 0.5 * Math.sin(now * o.sx + o.ph + o.x * 6)) * W - px * o.depth * 4
        const y = (0.5 + 0.5 * Math.cos(now * o.sy + o.ph * 1.7 + o.y * 6)) * H - py * o.depth * 4
        const r = o.r * (1 + 0.18 * Math.sin(now * 0.0012 + o.ph))
        ctx.globalAlpha = o.a
        ctx.drawImage(o.sprite, x - r, y - r, r * 2, r * 2)
      }

      // The spotlight under the pointer.
      const hue = sprites[Math.floor(now / 900) % sprites.length]
      ctx.globalAlpha = 0.34
      ctx.drawImage(hue, m.x - 300, m.y - 300, 600, 600)
      ctx.globalAlpha = 0.22
      ctx.drawImage(white, m.x - 120, m.y - 120, 240, 240)

      // Floaters.
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      for (const f of floaters) {
        const y = ((((f.y - now * f.v) % 1) + 1) % 1) * (H + 120) - 60 - py * f.depth * 3
        const x = f.x * W + Math.sin(now * 0.0004 + f.ph) * 30 - px * f.depth * 3
        const tw = 0.5 + 0.5 * Math.sin(now * 0.003 + f.ph * 3)
        if (americana) {
          ctx.globalAlpha = 0.25 + 0.75 * tw
          ctx.fillStyle = '#ffffff'
          star(ctx, x, y, f.s, 5, f.ph)
        } else {
          ctx.globalAlpha = 0.16 + 0.2 * tw
          ctx.fillStyle = f.c
          ctx.font = `${f.s}px Georgia, serif`
          ctx.save()
          ctx.translate(x, y)
          ctx.rotate(Math.sin(now * 0.0003 + f.ph) * 0.5)
          ctx.fillText(f.glyph, 0, 0)
          ctx.restore()
        }
      }

      // Sparkle trail behind the pointer.
      const moved = Math.hypot(t.x - lastX, t.y - lastY)
      if (!still && moved > 3) {
        const n = Math.min(4, Math.ceil(moved / 18))
        for (let i = 0; i < n; i++) {
          sparks.push({
            x: t.x + (Math.random() - 0.5) * 14,
            y: t.y + (Math.random() - 0.5) * 14,
            vx: (Math.random() - 0.5) * 1.6,
            vy: (Math.random() - 0.5) * 1.6 + 0.4,
            born: now,
            life: 550 + Math.random() * 500,
            r: 4 + Math.random() * 8,
            c: colors[(Math.random() * colors.length) | 0],
            rot: Math.random() * Math.PI,
          })
        }
      }
      lastX = t.x
      lastY = t.y
      for (let i = sparks.length - 1; i >= 0; i--) {
        const p = sparks[i]
        const k = (now - p.born) / p.life
        if (k >= 1) {
          sparks.splice(i, 1)
          continue
        }
        p.x += p.vx
        p.y += p.vy
        p.rot += 0.06
        ctx.globalAlpha = 1 - k
        ctx.fillStyle = p.c
        star(ctx, p.x, p.y, p.r * (1 - k * 0.6), americana ? 5 : 4, p.rot)
      }
      ctx.globalAlpha = 1
    }

    let raf = 0
    const loop = (now: number) => {
      draw(now)
      raf = requestAnimationFrame(loop)
    }
    if (still) {
      draw(4200)
    } else {
      raf = requestAnimationFrame(loop)
      window.addEventListener('pointermove', onMove, { passive: true })
      window.addEventListener('pointerdown', onDown, { passive: true })
    }
    const onResize = () => {
      resize()
      if (still) draw(4200)
    }
    window.addEventListener('resize', onResize)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('resize', onResize)
    }
  }, [mode, motion])

  if (mode === 'off') return null
  return (
    <div className={`backdrop backdrop-${mode}`} aria-hidden>
      <div className="backdrop-rays" />
      <canvas ref={ref} />
    </div>
  )
}
