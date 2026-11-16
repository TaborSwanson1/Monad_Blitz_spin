import { useEffect, useRef } from 'react'
import { motionOff, useFxPrefs } from './prefs'

// Block Race's background: a raceway seen from the driver's seat, drawn on a canvas.
//
// A straight track runs to a vanishing point near the top. Red-and-white curbs, the
// centre dashes and the grass stripes all scroll toward the viewer, and pine and round
// trees on both verges grow as they come closer. A checkered flag waves on the left
// verge, where the sidebar is see-through. The sky and the horizon haze are CSS (.backdrop-race).
//
// The speed is constant: nothing here follows a result. With motion off it paints one
// still frame and stops. Like the other backdrops it publishes the pointer as --mx/--my
// so the game sign can tilt toward the cursor.

interface Tree {
  side: -1 | 1
  d: number // distance down the track, 0 (nearest) to FAR
  lateral: number // how far off the track edge, as a multiple of the road half-width
  kind: 'pine' | 'round'
  h: number
}

const FAR = 14
const SPEED = 0.0022 // track units per ms

export function RaceBackdrop() {
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

    const trees: Tree[] = Array.from({ length: 22 }, (_, i) => ({
      side: i % 2 ? 1 : -1,
      d: (i / 22) * FAR,
      lateral: 1.15 + Math.random() * 0.9,
      kind: Math.random() < 0.6 ? 'pine' : 'round',
      h: 0.8 + Math.random() * 0.5,
    }))

    let scroll = 0
    let last = performance.now()
    const t = { x: W / 2, y: H * 0.4 }
    const m = { x: W / 2, y: H * 0.4 }
    const onMove = (e: PointerEvent) => {
      t.x = e.clientX
      t.y = e.clientY
    }

    // Perspective: a point at distance d sits at scale s = 1 / (1 + d), y = hy + (H - hy) * s.
    const drawRoad = (hy: number) => {
      const roadHalf = W * 0.46
      const span = H - hy
      for (let y = H; y > hy; y--) {
        const s = (y - hy) / span
        const d = 1 / s - 1
        const seg = Math.floor((d + scroll) * 2.2) % 2 === 0
        const curbSeg = Math.floor((d + scroll) * 7) % 2 === 0
        const half = roadHalf * s
        const cx = W / 2
        // grass, in alternating light and dark stripes
        ctx.fillStyle = seg ? '#2f8f3a' : '#2a7f34'
        ctx.fillRect(0, y - 1, W, 1.5)
        // curbs
        const curb = Math.max(2, 26 * s)
        ctx.fillStyle = curbSeg ? '#e4002b' : '#f4f4f4'
        ctx.fillRect(cx - half - curb, y - 1, curb, 1.5)
        ctx.fillRect(cx + half, y - 1, curb, 1.5)
        // asphalt, lighter toward the horizon
        const shade = Math.round(52 + 40 * (1 - s))
        ctx.fillStyle = `rgb(${shade} ${shade + 2} ${shade + 6})`
        ctx.fillRect(cx - half, y - 1, half * 2, 1.5)
        // centre dashes
        if (Math.floor((d + scroll) * 4) % 2 === 0) {
          const dash = Math.max(1, 8 * s)
          ctx.fillStyle = '#f2f2e6'
          ctx.fillRect(cx - dash / 2, y - 1, dash, 1.5)
        }
      }
      // A start/finish line close to the viewer, in a checkered band.
      const fs = 0.78
      const fy = hy + span * fs
      const half = roadHalf * fs
      const cell = Math.max(6, 18 * fs)
      for (let i = 0; i < Math.ceil((half * 2) / cell); i++) {
        for (let r = 0; r < 2; r++) {
          ctx.fillStyle = (i + r) % 2 ? '#111' : '#f6f6f6'
          ctx.fillRect(W / 2 - half + i * cell, fy + r * cell * 0.5, cell, cell * 0.5)
        }
      }
    }

    const drawTree = (tr: Tree, hy: number) => {
      const s = 1 / (1 + tr.d)
      const y = hy + (H - hy) * s
      const roadHalf = W * 0.46
      const x = W / 2 + tr.side * (roadHalf * tr.lateral + 30) * s
      const h = Math.min(H, 260) * tr.h * s
      if (h < 2) return
      const w = h * 0.55
      ctx.fillStyle = '#5a3a1e'
      ctx.fillRect(x - w * 0.08, y - h * 0.25, w * 0.16, h * 0.25)
      if (tr.kind === 'pine') {
        ctx.fillStyle = '#1f6b2f'
        for (let k = 0; k < 3; k++) {
          const top = y - h + (k * h) / 4
          const bw = w * (0.55 + k * 0.22)
          ctx.beginPath()
          ctx.moveTo(x, top)
          ctx.lineTo(x - bw / 2, top + h * 0.42)
          ctx.lineTo(x + bw / 2, top + h * 0.42)
          ctx.closePath()
          ctx.fill()
        }
      } else {
        ctx.fillStyle = '#2f8a3f'
        ctx.beginPath()
        ctx.arc(x, y - h * 0.6, w * 0.5, 0, Math.PI * 2)
        ctx.arc(x - w * 0.3, y - h * 0.45, w * 0.36, 0, Math.PI * 2)
        ctx.arc(x + w * 0.3, y - h * 0.45, w * 0.36, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    const drawFlag = (now: number) => {
      const px = Math.max(24, W * 0.05)
      const top = H * 0.5
      const cell = Math.max(12, Math.min(18, W / 75))
      const cols = 9
      const rows = 6
      ctx.fillStyle = '#d9d9d9'
      ctx.fillRect(px - 3, top - 6, 5, rows * cell + 90)
      ctx.beginPath()
      ctx.arc(px - 0.5, top - 8, 5, 0, Math.PI * 2)
      ctx.fillStyle = '#ffd200'
      ctx.fill()
      // Each column waves more the farther it is from the pole.
      const wave = (c: number) => (still ? 0 : Math.sin(now * 0.007 - c * 0.7) * 7 * (c / cols) + Math.sin(now * 0.011 + c * 0.4) * 2 * (c / cols))
      for (let c = 0; c < cols; c++) {
        const x0 = px + 2 + c * cell
        const o0 = wave(c)
        const o1 = wave(c + 1)
        for (let r = 0; r < rows; r++) {
          const y0 = top + r * cell
          ctx.fillStyle = (c + r) % 2 ? '#101010' : '#f7f7f7'
          ctx.beginPath()
          ctx.moveTo(x0, y0 + o0)
          ctx.lineTo(x0 + cell, y0 + o1)
          ctx.lineTo(x0 + cell, y0 + cell + o1)
          ctx.lineTo(x0, y0 + cell + o0)
          ctx.closePath()
          ctx.fill()
        }
      }
    }

    const draw = (now: number) => {
      const dt = Math.min(50, now - last)
      last = now
      if (!still) scroll += SPEED * dt
      m.x += (t.x - m.x) * 0.12
      m.y += (t.y - m.y) * 0.12
      root.style.setProperty('--mx', (m.x / W).toFixed(4))
      root.style.setProperty('--my', (m.y / H).toFixed(4))
      root.style.setProperty('--mxpx', `${m.x.toFixed(1)}px`)
      root.style.setProperty('--mypx', `${m.y.toFixed(1)}px`)

      ctx.clearRect(0, 0, W, H)
      const hy = H * 0.4
      drawRoad(hy)
      // Far trees first so near ones draw over them.
      for (const tr of trees) {
        if (!still) {
          tr.d -= SPEED * dt * 0.9
          if (tr.d < 0) {
            tr.d += FAR
            tr.lateral = 1.15 + Math.random() * 0.9
            tr.kind = Math.random() < 0.6 ? 'pine' : 'round'
          }
        }
      }
      for (const tr of [...trees].sort((a, b) => b.d - a.d)) drawTree(tr, hy)
      drawFlag(now)
    }

    let raf = 0
    const loop = (now: number) => {
      draw(now)
      raf = requestAnimationFrame(loop)
    }
    if (still) draw(performance.now())
    else {
      raf = requestAnimationFrame(loop)
      window.addEventListener('pointermove', onMove, { passive: true })
    }
    const onResize = () => {
      resize()
      if (still) draw(performance.now())
    }
    window.addEventListener('resize', onResize)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('resize', onResize)
    }
  }, [motion])

  return (
    <div className="backdrop backdrop-race" aria-hidden>
      <canvas ref={ref} />
    </div>
  )
}
