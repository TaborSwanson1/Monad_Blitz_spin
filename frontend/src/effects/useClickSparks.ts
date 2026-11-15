import { useEffect } from 'react'
import { reducedMotion } from './useOutcomeEffects'

/** Anything the player can press. Disabled buttons never fire `click`, so they get nothing. */
const CLICKABLE = 'button, [role="button"], a[href], summary, input[type="checkbox"], input[type="radio"]'

/**
 * A spark burst from every clickable element: a flash, a ring, and 32 particles. Mount once (in App).
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

      const colors = ['#ffffff', 'var(--primary)', 'var(--secondary)', '#8fc4ff', '#836ef9', '#c7b8ff']
      const batch: HTMLElement[] = []
      const add = (el: HTMLElement) => {
        el.addEventListener('animationend', () => el.remove(), { once: true })
        layer.appendChild(el)
        batch.push(el)
      }

      // a bright flash and an expanding ring at the click point
      for (const cls of ['fx-click-flash', 'fx-click-ring']) {
        const el = document.createElement('span')
        el.className = cls
        el.style.cssText = `left:${x}px;top:${y}px`
        add(el)
      }

      // 32 particles: dots, squares and streaks, flung out then pulled down a little
      const n = 32
      for (let i = 0; i < n; i++) {
        const s = document.createElement('span')
        const shape = i % 4 === 0 ? 'streak' : i % 4 === 1 ? 'square' : 'dot'
        s.className = `fx-spark fx-spark-${shape}`
        const a = (i / n) * Math.PI * 2 + Math.random() * 0.4
        const d = 60 + Math.random() * 110
        const size = shape === 'streak' ? 3 + Math.random() * 2 : 6 + Math.random() * 7
        const dx = Math.cos(a) * d
        const dy = Math.sin(a) * d
        s.style.cssText =
          `left:${x}px;top:${y}px;width:${size}px;height:${shape === 'streak' ? size * 5 : size}px;` +
          `--c:${colors[i % colors.length]};--dx:${dx}px;--dy:${dy}px;--fall:${20 + Math.random() * 40}px;` +
          `--a:${(a * 180) / Math.PI + 90}deg;--spin:${(Math.random() * 2 - 1) * 540}deg;` +
          `--dur:${600 + Math.random() * 400}ms`
        add(s)
      }
      // Fallback in case animationend never fires (tab hidden, animations disabled).
      setTimeout(() => batch.forEach((s) => s.remove()), 1400)
    }

    document.addEventListener('click', onClick, true)
    return () => {
      document.removeEventListener('click', onClick, true)
      layer.remove()
    }
  }, [])
}
