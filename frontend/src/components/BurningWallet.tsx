import { shortHash } from '../lib/format'
import { prefersReducedMotion } from '../lib/themes'
import { FireCanvas, type Emitter } from './FireCanvas'

// Loss effect: the player's generated sim wallet catches fire, big, at the bottom of
// the screen behind the result card. Only shown when the round is net negative. The
// card carries the readable result ("−10 CHIP, your wallet caught fire").
// `intensity` is the share of the stake that was lost (0 to 1).
//
// variant 'full' (Monad theme): the whole wallet burns and chars.
// variant 'top' (Americana, small loss): the top edge burns and play-money bills fly
// out burning, but the wallet survives.
// Wallet colors come from CSS variables, so each theme can restyle it.

interface Props {
  wallet: string | null
  intensity: number
  variant?: 'full' | 'top'
}

/** How long the burn plays, so the result card stays up long enough to see it. */
export const BURN_MS = 2600

// Base geometry in px, before scaling. The wallet (168 wide) sits on the bottom of a
// 280x280 fire canvas, which leaves room above it for flames and flying bills.
export const BASE = 280
const WALLET_W = 168
const WALLET_TOP = BASE - 117.6 + (117.6 * 14) / 84 // y of the wallet body's top edge

const TOP_FIRE: Emitter[] = [{ x0: 76, x1: 204, y: WALLET_TOP, rate: 3.6, size: 36 }]
const FULL_FIRE: Emitter[] = [
  { x0: 70, x1: 210, y: WALLET_TOP, rate: 4, size: 46 },
  { x0: 70, x1: 210, y: WALLET_TOP + 38, rate: 3, size: 52 },
  { x0: 76, x1: 204, y: BASE - 20, rate: 2.4, size: 42 },
]
const BILLS_FROM = { x: BASE / 2, y: WALLET_TOP - 4 }

/** How much to blow up the effects: about 1.9x on a laptop, smaller to fit a phone. */
export function fxScale(base = BASE, max = 1.9) {
  if (typeof window === 'undefined') return 1
  return Math.max(1, Math.min(max, (window.innerWidth - 32) / base, (window.innerHeight * 0.62) / base))
}

export function WalletSvg({ wallet, width }: { wallet: string | null; width?: number }) {
  return (
    <svg className="burn-wallet" viewBox="0 0 120 84" style={width ? { width } : undefined}>
      <defs>
        <linearGradient id="char" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#120c08" />
          <stop offset="0.55" stopColor="#3a1d10" />
          <stop offset="1" stopColor="#3a1d10" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="char-top" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1a0d06" />
          <stop offset="0.45" stopColor="#3a1d10" stopOpacity="0.6" />
          <stop offset="0.7" stopColor="#3a1d10" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Bills sticking out of the top of the wallet */}
      <rect className="wallet-cash" x="22" y="8" width="44" height="14" rx="1.5" transform="rotate(-6 44 15)" />
      <rect className="wallet-cash" x="40" y="6" width="44" height="14" rx="1.5" transform="rotate(5 62 13)" />
      <rect className="wallet-body" x="6" y="14" width="108" height="64" rx="10" />
      <rect className="wallet-flap" x="70" y="34" width="44" height="24" rx="7" />
      <circle className="wallet-clasp" cx="84" cy="46" r="4.5" />
      <text className="wallet-addr" x="16" y="70">
        {wallet ? shortHash(wallet) : 'sim wallet'}
      </text>
      <rect className="wallet-char" x="6" y="14" width="108" height="64" rx="10" fill="url(#char)" />
      <rect className="wallet-char-top" x="6" y="14" width="108" height="64" rx="10" fill="url(#char-top)" />
    </svg>
  )
}

export function BurningWallet({ wallet, intensity, variant = 'full' }: Props) {
  const reduced = prefersReducedMotion()
  const top = variant === 'top'
  const s = fxScale()
  // The wallet box sits centered at the bottom (12px up). The fire draws full-screen,
  // lined up with that box, so nothing it draws ever gets cut off at an edge.
  const screen =
    typeof window === 'undefined' ? undefined : { ox: (window.innerWidth - BASE * s) / 2, oy: window.innerHeight - 12 - BASE * s }

  return (
    <>
      <div
        className={`fx-bottom burn burn-${variant} ${reduced ? 'burn-static' : ''}`}
        style={{ '--burn': intensity, width: BASE * s, height: BASE * s } as React.CSSProperties}
        aria-hidden
      >
        <WalletSvg wallet={wallet} width={WALLET_W * s} />
      </div>
      {/* After the wallet, so flames draw in front of it; behind the result card. */}
      {!reduced && (
        <FireCanvas
          className="fire-canvas"
          width={BASE}
          height={BASE}
          scale={s}
          screen={screen}
          emitters={top ? TOP_FIRE : FULL_FIRE}
          intensity={top ? 0.6 : intensity}
          duration={BURN_MS}
          bills={top ? 6 : 3}
          billFrom={BILLS_FROM}
        />
      )}
    </>
  )
}
