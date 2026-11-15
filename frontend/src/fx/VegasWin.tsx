import { useEffect, useRef } from 'react'
import { makeSprite } from '../components/MonadTokens'
import { PALETTES } from './bus'
import { Marquee } from './Marquee'
import { motionOff } from './prefs'

// The win show for every game on the Vegas theme (Crash, Beauty Contest, Exact Digit,
// Block Race). Only for a real net win, and sized by it:
//  - gold coins and Monad tokens fountain up from the bottom of the screen
//  - neon confetti falls from the top
//  - a marquee sign with chasing bulbs calls the win above the result
//  - bulbs chase around the edge of the screen and the page pulses with color
// `intensity` (0 to 1) comes from the real payout multiple: about 0.3 for a 2x win,
// 0.7 for 5x, 1 for 10x and up. It sets the coin rate and which sign you get.
// The color pulse runs at 2 per second, under the 3-per-second flash safety limit.
// With motion off it paints one still picture and the sign.

function coinSprite(size = 64) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')!
  const r = size / 2
  const grad = g.createRadialGradient(r * 0.7, r * 0.6, 2, r, r, r)
  grad.addColorStop(0, '#fff6b8')
  grad.addColorStop(0.5, '#ffd23f')
  grad.addColorStop(1, '#c47f0a')
  g.fillStyle = grad
  g.beginPath()
  g.arc(r, r, r - 1, 0, Math.PI * 2)
  g.fill()
  g.strokeStyle = '#8a5a05'
  g.lineWidth = size * 0.05
  g.beginPath()
  g.arc(r, r, r * 0.72, 0, Math.PI * 2)
  g.stroke()
  // A star in the middle, like a casino token.
  g.fillStyle = '#a86a06'
  g.beginPath()
  for (let k = 0; k < 10; k++) {
    const a = -Math.PI / 2 + (k * Math.PI) / 5
    const rr = (k % 2 ? 0.2 : 0.48) * r
    if (k) g.lineTo(r + Math.cos(a) * rr, r + Math.sin(a) * rr)
    else g.moveTo(r + Math.cos(a) * rr, r + Math.sin(a) * rr)
  }
  g.closePath()
  g.fill()
  return c
}

/** The words on the sign follow the real payout multiple. */
export function winCall(intensity: number): string {
  return intensity >= 0.8 ? 'Mega Win!' : intensity >= 0.45 ? 'Big Win!' : 'Winner!'
}

export function VegasWin({ intensity }: { intensity: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const still = motionOff()

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
    const big = Math.max(1, Math.min(1.7, W / 800))
    const coin = coinSprite()
    const token = makeSprite(64)
    const colors = PALETTES.vegas

    if (still) {
      const n = Math.round(30 + 60 * intensity)
      for (let i = 0; i < n; i++) {
        const x = ((i * 97) % 100) / 100
        const y = ((i * 61) % 100) / 100
        const s = (26 + ((i * 13) % 22)) * big
        ctx.drawImage(i % 4 ? coin : token, x * W - s / 2, H * (0.45 + y * 0.55) - s / 2, s, s)
      }
      return
    }

    type C = { x: number; y: number; vx: number; vy: number; rot: number; vr: number; s: number; flip: number; vf: number; token: boolean }
    type F = { x: number; y: number; vx: number; vy: number; rot: number; vr: number; w: number; h: number; c: string }
    const coins: C[] = []
    const confetti: F[] = []
    const rate = 0.5 + 2.6 * intensity // coins per frame
    const spouts = [0.5, 0.12, 0.88]
    let carry = 0

    const t0 = performance.now()
    let raf = 0
    const frame = (t: number) => {
      const now = t - t0
      ctx.clearRect(0, 0, W, H)

      // The first three seconds pour hardest, then it settles to a trickle.
      const flow = now < 3000 ? 1 : 0.35
      carry += rate * flow
      while (carry >= 1 && coins.length < 420) {
        carry -= 1
        const sx = spouts[(Math.random() * spouts.length) | 0]
        const spread = sx === 0.5 ? 9 : 6
        coins.push({
          x: W * sx + (Math.random() - 0.5) * 40,
          y: H + 30,
          vx: (Math.random() - 0.5) * spread * big + (0.5 - sx) * 5,
          vy: -(13 + Math.random() * 12) * Math.min(1.5, H / 620),
          rot: Math.random() * Math.PI,
          vr: (Math.random() - 0.5) * 0.25,
          s: (26 + Math.random() * 26) * big,
          flip: Math.random() * Math.PI,
          vf: 0.15 + Math.random() * 0.25,
          token: Math.random() < 0.22,
        })
      }
      if (confetti.length < 260 && Math.random() < 0.5 + intensity)
        for (let i = 0; i < 3; i++)
          confetti.push({
            x: Math.random() * W,
            y: -20,
            vx: (Math.random() - 0.5) * 2.4,
            vy: 2.5 + Math.random() * 4,
            rot: Math.random() * Math.PI,
            vr: (Math.random() - 0.5) * 0.3,
            w: 7 + Math.random() * 8,
            h: 12 + Math.random() * 12,
            c: colors[(Math.random() * colors.length) | 0],
          })

      for (let i = confetti.length - 1; i >= 0; i--) {
        const p = confetti[i]
        p.x += p.vx + Math.sin(now * 0.004 + p.rot) * 0.8
        p.y += p.vy
        p.rot += p.vr
        if (p.y > H + 30) {
          confetti.splice(i, 1)
          continue
        }
        ctx.fillStyle = p.c
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        ctx.scale(1, Math.cos(p.rot * 2.3))
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
        ctx.restore()
      }

      for (let i = coins.length - 1; i >= 0; i--) {
        const p = coins[i]
        p.x += p.vx
        p.y += p.vy
        p.vy += 0.34
        p.rot += p.vr
        p.flip += p.vf
        if (p.y > H + 80 && p.vy > 0) {
          coins.splice(i, 1)
          continue
        }
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        // Coins tumble edge-on; tokens just spin.
        if (!p.token) ctx.scale(Math.max(0.12, Math.abs(Math.cos(p.flip))), 1)
        ctx.drawImage(p.token ? token : coin, -p.s / 2, -p.s / 2, p.s, p.s)
        ctx.restore()
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [intensity, still])

  return (
    <>
      {!still && <div className="win-wash" aria-hidden />}
      <canvas ref={ref} className="burst" aria-hidden />
      {!still && (
        <div className="edge-lights" aria-hidden>
          <i />
          <i />
        </div>
      )}
      <Marquee tone="neon" anchor="above-card" className="wincall">
        <span className="wc-big">{winCall(intensity)}</span>
        <span className="wc-script">cha-ching!</span>
      </Marquee>
    </>
  )
}
