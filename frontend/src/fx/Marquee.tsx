import { useEffect, useRef, type ReactNode } from 'react'

// A sign framed by chasing light bulbs, like a 1970s Strip marquee. Drawn in CSS.
//
//  <Marquee tone="plaque"> the blue Americana plaque, with sweeping spotlights
//  <Marquee tone="neon">   the pink-and-gold Vegas sign
//  <Marquee tone="space">  Crash: a small black sign with blue lights
//  <Marquee tone="race">   Block Race: a pit board with checkered trim and tyre tracks
//
// `anchor="above-card"` parks it just above the result popup. Without it the sign
// sits in the page like any block (used for the game title).

interface Props {
  children: ReactNode
  tone: 'plaque' | 'neon' | 'space' | 'race'
  anchor?: 'above-card'
  spotlights?: boolean
  className?: string
}

/** Bulbs spaced evenly around the frame. Positions are percentages, so the sign can be any size. */
function Bulbs({ across = 16, down = 5 }: { across?: number; down?: number }) {
  const pts: { left: string; top: string }[] = []
  for (let i = 0; i < across; i++) pts.push({ left: `${((i + 0.5) / across) * 100}%`, top: '0%' })
  for (let i = 0; i < down; i++) pts.push({ left: '100%', top: `${((i + 0.5) / down) * 100}%` })
  for (let i = across - 1; i >= 0; i--) pts.push({ left: `${((i + 0.5) / across) * 100}%`, top: '100%' })
  for (let i = down - 1; i >= 0; i--) pts.push({ left: '0%', top: `${((i + 0.5) / down) * 100}%` })
  return (
    <div className="mq-bulbs">
      {pts.map((p, i) => (
        <i key={i} className="mq-bulb" style={{ ...p, '--i': i % 3 } as React.CSSProperties} />
      ))}
    </div>
  )
}

export function Marquee({ children, tone, anchor, spotlights = false, className = '' }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (anchor !== 'above-card') return
    const el = ref.current
    const place = () => {
      // offsetTop is the laid-out position. The card scales up as it pops in, so its
      // on-screen box is too small for the first half second.
      const card = document.querySelector<HTMLElement>('.reveal-card')
      if (!el || !card) return
      // Tell the popup how tall the sign is, so the result starts below it (fx.css).
      el.closest<HTMLElement>('.reveal')?.style.setProperty('--sign-h', `${el.offsetHeight}px`)
      el.style.top = `${Math.max(10, card.offsetTop - el.offsetHeight - 16)}px`
    }
    place()
    // The card grows when a crash replay finishes, so keep the sign glued to it.
    const id = setInterval(place, 250)
    return () => clearInterval(id)
  }, [anchor])

  return (
    <div ref={ref} className={`mq mq-${tone} ${anchor ? 'mq-above' : ''} ${className}`}>
      {spotlights && (
        <div className="mq-spots" aria-hidden>
          <i className="mq-spot mq-spot-l" />
          <i className="mq-spot mq-spot-r" />
        </div>
      )}
      <div className="mq-face">
        <Bulbs />
        <div className="mq-text">{children}</div>
      </div>
    </div>
  )
}
