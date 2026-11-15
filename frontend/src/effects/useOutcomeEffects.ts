import { useEffect, useState, type CSSProperties } from 'react'
import type { RoundRecord } from '../hooks/useCasino'

export const reducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

/**
 * Win effect size, 0 to 1, from the round's real net result.
 * Zero whenever the round paid back no more than was staked, even if one bet in it won:
 * no fanfare for a payout below the stake. Otherwise it grows with payout / stake on a
 * log scale: 1.96x is about 0.3, 9.8x is about 1.
 */
export function winIntensity(r: RoundRecord): number {
  if (r.net <= 0n || r.staked === 0n) return 0
  const ratio = Number((r.paid * 1000n) / r.staked) / 1000
  return Math.max(0.2, Math.min(1, Math.log2(ratio) / Math.log2(10)))
}

/** True for `ms` after `on` turns true, then false, so effect layers unmount and leave no nodes. */
export function useTimedFlag(on: boolean, ms: number): boolean {
  const [active, setActive] = useState(false)
  useEffect(() => {
    if (!on) return
    setActive(true)
    const t = setTimeout(() => setActive(false), ms)
    return () => clearTimeout(t)
  }, [on, ms])
  return active
}

/** `ready` is false while something (the crash replay) still hides the result. */
export function useWinEffects(record: RoundRecord, ready: boolean) {
  const intensity = ready ? winIntensity(record) : 0
  const durationMs = Math.round(1300 + 700 * intensity)
  const particles = useTimedFlag(intensity > 0 && !reducedMotion(), durationMs + 300)
  return {
    intensity,
    particles,
    durationMs,
    coinCount: Math.round(15 + 15 * intensity),
    confettiCount: Math.round(40 + 120 * intensity),
    cardClass: intensity > 0 ? 'fx-glow' : '',
    cardStyle: { '--intensity': intensity, '--glow-pulses': intensity >= 0.6 ? 3 : 2 } as CSSProperties,
  }
}

/** Loss effects only when the round's net is negative. A break-even round gets nothing. */
export function useLoseEffects(record: RoundRecord, ready: boolean) {
  const lost = ready && record.net < 0n
  const motion = !reducedMotion()
  const particles = useTimedFlag(lost && motion, 1200)
  return { lost, particles, cardClass: lost && motion ? 'fx-shake' : '' }
}
