import { useEffect, useRef, useState } from 'react'
import { prefersReducedMotion } from '../lib/themes'
import { sfx } from '../fx/sound'

// Block Race as a stock-car race, drawn by us on a canvas: four cars (red, blue, green,
// gold), one per lane, on a banked speedway straight with a catch fence, a grandstand
// and an infield.
//
//  <Race />                 the cars on the grid, engines idling
//  <Race pace />            pace laps: shown once you've bet, while the round is open
//  <Race winner={n} />      the race itself, in the result popup, about 5.5 seconds
//
// Honest finish (CLAUDE.md, no near-miss framing): the race is a replay of a result the
// round's seed already settled. The pack runs together, swapping the lead at random,
// and on the final stretch the winning car pulls clear. The three losing cars cross
// the line level with each other, whatever you picked, so no car is ever staged as
// "almost won". Your picks are only marked with a ring; they don't change the race.

export const RACE_MS = 5600
const SPRINT_AT = 0.72 // share of the race after which the winner pulls away

const COLORS = ['#f0506e', '#4f8cff', '#2ec27e', '#e9b949']
const DARK = ['#8f1f36', '#1f47a8', '#136b43', '#8a6510']
const NUMBERS = ['7', '24', '48', '3']
const W = 640
const H = 250
const TRACK_TOP = 64
const LANE_H = 38
const CAR_L = 78
const CAR_W = 26

interface Props {
  /** Lane that wins (0 to 3). Omit for the grid or pace laps. */
  winner?: number
  /** Lanes the player bet on, marked with a ring. */
  picked?: number[]
  /** Rolling pace laps instead of a standing grid. */
  pace?: boolean
  onDone?: () => void
}

function car(ctx: CanvasRenderingContext2D, x: number, y: number, lane: number, picked: boolean, t: number) {
  ctx.save()
  ctx.translate(x, y)
  // shadow
  ctx.fillStyle = 'rgba(0,0,0,0.35)'
  ctx.beginPath()
  ctx.ellipse(2, 5, CAR_L / 2, CAR_W / 2, 0, 0, Math.PI * 2)
  ctx.fill()
  // tires
  ctx.fillStyle = '#111'
  for (const wx of [-CAR_L * 0.3, CAR_L * 0.28]) for (const wy of [-CAR_W / 2 - 1, CAR_W / 2 - 5]) ctx.fillRect(wx - 8, wy, 16, 6)
  // body: long hood, short deck, like a stock car seen from above
  const grad = ctx.createLinearGradient(0, -CAR_W / 2, 0, CAR_W / 2)
  grad.addColorStop(0, COLORS[lane])
  grad.addColorStop(0.5, '#ffffff')
  grad.addColorStop(0.52, COLORS[lane])
  grad.addColorStop(1, DARK[lane])
  ctx.fillStyle = grad
  ctx.strokeStyle = '#10131a'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.roundRect(-CAR_L / 2, -CAR_W / 2, CAR_L, CAR_W, [7, 12, 12, 7])
  ctx.fill()
  ctx.stroke()
  // windshield, roof, rear window
  ctx.fillStyle = '#0d1b2e'
  ctx.beginPath()
  ctx.roundRect(-CAR_L * 0.2, -CAR_W / 2 + 4, CAR_L * 0.42, CAR_W - 8, 4)
  ctx.fill()
  ctx.fillStyle = COLORS[lane]
  ctx.fillRect(-CAR_L * 0.1, -CAR_W / 2 + 5, CAR_L * 0.2, CAR_W - 10)
  // number on the roof
  ctx.fillStyle = '#fff'
  ctx.font = '700 12px Oswald, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(NUMBERS[lane], 0, 0.5)
  // spoiler and headlights
  ctx.fillStyle = '#10131a'
  ctx.fillRect(-CAR_L / 2 - 3, -CAR_W / 2 + 2, 4, CAR_W - 4)
  ctx.fillStyle = '#fff8c9'
  ctx.fillRect(CAR_L / 2 - 4, -CAR_W / 2 + 3, 3, 5)
  ctx.fillRect(CAR_L / 2 - 4, CAR_W / 2 - 8, 3, 5)
  if (picked) {
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 2
    ctx.setLineDash([5, 4])
    ctx.lineDashOffset = -t * 0.03
    ctx.beginPath()
    ctx.roundRect(-CAR_L / 2 - 7, -CAR_W / 2 - 7, CAR_L + 14, CAR_W + 14, 12)
    ctx.stroke()
  }
  ctx.restore()
}

