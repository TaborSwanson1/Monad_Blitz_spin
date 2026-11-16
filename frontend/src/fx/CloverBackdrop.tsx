import { useEffect, useRef } from 'react'
import { motionOff, useFxPrefs } from './prefs'

// The slot's background (Zander): a light, grass-green meadow in place of the purple Vegas one.
// Kept gentle on purpose: soft drifting light, a faint rainbow, clovers and gold coins floating up,
// and little pop-ups (a clover pops open somewhere every few seconds, a click throws coins).
// The pointer leaves a warm spotlight and a few gold sparkles. Motion off paints one still frame.
// The CSS is in components/slot/slot.css (.backdrop-clover).

const GREENS = ['#d9ff8a', '#a6f08a', '#ffffff', '#ffe58a']
const RAINBOW = ['#ff6b6b', '#ffb454', '#ffe66b', '#7be07b', '#6bc8ff', '#a98bff']

function glow(color: string, size = 200) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')!
  const r = size / 2
  const grad = g.createRadialGradient(r, r, 0, r, r, r)
  grad.addColorStop(0, color)
  grad.addColorStop(1, color + '00')
  g.fillStyle = grad
  g.fillRect(0, 0, size, size)
  return c
}

interface Pop {
  x: number
  y: number
  born: number
  life: number
  vx: number
  vy: number
  s: number
  kind: 'clover' | 'coin'
}

