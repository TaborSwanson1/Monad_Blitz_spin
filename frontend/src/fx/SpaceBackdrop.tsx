import { useEffect, useRef } from 'react'
import { motionOff, useFxPrefs } from './prefs'

// The Crash game's animated background: deep space, drawn on a canvas.
//
// Three layers of stars drift down past the screen (we're flying up), with a ringed
// planet, slow nebula glows (CSS, .backdrop-space) and the odd shooting star. During a
// live Crash climb, `warp` is the multiplier on screen: the stars speed up and stretch
// into streaks as it climbs. It follows only what the player already sees, never the
// crash point, so it can't hint at the result.
//
// With motion off it paints one still frame and stops.

interface Star {
  x: number
  y: number
  z: number // depth, 0.3 (far) to 1.6 (near)
  r: number
  c: string
  ph: number
}

const STAR_COLORS = ['#ffffff', '#ffffff', '#cfe3ff', '#e6dcff', '#fff4d6']

export function SpaceBackdrop({ warp = 1 }: { warp?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const warpRef = useRef(warp)
  warpRef.current = warp
  const { motion } = useFxPrefs()

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const still = motionOff()

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

    const stars: Star[] = Array.from({ length: 320 }, () => {
      const z = 0.3 + Math.random() * 1.3
      return { x: Math.random(), y: Math.random(), z, r: 0.4 + z * 0.9, c: STAR_COLORS[(Math.random() * STAR_COLORS.length) | 0], ph: Math.random() * 6.28 }
    })
    let shooting: { x: number; y: number; vx: number; vy: number; born: number } | null = null
    let nextShot = performance.now() + 2500
    let speed = 1 // eased toward the target speed so the warp never jumps
    let planetY = 0.78
    let last = performance.now()

    const drawPlanet = () => {
      const px = W * 0.16
      const py = H * planetY
      const pr = Math.min(W, H) * 0.16
      const g = ctx.createRadialGradient(px - pr * 0.35, py - pr * 0.4, pr * 0.1, px, py, pr)
      g.addColorStop(0, '#9fd2ff')
      g.addColorStop(0.45, '#3f6fd8')
      g.addColorStop(1, '#0d1747')
      ctx.globalAlpha = 0.9
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(px, py, pr, 0, Math.PI * 2)
      ctx.fill()
      // atmosphere glow
      const halo = ctx.createRadialGradient(px, py, pr * 0.95, px, py, pr * 1.35)
      halo.addColorStop(0, 'rgba(120,180,255,0.35)')
      halo.addColorStop(1, 'rgba(120,180,255,0)')
      ctx.fillStyle = halo
      ctx.beginPath()
      ctx.arc(px, py, pr * 1.35, 0, Math.PI * 2)
      ctx.fill()
      // ring
      ctx.globalAlpha = 0.75
      ctx.strokeStyle = 'rgba(255,214,140,0.8)'
      ctx.lineWidth = Math.max(2, pr * 0.05)
      ctx.beginPath()
      ctx.ellipse(px, py, pr * 1.7, pr * 0.32, -0.32, 0, Math.PI * 2)
      ctx.stroke()
      ctx.globalAlpha = 1
    }

    const draw = (now: number) => {
      const dt = Math.min(50, now - last)
      last = now
      ctx.clearRect(0, 0, W, H)

      // Speed: a slow drift at rest, faster with the log of the multiplier on screen.
      const target = 1 + 9 * Math.log(Math.max(1, warpRef.current))
      speed += (target - speed) * 0.06
      const streak = Math.max(0, speed - 3)

      if (!still) planetY += 0.000004 * speed * dt
      if (planetY > 1.5) planetY = -0.4
      drawPlanet()

      for (const s of stars) {
        const v = 0.000018 * s.z * speed * dt
        if (!still) s.y += v
        if (s.y > 1.02) {
          s.y -= 1.04
          s.x = Math.random()
        }
        const x = s.x * W
        const y = s.y * H
        const tw = 0.6 + 0.4 * Math.sin(now * 0.002 + s.ph)
        ctx.globalAlpha = Math.min(1, (0.35 + 0.5 * s.z) * tw)
        if (streak > 0) {
          ctx.strokeStyle = s.c
          ctx.lineWidth = s.r
          ctx.beginPath()
          ctx.moveTo(x, y)
          ctx.lineTo(x, y - streak * s.z * 6)
          ctx.stroke()
        } else {
          ctx.fillStyle = s.c
          ctx.beginPath()
          ctx.arc(x, y, s.r, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      // A shooting star every few seconds.
      if (!still && !shooting && now > nextShot) {
        shooting = { x: Math.random() * W * 0.8 + W * 0.2, y: Math.random() * H * 0.3, vx: -(6 + Math.random() * 4), vy: 3 + Math.random() * 2, born: now }
        nextShot = now + 3500 + Math.random() * 4000
      }
      if (shooting) {
        const k = (now - shooting.born) / 900
        if (k >= 1) shooting = null
        else {
          shooting.x += shooting.vx * (dt / 16)
          shooting.y += shooting.vy * (dt / 16)
          const g = ctx.createLinearGradient(shooting.x, shooting.y, shooting.x - shooting.vx * 14, shooting.y - shooting.vy * 14)
          g.addColorStop(0, 'rgba(255,255,255,0.95)')
          g.addColorStop(1, 'rgba(255,255,255,0)')
          ctx.globalAlpha = 1 - k
          ctx.strokeStyle = g
          ctx.lineWidth = 2
          ctx.beginPath()
          ctx.moveTo(shooting.x, shooting.y)
          ctx.lineTo(shooting.x - shooting.vx * 14, shooting.y - shooting.vy * 14)
          ctx.stroke()
        }
      }
      ctx.globalAlpha = 1
    }

    let raf = 0
    const loop = (now: number) => {
      draw(now)
      raf = requestAnimationFrame(loop)
    }
    if (still) draw(performance.now())
    else raf = requestAnimationFrame(loop)
    const onResize = () => {
      resize()
      if (still) draw(performance.now())
    }
    window.addEventListener('resize', onResize)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
    }
  }, [motion])

  return (
    <div className="backdrop backdrop-space" aria-hidden>
      <canvas ref={ref} />
    </div>
  )
}