function scene(ctx: CanvasRenderingContext2D, scroll: number, finishX: number | null) {
  // sky and grandstand
  ctx.fillStyle = '#16264f'
  ctx.fillRect(0, 0, W, TRACK_TOP)
  for (let x = -((scroll * 0.35) % 14); x < W; x += 14)
    for (let row = 0; row < 3; row++) {
      ctx.fillStyle = ['#f0506e', '#ffffff', '#4f8cff', '#e9b949', '#2ec27e'][Math.abs(Math.floor((x + scroll * 0.35) / 14) * 7 + row * 3) % 5]
      ctx.fillRect(x + (row % 2) * 7, 10 + row * 11, 6, 7)
    }
  // catch fence
  ctx.fillStyle = '#c9ced8'
  ctx.fillRect(0, TRACK_TOP - 16, W, 3)
  ctx.strokeStyle = 'rgba(201,206,216,0.5)'
  ctx.lineWidth = 1
  for (let x = -((scroll * 0.8) % 16); x < W; x += 16) {
    ctx.beginPath()
    ctx.moveTo(x, TRACK_TOP - 16)
    ctx.lineTo(x + 8, TRACK_TOP - 2)
    ctx.moveTo(x + 8, TRACK_TOP - 16)
    ctx.lineTo(x, TRACK_TOP - 2)
    ctx.stroke()
  }
  // wall with red and white rumble stripes
  for (let x = -(scroll % 40); x < W; x += 40) {
    ctx.fillStyle = '#e6e8ee'
    ctx.fillRect(x, TRACK_TOP - 4, 20, 6)
    ctx.fillStyle = '#d62839'
    ctx.fillRect(x + 20, TRACK_TOP - 4, 20, 6)
  }
  // asphalt
  const g = ctx.createLinearGradient(0, TRACK_TOP, 0, TRACK_TOP + LANE_H * 4)
  g.addColorStop(0, '#3b3f4a')
  g.addColorStop(1, '#24272f')
  ctx.fillStyle = g
  ctx.fillRect(0, TRACK_TOP + 2, W, LANE_H * 4 + 4)
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'
  ctx.lineWidth = 2
  ctx.setLineDash([26, 22])
  ctx.lineDashOffset = scroll
  for (let i = 1; i < 4; i++) {
    ctx.beginPath()
    ctx.moveTo(0, TRACK_TOP + 4 + i * LANE_H)
    ctx.lineTo(W, TRACK_TOP + 4 + i * LANE_H)
    ctx.stroke()
  }
  ctx.setLineDash([])
  // checkered finish line
  if (finishX !== null && finishX > -20 && finishX < W + 20) {
    const s = LANE_H / 4
    for (let r = 0; r < 16; r++)
      for (let c = 0; c < 2; c++) {
        ctx.fillStyle = (r + c) % 2 ? '#fff' : '#111'
        ctx.fillRect(finishX + c * s, TRACK_TOP + 4 + r * s, s, s)
      }
  }
  // infield grass with a yellow line
  ctx.fillStyle = '#f2c230'
  ctx.fillRect(0, TRACK_TOP + LANE_H * 4 + 6, W, 3)
  ctx.fillStyle = '#1d6b3a'
  ctx.fillRect(0, TRACK_TOP + LANE_H * 4 + 9, W, H)
  ctx.fillStyle = 'rgba(255,255,255,0.08)'
  for (let x = -(scroll % 80); x < W; x += 80) ctx.fillRect(x, TRACK_TOP + LANE_H * 4 + 9, 40, H)
}

