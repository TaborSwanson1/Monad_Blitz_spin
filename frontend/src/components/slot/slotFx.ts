// Win effects for the slot, drawn by us on one canvas that covers the scene:
// gold coins, play-money bills, flames on the reel frame, sparks and fireworks.
// The caller decides how much to show; SlotScreen ties every call to a real result
// (or, in the near-miss demo only, to a tease). Nothing here knows about payouts.
// Owner: Zander.

export type Palette = 'fire' | 'ice' | 'pink'

export interface SlotFx {
  /** Coins thrown up from the payline. `power` around 1. */
  coinBurst(count: number, power?: number): void
  /** Coins falling across the whole scene for `ms`. */
  coinRain(count: number, ms: number): void
  /** Bills drifting down across the scene for `ms`. */
  bills(count: number, ms: number): void
  /** Sparks from the middle of the reels. */
  sparks(count: number): void
  /** Bursts of sparks at random spots over `ms`. */
  fireworks(bursts: number, ms: number): void
  /** Flames on the reel frame. `level` 0 to 1, for `ms`. */
  heat(level: number, ms: number, palette?: Palette): void
  /** A wall of flames along the bottom of the scene for `ms`. */
  ground(ms: number, palette?: Palette): void
  destroy(): void
}

const COIN = 0
const BILL = 1
const FLAME = 2
const SPARK = 3
const MAX_PARTICLES = 900
const GRAVITY = 1500

interface Particle {
  kind: number
  x: number
  y: number
  vx: number
  vy: number
  age: number
  life: number
  size: number
  phase: number
  spin: number
  /** Flame: palette index. Spark: hue. */
  tint: number
}

interface Stream {
  kind: 'coins' | 'bills' | 'ground' | 'fireworks'
  rate: number
  until: number
  acc: number
  tint: number
}

const PALETTES: Record<Palette, string[]> = {
  fire: ['#fff3b0', '#ff9a2e', '#e3202f'],
  ice: ['#ffffff', '#5fe3ff', '#1b6fe0'],
  pink: ['#ffe0f0', '#ff4fa3', '#a01060'],
}
const PALETTE_IDS: Palette[] = ['fire', 'ice', 'pink']

const rand = (a: number, b: number) => a + Math.random() * (b - a)

/** Soft round glow, one per flame colour, drawn once and reused. */
function glowSprite(color: string): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')
  if (g) {
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32)
    grad.addColorStop(0, color)
    grad.addColorStop(0.18, color)
    grad.addColorStop(1, 'rgba(0,0,0,0)')
    g.fillStyle = grad
    g.fillRect(0, 0, 64, 64)
  }
  return c
}

/**
 * `frame` returns the reel frame element, so flames and coin bursts follow it when the
 * layout changes. Returns null if the canvas has no 2D context.
 */
