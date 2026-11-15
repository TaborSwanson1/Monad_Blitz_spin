import { useEffect, useRef } from 'react'
import { prefersReducedMotion } from '../lib/themes'

// Win effect for the Monad theme: purple tokens rain down. Drawn by us in a Monad-like
// style (rounded diamond with a hollow center). Swap in the official mark from Monad's
// brand kit if the team wants the real logo.
//
// `intensity` (0 to 1) comes from revealIntensity(), so it scales with the real net win.

export function makeSprite(size: number): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')!
  const mid = size / 2
  const r = size * 0.42
  const hole = size * 0.17
  g.translate(mid, mid)
  g.rotate(Math.PI / 4)
  const grad = g.createLinearGradient(-r, -r, r, r)
  grad.addColorStop(0, '#a796ff')
  grad.addColorStop(1, '#6a4ff0')
  g.fillStyle = grad
  roundRect(g, -r / 1.42, -r / 1.42, (r / 1.42) * 2, (r / 1.42) * 2, size * 0.12)
  g.fill()
  g.globalCompositeOperation = 'destination-out'
  roundRect(g, -hole, -hole, hole * 2, hole * 2, size * 0.05)
  g.fill()
  return c
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath()
  g.moveTo(x + r, y)
  g.arcTo(x + w, y, x + w, y + h, r)
  g.arcTo(x + w, y + h, x, y + h, r)
  g.arcTo(x, y + h, x, y, r)
  g.arcTo(x, y, x + w, y, r)
  g.closePath()
}

export function MonadTokens({ intensity }: { intensity: number }) {
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

    const sprite = makeSprite(64)
    const n = Math.round(18 + 70 * intensity)
    const tokens = Array.from({ length: n }, () => ({
      x: Math.random() * W,
      y: -40 - Math.random() * H * 0.6,
      vy: 2.5 + Math.random() * 3 * (0.6 + intensity),
      vx: (Math.random() - 0.5) * 1.2,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.12,
      s: 18 + Math.random() * 18,
    }))

    const t0 = performance.now()
    const life = 2200 + 1200 * intensity
    let raf = 0
    const frame = (t: number) => {
      const k = (t - t0) / life
      ctx.clearRect(0, 0, W, H)
      if (k >= 1) return
      ctx.globalAlpha = k > 0.75 ? (1 - k) / 0.25 : 1
      for (const p of tokens) {
        p.x += p.vx
        p.y += p.vy
        p.vy += 0.06
        p.rot += p.vr
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        ctx.drawImage(sprite, -p.s / 2, -p.s / 2, p.s, p.s)
        ctx.restore()
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [intensity])

  return <canvas ref={ref} className="burst" aria-hidden />
}