export function CloverBackdrop() {
  const ref = useRef<HTMLCanvasElement>(null)
  const { motion } = useFxPrefs()

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const still = motionOff()
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

    const sprites = GREENS.map((c) => glow(c))
    const orbs = Array.from({ length: 12 }, (_, i) => ({
      x: Math.random(), y: Math.random(), r: 140 + Math.random() * 220, ph: Math.random() * 6.3,
      sx: 0.00003 + Math.random() * 0.00004, sy: 0.00002 + Math.random() * 0.00004,
      a: 0.1 + Math.random() * 0.14, sprite: sprites[i % sprites.length],
    }))
    // Things that float up: clovers and gold coins.
    const floaters = Array.from({ length: 26 }, (_, i) => ({
      x: Math.random(), y: Math.random(), s: 16 + Math.random() * 30, ph: Math.random() * 6.3,
      v: 0.000005 + Math.random() * 0.000012, depth: 0.01 + Math.random() * 0.04, coin: i % 3 === 0,
    }))
    const pops: Pop[] = []
    const t = { x: W / 2, y: H * 0.35 }
    const m = { x: t.x, y: t.y }
    let lastPop = 0
    let lastX = t.x
    let lastY = t.y

    const onMove = (e: PointerEvent) => { t.x = e.clientX; t.y = e.clientY }
    const onDown = (e: PointerEvent) => {
      if (still) return
      const now = performance.now()
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2
        pops.push({ x: e.clientX, y: e.clientY, born: now, life: 800, vx: Math.cos(a) * 2.6, vy: Math.sin(a) * 2.6 - 1, s: 9 + Math.random() * 6, kind: i % 2 ? 'coin' : 'clover' })
      }
    }

    const coin = (x: number, y: number, r: number, a: number) => {
      ctx.globalAlpha = a
      ctx.fillStyle = '#f6c443'
      ctx.beginPath(); ctx.arc(x, y, r, 0, 6.3); ctx.fill()
      ctx.strokeStyle = '#fff3b0'; ctx.lineWidth = Math.max(1, r * 0.14)
      ctx.beginPath(); ctx.arc(x, y, r * 0.68, 0, 6.3); ctx.stroke()
    }
    const clover = (x: number, y: number, s: number, a: number, rot: number) => {
      ctx.globalAlpha = a
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot)
      ctx.fillStyle = '#2f9e44'
      for (let k = 0; k < 4; k++) {
        ctx.rotate(Math.PI / 2)
        ctx.beginPath(); ctx.ellipse(0, -s * 0.32, s * 0.26, s * 0.3, 0, 0, 6.3); ctx.fill()
      }
      ctx.restore()
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

      // A faint rainbow arc over the top, breathing slowly.
      const cx = W * 0.5 + px * 0.01
      const base = H * 0.95
      const R = Math.max(W * 0.62, 420)
      ctx.lineWidth = Math.max(8, R * 0.022)
      ctx.globalAlpha = 0.07 + 0.025 * Math.sin(now * 0.0007)
      RAINBOW.forEach((c, i) => {
        ctx.strokeStyle = c
        ctx.beginPath(); ctx.arc(cx, base, R - i * ctx.lineWidth * 0.95, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke()
      })

      ctx.globalCompositeOperation = 'lighter'
      for (const o of orbs) {
        const x = (0.5 + 0.5 * Math.sin(now * o.sx + o.ph + o.x * 6)) * W - px * 0.05
        const y = (0.5 + 0.5 * Math.cos(now * o.sy + o.ph * 1.7 + o.y * 6)) * H - py * 0.05
        const r = o.r * (1 + 0.15 * Math.sin(now * 0.001 + o.ph))
        ctx.globalAlpha = o.a
        ctx.drawImage(o.sprite, x - r, y - r, r * 2, r * 2)
      }
      ctx.globalAlpha = 0.3
      ctx.drawImage(sprites[3], m.x - 260, m.y - 260, 520, 520)
      ctx.globalCompositeOperation = 'source-over'

      for (const f of floaters) {
        const y = ((((f.y - now * f.v) % 1) + 1) % 1) * (H + 100) - 50 - py * f.depth * 3
        const x = f.x * W + Math.sin(now * 0.0004 + f.ph) * 26 - px * f.depth * 3
        const tw = 0.5 + 0.5 * Math.sin(now * 0.0024 + f.ph * 3)
        if (f.coin) coin(x, y, f.s * 0.28, 0.2 + 0.2 * tw)
        else clover(x, y, f.s, 0.12 + 0.12 * tw, Math.sin(now * 0.0003 + f.ph) * 0.6)
      }

      // A pop-up every few seconds: a clover opens somewhere and drifts away.
      if (!still && now - lastPop > 3500 + Math.random() * 2500) {
        lastPop = now
        pops.push({ x: Math.random() * W, y: H * (0.15 + Math.random() * 0.6), born: now, life: 2200, vx: 0, vy: -0.25, s: 34, kind: 'clover' })
      }
      // Warm sparkles behind the pointer.
      if (!still && Math.hypot(t.x - lastX, t.y - lastY) > 4 && Math.random() < 0.6) {
        pops.push({ x: t.x + (Math.random() - 0.5) * 12, y: t.y + (Math.random() - 0.5) * 12, born: now, life: 600, vx: (Math.random() - 0.5), vy: 0.3, s: 4 + Math.random() * 4, kind: 'coin' })
      }
      lastX = t.x
      lastY = t.y
      for (let i = pops.length - 1; i >= 0; i--) {
        const p = pops[i]
        const k = (now - p.born) / p.life
        if (k >= 1) { pops.splice(i, 1); continue }
        p.x += p.vx; p.y += p.vy
        if (p.life > 1000) {
          const grow = Math.min(1, k * 4) * (1 - Math.max(0, k - 0.6) / 0.4)
          clover(p.x, p.y, p.s * (0.3 + grow), 0.4 * (1 - k * 0.6), k * 3)
        } else if (p.kind === 'coin') coin(p.x, p.y, p.s * 0.5, 0.7 * (1 - k))
        else clover(p.x, p.y, p.s * 1.6, 0.6 * (1 - k), k * 4)
      }
      ctx.globalAlpha = 1
    }

    let raf = 0
    const loop = (now: number) => { draw(now); raf = requestAnimationFrame(loop) }
    if (still) draw(4200)
    else {
      raf = requestAnimationFrame(loop)
      window.addEventListener('pointermove', onMove, { passive: true })
      window.addEventListener('pointerdown', onDown, { passive: true })
    }
    const onResize = () => { resize(); if (still) draw(4200) }
    window.addEventListener('resize', onResize)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('resize', onResize)
    }
  }, [motion])

  return (
    <div className="backdrop backdrop-clover" aria-hidden>
      <canvas ref={ref} />
    </div>
  )
}
