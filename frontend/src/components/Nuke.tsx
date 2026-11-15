import { useEffect, useRef } from 'react'
import { prefersReducedMotion } from '../lib/themes'
import { WalletSvg } from './BurningWallet'

// Americana BIG loss effect (stake >= BIG_STAKE and the round is a net loss): the
// wallet gets nuked, big, at the bottom of the screen behind the result card.
// Drawn by us as particles: the wallet vaporizes, a white-hot fireball rises, smoke
// rolls up the stem into a cap lit orange from below that slowly cools to gray, and a
// dust skirt and shockwave run along the ground. The screen flash is a strobe: three
// flashes in a little over a second. That is the most the WCAG 2.3.1 seizure-safety
// rule allows (no more than three flashes in any one second), so don't make it faster.
// Reduced motion (or Motion off) gets a still image and no flash.

export const NUKE_MS = 3600
const DETONATE = 350
const W = 440
const H = 260
const GROUND = 226
const CX = W / 2

const clamp = (x: number) => Math.max(0, Math.min(1, x))
const easeOut = (x: number) => 1 - Math.pow(1 - clamp(x), 3)

function puffSprite(inner: string, outer: string, size = 64) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')!
  const r = size / 2
  const grad = g.createRadialGradient(r * 0.85, r * 0.8, 0, r, r, r)
  grad.addColorStop(0, inner)
  grad.addColorStop(0.55, inner)
  grad.addColorStop(1, outer)
  g.fillStyle = grad
  g.beginPath()
  g.arc(r, r, r, 0, Math.PI * 2)
  g.fill()
  return c
}

function NukeCanvas({ scale, ox, oy }: { scale: number; ox: number; oy: number }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const dpr = window.devicePixelRatio || 1
    // Full-screen canvas, so the cloud, dust and shockwave never hit an edge. The base
    // W x H scene is drawn at (ox, oy) on screen, scaled by `scale`.
    const vw = window.innerWidth
    canvas.width = vw * dpr
    canvas.height = window.innerHeight * dpr
    const toBase = () => ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * ox, dpr * oy)
    // How far the shockwave and dust need to travel to reach both screen edges, in base units.
    const reach = (Math.max(ox + CX * scale, vw - ox - CX * scale) + 80) / scale
    // The cloud rises only as far as the open space below the result card, so the cap
    // stays visible instead of disappearing behind the card.
    const card = document.querySelector('.reveal-card')?.getBoundingClientRect()
    const capTopBase = card ? (card.bottom + 8 - oy) / scale + 62 : 0 // highest the cap center may go
    const riseMax = Math.max(40, Math.min(120, GROUND - 14 - capTopBase))

    const smokeDark = puffSprite('rgba(78,64,58,0.9)', 'rgba(60,50,45,0)')
    const smokeLight = puffSprite('rgba(140,120,105,0.85)', 'rgba(110,95,85,0)')
    const glow = puffSprite('rgba(255,170,70,0.9)', 'rgba(255,90,20,0)')
    const hot = puffSprite('rgba(255,248,220,1)', 'rgba(255,200,90,0)')

    // The cap: puffs on a ring that roll over the top like a real mushroom cloud.
    const cap = Array.from({ length: 70 }, () => ({
      a: Math.random() * Math.PI * 2,
      phi: Math.random() * Math.PI * 2,
      ring: 34 + Math.random() * 20,
      tube: 14 + Math.random() * 14,
      size: 34 + Math.random() * 24,
    }))
    const skirt = Array.from({ length: 44 }, () => ({ dir: Math.random() < 0.5 ? -1 : 1, far: 0.35 + Math.random() * 0.65, size: 14 + Math.random() * 16, lift: Math.random() * 10 }))
    type S = { x: number; y: number; vy: number; size: number; heat: number }
    const stem: S[] = []

    const t0 = performance.now()
    let raf = 0
    const frame = (now: number) => {
      const d = now - t0 - DETONATE
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      toBase()
      if (d >= 0) {
        const rise = easeOut(d / 1900)
        const fy = GROUND - 14 - rise * riseMax // fireball center
        const fr = 10 + 46 * easeOut(d / 650) // fireball radius
        const cool = clamp((d - 900) / 3800) // 0 hot, 1 cooled
        const capGrow = easeOut((d - 350) / 1500)

        // Shockwave: two rings racing out along the ground to both edges of the screen.
        for (const [lag, alpha, width] of [[0, 0.95, 3.5], [180, 0.5, 2]] as const) {
          const t = d - lag
          if (t < 0 || t > 1500) continue
          const rx = 12 + reach * easeOut(t / 1300)
          ctx.strokeStyle = `rgba(255,236,196,${alpha * (1 - t / 1500)})`
          ctx.lineWidth = width
          ctx.beginPath()
          ctx.ellipse(CX, GROUND, rx, Math.min(rx * 0.16, 30), 0, 0, Math.PI * 2)
          ctx.stroke()
        }

        // Dust skirt rolling out to the edges of the screen.
        for (const p of skirt) {
          const k = clamp(d / 2600)
          const x = CX + p.dir * (10 + reach * p.far * easeOut(d / 2200))
          const s = p.size * (0.6 + k * 1.4)
          ctx.globalAlpha = 0.55 * (1 - k * 0.7)
          ctx.drawImage(smokeLight, x - s / 2, GROUND - 6 - p.lift - s / 2, s, s)
        }

        // Stem: smoke rises from the ground into the fireball, hot at first.
        if (d > 150 && d < 3000) for (let i = 0; i < 2; i++) stem.push({ x: CX + (Math.random() - 0.5) * 14, y: GROUND - 4, vy: -(1.6 + Math.random() * 1.2), size: 14 + Math.random() * 8, heat: 1 - cool })
        for (let i = stem.length - 1; i >= 0; i--) {
          const p = stem[i]
          p.y += p.vy
          p.x += (CX - p.x) * 0.02
          p.size += 0.12
          if (p.y < fy + fr * 0.5) {
            stem.splice(i, 1)
            continue
          }
          ctx.globalAlpha = 0.8
          ctx.drawImage(smokeDark, p.x - p.size / 2, p.y - p.size / 2, p.size, p.size)
          if (p.heat > 0.05) {
            ctx.globalCompositeOperation = 'lighter'
            ctx.globalAlpha = 0.45 * p.heat
            ctx.drawImage(glow, p.x - p.size / 2, p.y - p.size / 2, p.size, p.size)
            ctx.globalCompositeOperation = 'source-over'
          }
        }

        // Cap puffs behind the fireball, then the fireball, then puffs in front.
        const drawPuffs = (front: boolean) => {
          for (const p of cap) {
            const depth = Math.sin(p.a)
            if (front !== depth >= 0) continue
            const phi = p.phi - d * 0.0018
            const r = (p.ring + Math.cos(phi) * p.tube) * capGrow
            const x = CX + Math.cos(p.a) * r
            const y = fy - 6 + Math.sin(phi) * p.tube * 0.85 * capGrow + depth * 4
            const s = p.size * (0.4 + 0.6 * capGrow) * (1 + cool * 0.25)
            const lit = clamp(Math.sin(phi)) // underside catches the fireball light
            ctx.globalAlpha = 0.9 * capGrow
            ctx.drawImage(lit > 0.3 ? smokeDark : smokeLight, x - s / 2, y - s / 2, s, s)
            ctx.globalCompositeOperation = 'lighter'
            ctx.globalAlpha = (0.25 + 0.6 * lit) * (1 - cool * 0.85) * capGrow
            ctx.drawImage(glow, x - s / 2, y - s / 2, s, s)
            ctx.globalCompositeOperation = 'source-over'
          }
        }
        drawPuffs(false)
        ctx.globalCompositeOperation = 'lighter'
        ctx.globalAlpha = 1 - cool * 0.8
        ctx.drawImage(hot, CX - fr, fy - fr, fr * 2, fr * 2)
        ctx.globalAlpha = 0.8 * (1 - cool * 0.7)
        ctx.drawImage(glow, CX - fr * 1.6, fy - fr * 1.6, fr * 3.2, fr * 3.2)
        ctx.globalCompositeOperation = 'source-over'
        drawPuffs(true)
        ctx.globalAlpha = 1
      }
      if (d < NUKE_MS + 1600) raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [scale, ox, oy])

  return <canvas ref={ref} className="nuke-canvas" aria-hidden />
}

