import type { CSSProperties } from 'react'

/** One colour per digit, so every result is colourful and the colour says nothing about winning. */
const DIGIT_COLORS = ['#ff4d6d', '#ff7a1a', '#ffd23f', '#3ddc84', '#22d3ee', '#4f8cff', '#a78bfa', '#836ef9', '#f472b6', '#ffb020']

/**
 * The result in slot-machine reel windows: one window per character, big multicoloured
 * glyphs. Each glyph drops straight into its window. No spin, so no neighbouring numbers
 * ever scroll past the result (no near-miss framing).
 */
export function SlotDisplay({ value, color, small }: { value: string; color?: string; small?: boolean }) {
  return (
    <div className={`slot ${small ? 'slot-sm' : ''}`} aria-label={value} role="img">
      {[...value].map((ch, i) => {
        const digit = /\d/.test(ch)
        const c = color ?? (digit ? DIGIT_COLORS[Number(ch)] : '#ffd23f')
        return (
          <span
            key={i}
            className={`slot-reel ${digit || color ? '' : 'slot-reel-narrow'}`}
            style={{ '--c': c, '--i': i } as CSSProperties}
            aria-hidden
          >
            <span className="slot-glyph">{ch}</span>
          </span>
        )
      })}
    </div>
  )
}
