import { useEffect, useRef, useState } from 'react'
import { reducedMotion } from './useOutcomeEffects'

/**
 * Animates a bigint toward `value` (ease-out, `ms` long) and reports the direction
 * while it moves. The first real value (from 0) and reduced-motion users jump straight to it.
 */
export function useCountUp(value: bigint, ms = 700) {
  const [shown, setShown] = useState(value)
  const [dir, setDir] = useState<'up' | 'down' | null>(null)
  const shownRef = useRef(value)

  useEffect(() => {
    const from = shownRef.current
    if (from === value) return
    if (from === 0n || reducedMotion()) {
      shownRef.current = value
      setShown(value)
      setDir(null)
      return
    }
    setDir(value > from ? 'up' : 'down')
    const t0 = performance.now()
    let raf = 0
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / ms)
      const e = 1 - (1 - k) ** 3
      const v = k >= 1 ? value : from + ((value - from) * BigInt(Math.round(e * 1e6))) / 1_000_000n
      shownRef.current = v
      setShown(v)
      if (k < 1) raf = requestAnimationFrame(step)
      else setDir(null)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value, ms])

  return { shown, dir }
}