function StillMushroom() {
  return (
    <svg className="mushroom" viewBox="0 0 200 200">
      <defs>
        <radialGradient id="cap" cx="50%" cy="60%" r="60%">
          <stop offset="0" stopColor="#c9a58a" />
          <stop offset="0.6" stopColor="#8a6a58" />
          <stop offset="1" stopColor="#4b3a33" />
        </radialGradient>
      </defs>
      <path d="M88 196 C90 160 86 120 92 92 L108 92 C114 120 110 160 112 196 Z" fill="#6b5548" />
      <circle cx="100" cy="70" r="38" fill="url(#cap)" />
      <circle cx="70" cy="80" r="24" fill="url(#cap)" />
      <circle cx="130" cy="80" r="24" fill="url(#cap)" />
    </svg>
  )
}

export function Nuke({ wallet }: { wallet: string | null }) {
  const reduced = prefersReducedMotion()
  const vw = typeof window === 'undefined' ? 1200 : window.innerWidth
  const vh = typeof window === 'undefined' ? 800 : window.innerHeight
  const s = Math.max(1, Math.min(2.1, (vw - 32) / W, (vh * 0.72) / H))
  // The scene box sits centered at the bottom, 12px up, like the burning wallet.
  const ox = (vw - W * s) / 2
  const oy = vh - 12 - H * s
  return (
    <>
      {/* Flash and canvas live outside the centered box: its transform would trap
          position: fixed children inside it and show a hard-edged rectangle. */}
      {!reduced && <div className="nuke-flash" aria-hidden />}
      <div className={`fx-bottom nuke ${reduced ? 'nuke-static' : ''}`} style={{ width: W * s, height: H * s }} aria-hidden>
        {reduced ? (
          <StillMushroom />
        ) : (
          <div className="nuke-wallet" style={{ width: 132 * s, marginLeft: -66 * s }}>
            <WalletSvg wallet={wallet} />
          </div>
        )}
      </div>
      {!reduced && <NukeCanvas scale={s} ox={ox} oy={oy} />}
    </>
  )
}