const smooth = (x: number) => x * x * (3 - 2 * x)

export function Race({ winner, picked = [], pace = false, onDone }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  const racing = winner !== undefined
  const still = prefersReducedMotion()
  const [flag, setFlag] = useState<'green' | 'white' | 'checkered'>('green')
  const doneRef = useRef(onDone)
  doneRef.current = onDone
  const pickKey = picked.join(',')

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = W * dpr
    canvas.height = H * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const mine = pickKey ? pickKey.split(',').map(Number) : []
    // Each car weaves on its own rhythm. The rhythms are random per race and never
    // depend on the picks or (until the final stretch) on the winner.
    const ph = Array.from({ length: 4 }, () => [Math.random() * 6.28, Math.random() * 6.28, 0.7 + Math.random() * 0.8])
    const laneY = (i: number) => TRACK_TOP + 4 + LANE_H * (i + 0.5)

    const draw = (t: number, k: number) => {
      // k: race progress 0 to 1 (0 on the grid and in pace laps)
      const speed = racing ? 0.55 + 0.45 * smooth(Math.min(1, k * 5)) : pace ? 0.28 : 0
      const scroll = racing ? t * 0.62 : pace ? t * 0.2 : 0
      const sprint = racing ? smooth(Math.max(0, (k - SPRINT_AT) / (1 - SPRINT_AT))) : 0
      const finishX = racing ? W * 0.86 + (1 - k) * 2200 : null
      scene(ctx, scroll, finishX)
      for (let i = 0; i < 4; i++) {
        const weave = speed ? (Math.sin(t * 0.0021 * ph[i][2] + ph[i][0]) * 46 + Math.sin(t * 0.0047 + ph[i][1]) * 16) * (1 - sprint) : 0
        const base = racing || pace ? W * 0.42 : W * 0.2 + (3 - i) * 0 // standing grid: all level
        const x = base + weave + (racing ? (i === winner ? 150 : -40) * sprint : 0)
        const y = laneY(i) + (speed ? Math.sin(t * 0.03 + i) * 0.8 : 0)
        // speed streaks behind each car
        if (speed > 0.4) {
          ctx.strokeStyle = COLORS[i] + '66'
          ctx.lineWidth = 3
          ctx.beginPath()
          ctx.moveTo(x - CAR_L / 2 - 6, y)
          ctx.lineTo(x - CAR_L / 2 - 26 - 40 * speed, y)
          ctx.stroke()
        }
        car(ctx, x, y, i, mine.includes(i), t)
      }
    }

    if (still || (!racing && !pace)) {
      draw(0, racing ? 1 : 0)
      if (racing) {
        setFlag('checkered')
        doneRef.current?.()
      }
      return
    }

    let raf = 0
    const t0 = performance.now()
    let finished = false
    if (racing) sfx.engines(RACE_MS / 1000)
    const frame = (now: number) => {
      const t = now - t0
      const k = racing ? Math.min(1, t / RACE_MS) : 0
      draw(t, k)
      if (racing) {
        if (k >= 1 && !finished) {
          finished = true
          setFlag('checkered')
          doneRef.current?.()
          return
        }
        if (k >= SPRINT_AT) setFlag('white')
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [winner, racing, pace, still, pickKey])

  const status = racing
    ? flag === 'checkered'
      ? 'Checkered flag'
      : flag === 'white'
        ? 'Final stretch'
        : 'Green flag · replay of a settled result'
    : pace
      ? 'Pace laps · the race runs when this round settles'
      : 'On the grid · bet on a car to start the pace laps'

  return (
    <div className={`race race-${racing ? flag : pace ? 'pace' : 'grid'}`}>
      <div className="race-status">
        <i className="race-flag" aria-hidden />
        {status}
      </div>
      <canvas ref={ref} className="race-canvas" style={{ aspectRatio: `${W} / ${H}` }} aria-hidden />
    </div>
  )
}
