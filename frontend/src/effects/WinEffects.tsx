import { useEffect, useRef, useState, type CSSProperties } from 'react'

const rand = (a: number, b: number) => a + Math.random() * (b - a)

interface Props {
  intensity: number
  coinCount: number
  confettiCount: number
  durationMs: number
}

/**
 * The opening burst of a win: confetti over the whole viewport, and coins that burst from
 * the card to the screen edges and rain from the top. Runs once. All of it sits behind the
 * result card, so the result stays readable.
 */
export function WinEffects({ intensity, coinCount, confettiCount, durationMs }: Props) {
  return (
    <>
      <Confetti count={confettiCount} intensity={intensity} durationMs={durationMs} />
      <CoinShower count={coinCount} durationMs={durationMs} />
    </>
  )
}

/**
 * What keeps going while a winning reveal is open: a pulsing gold wash and a steady stream
 * of coins from the card. The stream rate scales with the win. Unmounting stops it and
 * removes every coin.
 */
export function WinLoop({ intensity }: { intensity: number }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const layer = ref.current
    if (!layer) return
    const perTick = Math.round(2 + 5 * intensity) // every 250 ms: about 14 to 28 coins a second
    const spawn = () => {
      if (document.hidden || layer.childElementCount > 160) return
      for (let i = 0; i < perTick; i++) {
        const c = document.createElement('span')
        c.className = 'fx-coin fx-coin-burst'
        const a = rand(-Math.PI * 1.05, Math.PI * 0.05)
        const d = rand(0.4, 1)
        const x1 = Math.cos(a) * d * 30
        const y1 = Math.sin(a) * d * 38 - 6
        const dur = rand(1800, 2600)
        c.style.cssText =
          `--x1:${x1}vw;--y1:${y1}vh;--x2:${Math.cos(a) * d * 56}vw;--y2:${y1 + rand(70, 100)}vh;` +
          `--rot:${rand(-720, 720)}deg;--s:${rand(0.8, 1.5)};--delay:${rand(0, 200)}ms;--dur:${dur}ms`
        c.addEventListener('animationend', () => c.remove(), { once: true })
        setTimeout(() => c.remove(), dur + 600) // fallback if animationend never fires
        layer.appendChild(c)
      }
    }
    const start = setTimeout(() => {
      spawn()
      timer = setInterval(spawn, 250)
    }, 700) // let the opening burst lead
    let timer: ReturnType<typeof setInterval> | undefined
    return () => {
      clearTimeout(start)
      clearInterval(timer)
      layer.replaceChildren()
    }
  }, [intensity])

  return (
    <>
      <div className="fx-layer fx-gold-wash" style={{ '--intensity': intensity } as CSSProperties} aria-hidden />
      <div ref={ref} className="fx-layer" aria-hidden />
    </>
  )
}

/** CSS coin sprites. About 60% burst out from the card, the rest rain from the top edge. */
function CoinShower({ count, durationMs }: { count: number; durationMs: number }) {
  const [coins] = useState(() =>
    Array.from({ length: count }, (_, i) => {
      if (i % 5 < 3) {
        // burst: up and out to the edges of the screen, then drop off the bottom
        const a = rand(-Math.PI * 1.05, Math.PI * 0.05)
        const d = rand(0.45, 1)
        const x1 = Math.cos(a) * d * 32
        const y1 = Math.sin(a) * d * 40 - 6
        return {
          kind: 'burst',
          style: {
            '--x1': `${x1}vw`,
            '--y1': `${y1}vh`,
            '--x2': `${Math.cos(a) * d * 58}vw`,
            '--y2': `${y1 + rand(70, 100)}vh`,
            '--rot': `${rand(-720, 720)}deg`,
            '--s': rand(0.9, 1.7),
            '--delay': `${rand(0, 350)}ms`,
            '--dur': `${durationMs * rand(0.8, 1.05)}ms`,
          } as CSSProperties,
        }
      }
      // rain: falls the full height of the screen with a little sideways drift
      return {
        kind: 'rain',
        style: {
          left: `${rand(2, 98)}vw`,
          '--x2': `${rand(-8, 8)}vw`,
          '--rot': `${rand(-540, 540)}deg`,
          '--s': rand(0.7, 1.3),
          '--delay': `${rand(150, durationMs * 0.45)}ms`,
          '--dur': `${durationMs * rand(0.55, 0.8)}ms`,
        } as CSSProperties,
      }
    }),
  )
  return (
    <div className="fx-layer" aria-hidden>
      {coins.map((c, i) => (
        <span key={i} className={`fx-coin fx-coin-${c.kind}`} style={c.style} />
      ))}
    </div>
  )
}

/**
 * Tumbling confetti on a full-screen canvas: a burst from the card, two cannons from the
 * bottom corners, and a fall from the top edge. Greens, golds and whites.
 */
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

    const colors = ['#0bbf58', '#2ec27e', '#e9b949', '#f2c94c', '#ffe08a', '#f0f4f8']
    const power = Math.sqrt(h) * (0.85 + 0.35 * intensity)
    const ps = Array.from({ length: count }, (_, i) => {
      const src = i % 4
      let x: number, y: number, vx: number, vy: number, delay: number
      if (src === 0) {
        // centre burst
        const a = rand(-Math.PI, 0)
        const v = rand(0.3, 0.75) * power
        ;[x, y, vx, vy, delay] = [w / 2, h / 2, Math.cos(a) * v, Math.sin(a) * v, rand(0, 120)]
      } else if (src === 1 || src === 2) {
        // cannons from the bottom corners, aimed up and across
        const left = src === 1
        const a = left ? rand(-1.35, -0.9) : rand(-2.25, -1.8)
        const v = rand(0.75, 1.05) * power
        ;[x, y, vx, vy, delay] = [left ? -10 : w + 10, h + 10, Math.cos(a) * v, Math.sin(a) * v, rand(80, 400)]
      } else {
        // falling from the top edge
        ;[x, y, vx, vy, delay] = [rand(0, w), rand(-80, -10), rand(-1, 1), rand(1, 3), rand(200, durationMs * 0.4)]
      }
      return {
        x, y, vx, vy, delay,
        w: rand(5, 10),
        h: rand(10, 18),
        rot: rand(0, Math.PI * 2),
        spin: rand(-0.25, 0.25),
        flip: rand(0, Math.PI * 2),
        sway: rand(0.02, 0.06),
        fall: rand(2.5, 5),
        c: colors[(Math.random() * colors.length) | 0],
      }
    })

    const t0 = performance.now()
    let raf = 0
    const frame = (t: number) => {
      const el = t - t0
      const k = el / durationMs
      ctx.clearRect(0, 0, w, h)
      if (k >= 1) return
      ctx.globalAlpha = k < 0.75 ? 1 : (1 - k) / 0.25
      for (const p of ps) {
        if (el < p.delay) continue
        p.vx *= 0.985
        p.vy = Math.min(p.vy * 0.985 + 0.22, p.fall) // drifts down once the launch wears off
        p.flip += p.sway * 4
        p.x += p.vx + Math.sin(p.flip) * 0.8
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
