import { fmtChips, shortHash } from '../lib/format'
import { prefersReducedMotion } from '../lib/themes'

// Loss effect for the Monad theme: the player's generated sim wallet catches fire and
// chars. Only shown when the round is net negative. `intensity` is the share of the
// stake that was lost (0 to 1), so a small net loss gets a small fire.

interface Props {
  wallet: string | null
  lost: bigint
  intensity: number
}

/** How long the burn plays, so the result card stays up long enough to see it. */
export const BURN_MS = 2600

export function BurningWallet({ wallet, lost, intensity }: Props) {
  const reduced = prefersReducedMotion()
  const flames = Math.round(3 + 4 * intensity)

  return (
    <div
      className={`burn ${reduced ? 'burn-static' : ''}`}
      style={{ '--burn': intensity } as React.CSSProperties}
      role="img"
      aria-label={`Your wallet lost ${fmtChips(lost)} CHIP this round`}
    >
      <div className="burn-stage" aria-hidden>
        <svg className="burn-wallet" viewBox="0 0 120 84">
          <defs>
            <linearGradient id="char" x1="0" y1="1" x2="0" y2="0">
              <stop offset="0" stopColor="#120c08" />
              <stop offset="0.55" stopColor="#3a1d10" />
              <stop offset="1" stopColor="#3a1d10" stopOpacity="0" />
            </linearGradient>
          </defs>
          <rect className="wallet-body" x="6" y="14" width="108" height="64" rx="10" />
          <rect className="wallet-flap" x="70" y="34" width="44" height="24" rx="7" />
          <circle className="wallet-clasp" cx="84" cy="46" r="4.5" />
          <path className="wallet-top" d="M14 14 L92 4 a6 6 0 0 1 7 5 L100 14" />
          <text className="wallet-addr" x="16" y="70">
            {wallet ? shortHash(wallet) : 'sim wallet'}
          </text>
          <rect className="wallet-char" x="6" y="14" width="108" height="64" rx="10" fill="url(#char)" />
        </svg>
        {!reduced && (
          <div className="flames">
            {Array.from({ length: flames }, (_, i) => (
              <span
                key={i}
                className="flame"
                style={
                  {
                    '--x': `${8 + (84 / Math.max(1, flames - 1)) * i}%`,
                    '--d': `${(i % 3) * 0.12}s`,
                    '--h': `${0.7 + ((i * 37) % 30) / 100}`,
                  } as React.CSSProperties
                }
              />
            ))}
            {Array.from({ length: 10 }, (_, i) => (
              <span
                key={`e${i}`}
                className="ember"
                style={{ '--x': `${(i * 23) % 100}%`, '--d': `${0.3 + (i % 5) * 0.25}s` } as React.CSSProperties}
              />
            ))}
          </div>
        )}
      </div>
      <div className="burn-caption">
        <span className="neg">−{fmtChips(lost)} CHIP</span> burned from your wallet
      </div>
    </div>
  )
}