export function createSlotFx(canvas: HTMLCanvasElement, frame: () => HTMLElement | null): SlotFx | null {
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  const sprites = PALETTE_IDS.map((id) => PALETTES[id].map(glowSprite))
  const particles: Particle[] = []
  const streams: Stream[] = []
  const flames = { level: 0, until: 0, acc: 0, tint: 0 }
  let width = 0
  let height = 0
  let raf = 0
  let last = 0
  let dead = false

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    width = canvas.clientWidth
    height = canvas.clientHeight
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
  }
  const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize)
  observer?.observe(canvas)
  resize()

  /** The reel frame in canvas coordinates. */
  function frameBox() {
    const el = frame()
    const c = canvas.getBoundingClientRect()
    if (!el) return { x: width * 0.3, y: height * 0.25, w: width * 0.4, h: height * 0.5 }
    const r = el.getBoundingClientRect()
    return { x: r.left - c.left, y: r.top - c.top, w: r.width, h: r.height }
  }

  function add(p: Particle) {
    if (particles.length < MAX_PARTICLES) particles.push(p)
  }
  const coin = (x: number, y: number, vx: number, vy: number): Particle => ({
    kind: COIN, x, y, vx, vy, age: 0, life: 6, size: rand(9, 15), phase: rand(0, 6.28), spin: rand(8, 16), tint: 0,
  })
  const flame = (x: number, y: number, size: number, rise: number, tint: number, life = rand(0.45, 0.95)): Particle => ({
    kind: FLAME, x, y, vx: rand(-26, 26), vy: -rise, age: 0, life, size, phase: rand(0, 6.28), spin: rand(5, 9), tint,
  })
  function burstSparks(x: number, y: number, count: number, hue: number) {
    for (let i = 0; i < count; i++) {
      const a = rand(0, 6.28)
      const v = rand(120, 520)
      add({ kind: SPARK, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, age: 0, life: rand(0.5, 1.1), size: rand(1.5, 3), phase: 0, spin: 0, tint: hue + rand(-12, 12) })
    }
  }

  function emit(dt: number, now: number) {
    // flames on the frame: mostly the top edge, some up the sides
    if (flames.level > 0) {
      if (now > flames.until) flames.level = 0
      else {
        const f = frameBox()
        flames.acc += (120 + 240 * flames.level) * dt
        while (flames.acc >= 1) {
          flames.acc -= 1
          const size = rand(14, 20 + 20 * flames.level)
          const rise = rand(130, 220 + 160 * flames.level)
          const edge = Math.random()
          if (edge < 0.64) add(flame(f.x + rand(0, f.w), f.y + 8, size, rise, flames.tint))
          else add(flame(edge < 0.82 ? f.x + 5 : f.x + f.w - 5, f.y + rand(f.h * 0.3, f.h), size * 0.75, rise, flames.tint))
        }
      }
    }
    for (let i = streams.length - 1; i >= 0; i--) {
      const s = streams[i]
      if (now > s.until) {
        streams.splice(i, 1)
        continue
      }
      s.acc += s.rate * dt
      while (s.acc >= 1) {
        s.acc -= 1
        if (s.kind === 'coins') add(coin(rand(0, width), -20, rand(-40, 40), rand(150, 420)))
        else if (s.kind === 'bills')
          add({ kind: BILL, x: rand(0, width), y: -30, vx: 0, vy: rand(70, 150), age: 0, life: 12, size: rand(0.85, 1.2), phase: rand(0, 6.28), spin: rand(3, 5), tint: 0 })
        else if (s.kind === 'ground') add(flame(rand(0, width), height + 10, rand(18, 34), rand(90, 200), s.tint, rand(0.35, 0.75)))
        else burstSparks(rand(width * 0.12, width * 0.88), rand(height * 0.1, height * 0.5), 46, [45, 190, 320, 130][Math.floor(rand(0, 4))])
      }
    }
  }

  function update(dt: number) {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]
      p.age += dt
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.phase += p.spin * dt
      if (p.kind === COIN) p.vy += GRAVITY * dt
      else if (p.kind === BILL) p.x += Math.sin(p.phase) * 46 * dt
      else if (p.kind === SPARK) {
        p.vy += 500 * dt
        p.vx *= 1 - 1.2 * dt
      } else p.x += Math.sin(p.phase) * 22 * dt
      if (p.age > p.life || p.y > height + 60) particles.splice(i, 1)
    }
  }

  function draw() {
    ctx!.clearRect(0, 0, width, height)
    // glow first (additive), then solid coins and bills on top
    ctx!.globalCompositeOperation = 'lighter'
    for (const p of particles) {
      const k = p.age / p.life
      if (p.kind === FLAME) {
        const s = p.size * (1 - 0.75 * k)
        ctx!.globalAlpha = 0.5 * (1 - k) ** 1.1
        ctx!.drawImage(sprites[p.tint][k < 0.14 ? 0 : k < 0.5 ? 1 : 2], p.x - s, p.y - s * 1.5, s * 2, s * 3)
      } else if (p.kind === SPARK) {
        ctx!.globalAlpha = 1 - k
        ctx!.strokeStyle = `hsl(${p.tint} 100% 70%)`
        ctx!.lineWidth = p.size
        ctx!.beginPath()
        ctx!.moveTo(p.x, p.y)
        ctx!.lineTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035)
        ctx!.stroke()
      }
    }
    ctx!.globalCompositeOperation = 'source-over'
    ctx!.globalAlpha = 1
    for (const p of particles) {
      if (p.kind === COIN) {
        const w = Math.max(0.16, Math.abs(Math.cos(p.phase))) * p.size
        ctx!.fillStyle = '#a8760f'
        ctx!.beginPath()
        ctx!.ellipse(p.x, p.y, w, p.size, 0, 0, 6.2832)
        ctx!.fill()
        ctx!.fillStyle = '#f6c443'
        ctx!.beginPath()
        ctx!.ellipse(p.x, p.y, w * 0.78, p.size * 0.78, 0, 0, 6.2832)
        ctx!.fill()
        ctx!.fillStyle = '#fff3b0'
        ctx!.beginPath()
        ctx!.ellipse(p.x - w * 0.25, p.y - p.size * 0.3, w * 0.22, p.size * 0.28, 0, 0, 6.2832)
        ctx!.fill()
      } else if (p.kind === BILL) {
        // play-money note: green with a diamond, no currency sign
        const bw = 34 * p.size
        const bh = 18 * p.size
        ctx!.save()
        ctx!.translate(p.x, p.y)
        ctx!.rotate(Math.sin(p.phase * 0.7) * 0.6)
        ctx!.scale(1, Math.max(0.2, Math.abs(Math.cos(p.phase * 0.9))))
        ctx!.fillStyle = '#1f8f4c'
        ctx!.fillRect(-bw / 2, -bh / 2, bw, bh)
        ctx!.strokeStyle = '#bff5cf'
        ctx!.lineWidth = 1.5
        ctx!.strokeRect(-bw / 2 + 2.5, -bh / 2 + 2.5, bw - 5, bh - 5)
        ctx!.fillStyle = '#eafcff'
        ctx!.beginPath()
        ctx!.moveTo(0, -bh * 0.28)
        ctx!.lineTo(bh * 0.3, 0)
        ctx!.lineTo(0, bh * 0.28)
        ctx!.lineTo(-bh * 0.3, 0)
        ctx!.closePath()
        ctx!.fill()
        ctx!.restore()
      }
    }
  }

  function loop(t: number) {
    raf = 0
    if (dead) return
    const dt = Math.min(0.034, (t - last) / 1000)
    last = t
    emit(dt, t)
    update(dt)
    draw()
    if (particles.length > 0 || streams.length > 0 || flames.level > 0) raf = requestAnimationFrame(loop)
  }
  function wake() {
    if (dead || raf) return
    last = performance.now()
    raf = requestAnimationFrame(loop)
  }
  const tintOf = (p: Palette | undefined) => PALETTE_IDS.indexOf(p ?? 'fire')
  const stream = (kind: Stream['kind'], count: number, ms: number, tint = 0) => {
    if (count <= 0 || ms <= 0) return
    streams.push({ kind, rate: count / (ms / 1000), until: performance.now() + ms, acc: 0, tint })
    wake()
  }

  return {
    coinBurst(count, power = 1) {
      const f = frameBox()
      for (let i = 0; i < count; i++) add(coin(f.x + rand(f.w * 0.1, f.w * 0.9), f.y + f.h / 2, rand(-260, 260), -rand(420, 940) * power))
      wake()
    },
    coinRain: (count, ms) => stream('coins', count, ms),
    bills: (count, ms) => stream('bills', count, ms),
    sparks(count) {
      const f = frameBox()
      burstSparks(f.x + f.w / 2, f.y + f.h / 2, count, 45)
      wake()
    },
    fireworks: (bursts, ms) => stream('fireworks', bursts, ms),
    heat(level, ms, palette) {
      flames.level = Math.max(0, Math.min(1, level))
      flames.until = performance.now() + ms
      flames.tint = tintOf(palette)
      wake()
    },
    ground: (ms, palette) => stream('ground', (300 * ms) / 1000, ms, tintOf(palette)),
    destroy() {
      dead = true
      if (raf) cancelAnimationFrame(raf)
      observer?.disconnect()
      particles.length = 0
      streams.length = 0
      ctx.clearRect(0, 0, width, height)
    },
  }
}
