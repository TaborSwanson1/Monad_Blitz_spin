import { useEffect } from 'react'
import { reducedMotion } from './useOutcomeEffects'

/** Anything the player can press. Disabled buttons never fire `click`, so they get nothing. */
const CLICKABLE = 'button, [role="button"], a[href], summary, input[type="checkbox"], input[type="radio"]'

/**
 * A small spark burst from every clickable element. Mount once (in App).
 * Plain DOM, no React state: each spark removes itself when its animation ends.
 * Colours are the button's own plus the app's blue and purple accents, the same for every
 * button, so a bet click looks like any other click and is never styled like a win.
 */
export function useClickSparks() {
  useEffect(() => {
    const layer = document.createElement('div')
    layer.className = 'fx-sparks'
    layer.setAttribute('aria-hidden', 'true')
    document.body.appendChild(layer)

    const onClick = (e: MouseEvent) => {
      if (reducedMotion()) return
      const el = (e.target as Element | null)?.closest?.(CLICKABLE)
      if (!el) return
      const r = el.getBoundingClientRect()
      // Keyboard activation has no pointer position: use the button's centre.
      const fromPointer = e.detail > 0 && e.clientX + e.clientY > 0
      const x = fromPointer ? e.clientX : r.left + r.width / 2
      const y = fromPointer ? e.clientY : r.top + r.height / 2

      const colors = ['#ffffff', 'var(--primary)', 'var(--secondary)', '#8fc4ff', getComputedStyle(el).color]

      const n = 20
      const batch: HTMLSpanElement[] = []
      for (let i = 0; i < n; i++) {
        const s = document.createElement('span')
        s.className = 'fx-spark'
        const a = (i / n) * Math.PI * 2 + Math.random() * 0.5
        const d = 40 + Math.random() * 70
        const size = 4 + Math.random() * 5
        s.style.cssText =
          `left:${x}px;top:${y}px;width:${size}px;height:${size}px;` +
          `--c:${colors[i % colors.length]};--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d}px;` +
          `--dur:${480 + Math.random() * 320}ms`
        s.addEventListener('animationend', () => s.remove(), { once: true })
        layer.appendChild(s)
        batch.push(s)
      }
      // Fallback in case animationend never fires (tab hidden, animations disabled).
      setTimeout(() => batch.forEach((s) => s.remove()), 1000)
    }

    document.addEventListener('click', onClick, true)
    return () => {
      document.removeEventListener('click', onClick, true)
      layer.remove()
    }
  }, [])
}
