import { useEffect, useRef } from 'react'

/** Particle burst. `intensity` (0 to 1) sets particle count and speed. */
export function Burst({ intensity }: { intensity: number }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = innerWidth * dpr
    canvas.height = innerHeight * dpr
    ctx.scale(dpr, dpr)

    const colors = ['#3cf2ff', '#5dff9d', '#ffffff', '#b98cff']
    const n = Math.round(60 + 340 * intensity)
    const cx = innerWidth / 2
    const cy = innerHeight * 0.42
    const ps = Array.from({ length: n }, () => {
      const a = Math.random() * Math.PI * 2
      const v = (2 + Math.random() * 9) * (0.6 + intensity)
      return { x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, s: 1 + Math.random() * 3, c: colors[(Math.random() * colors.length) | 0] }
    })

    const t0 = performance.now()
    const life = 1400 + 900 * intensity
    let raf = 0
    const frame = (t: number) => {
      const k = (t - t0) / life
      ctx.clearRect(0, 0, innerWidth, innerHeight)
      if (k >= 1) return
      ctx.globalAlpha = 1 - k
      for (const p of ps) {
        p.x += p.vx
        p.y += p.vy
        p.vx *= 0.97
        p.vy = p.vy * 0.97 + 0.12
        ctx.fillStyle = p.c
        ctx.fillRect(p.x, p.y, p.s, p.s * 3)
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [intensity])

  return <canvas ref={ref} className="burst" aria-hidden />
}
