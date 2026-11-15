import { useEffect, useRef, useState, type CSSProperties } from 'react'

const rand = (a: number, b: number) => a + Math.random() * (b - a)

interface Props {
  intensity: number
  coinCount: number
  confettiCount: number
  durationMs: number
}

/** Confetti behind, coins over it, both behind the result card so the result stays readable. */
export function WinEffects({ intensity, coinCount, confettiCount, durationMs }: Props) {
  return (
    <>
      <Confetti count={confettiCount} intensity={intensity} durationMs={durationMs} />
      <CoinShower count={coinCount} durationMs={durationMs} />
    </>
  )
}

/** CSS coin sprites that arc out from the card and fall away. */
function CoinShower({ count, durationMs }: { count: number; durationMs: number }) {
  const [coins] = useState(() =>
    Array.from({ length: count }, () => {
      const a = rand(-Math.PI, 0) // upper half: coins fly up and out, then drop
      const d = rand(160, 420)
      const x1 = Math.cos(a) * d * 0.6
      const y1 = Math.sin(a) * d * 0.6 - 30
      return {
        '--x1': `${x1}px`,
        '--y1': `${y1}px`,
        '--x2': `${Math.cos(a) * d}px`,
        '--y2': `${y1 + rand(200, 380)}px`,
        '--rot': `${rand(-540, 540)}deg`,
        '--s': rand(0.7, 1.25),
        '--delay': `${rand(0, 180)}ms`,
        '--dur': `${durationMs * rand(0.75, 1)}ms`,
      } as CSSProperties
    }),
  )
  return (
    <div className="fx-layer" aria-hidden>
      {coins.map((style, i) => (
        <span key={i} className="fx-coin" style={style} />
      ))}
    </div>
  )
}

/** Tumbling confetti rectangles on a canvas. Greens, golds and whites. */
function Confetti({ count, intensity, durationMs }: { count: number; intensity: number; durationMs: number }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const dpr = window.devicePixelRatio || 1
    const w = innerWidth
    const h = innerHeight
    canvas.width = w * dpr
    canvas.height = h * dpr
    ctx.scale(dpr, dpr)

    const colors = ['#0bbf58', '#2ec27e', '#e9b949', '#f2c94c', '#f0f4f8']
    const ps = Array.from({ length: count }, () => {
      const a = rand(-Math.PI * 0.95, -Math.PI * 0.05)
      const v = rand(4, 11) * (0.7 + 0.5 * intensity)
      return {
        x: w / 2 + rand(-40, 40),
        y: h / 2,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        w: rand(4, 8),
        h: rand(8, 14),
        rot: rand(0, Math.PI * 2),
        spin: rand(-0.25, 0.25),
        flip: rand(0, Math.PI * 2),
        sway: rand(0.02, 0.06),
        c: colors[(Math.random() * colors.length) | 0],
      }
    })

    const t0 = performance.now()
    let raf = 0
    const frame = (t: number) => {
      const k = (t - t0) / durationMs
      ctx.clearRect(0, 0, w, h)
      if (k >= 1) return
      ctx.globalAlpha = k < 0.7 ? 1 : (1 - k) / 0.3
      for (const p of ps) {
        p.vx *= 0.97
        p.vy = p.vy * 0.97 + 0.18
        p.flip += p.sway * 4
        p.x += p.vx + Math.sin(p.flip) * 0.6
        p.y += p.vy
        p.rot += p.spin
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        ctx.scale(Math.cos(p.flip), 1) // tumble
        ctx.fillStyle = p.c
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
        ctx.restore()
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [count, intensity, durationMs])

  return <canvas ref={ref} className="fx-layer fx-canvas" aria-hidden />
}
