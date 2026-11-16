// Tile artwork for the lobby, drawn in SVG so there are no image files. Owner: Zander.

import type { ReactElement } from 'react'
import { Rocket } from '../Rocket'

export type ArtId = 'highlow' | 'digit' | 'race' | 'crash' | 'beauty' | 'slot' | 'walk'

export function GameArt({ id }: { id: ArtId }) {
  return (
    <svg className="art-svg" viewBox="0 0 160 200" aria-hidden preserveAspectRatio="xMidYMid slice">
      {ART[id]}
    </svg>
  )
}

const ART: Record<ArtId, ReactElement> = {
  highlow: (
    <g>
      <text x="80" y="120" textAnchor="middle" className="art-num">50</text>
      <path d="M80 30 l16 18 h-32 z" className="art-up" />
      <path d="M80 172 l16 -18 h-32 z" className="art-down" />
    </g>
  ),
  digit: (
    <g>
      <circle cx="80" cy="100" r="46" className="art-ring" />
      <text x="80" y="122" textAnchor="middle" className="art-num">7</text>
    </g>
  ),
  race: (
    <g>
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          <rect x="22" y={52 + i * 26} width="116" height="14" rx="7" className="art-track" />
          <rect x="22" y={52 + i * 26} width={[96, 64, 112, 78][i]} height="14" rx="7" className={`art-lane art-lane-${i}`} />
        </g>
      ))}
    </g>
  ),
  crash: (
    <g>
      <path d="M18 168 C 70 166, 104 140, 130 52" className="art-curve" />
      <g transform="translate(130 52) rotate(-73) scale(0.95)">
        <Rocket />
      </g>
      <text x="24" y="58" className="art-label">2.37×</text>
    </g>
  ),
  beauty: (
    <g>
      <line x1="20" y1="120" x2="140" y2="120" className="art-axis" />
      {[30, 44, 52, 61, 70, 82, 96, 118].map((x, i) => (
        <circle key={i} cx={x} cy={120 - ((i * 37) % 3) * 12 - 10} r="5" className="art-pip" />
      ))}
      <line x1="58" y1="60" x2="58" y2="132" className="art-target" />
      <text x="58" y="52" textAnchor="middle" className="art-label">⅔</text>
    </g>
  ),
  slot: (
    <g>
      {[0, 1, 2].map((i) => (
        <rect key={i} x={20 + i * 42} y="62" width="36" height="76" rx="8" className="art-reel" />
      ))}
      <text x="38" y="112" textAnchor="middle" className="art-sym">☘</text>
      <text x="80" y="112" textAnchor="middle" className="art-sym">◎</text>
      <text x="122" y="112" textAnchor="middle" className="art-sym">☘</text>
    </g>
  ),
  walk: (
    <g>
      <line x1="16" y1="100" x2="144" y2="100" className="art-axis" />
      <polyline points="16,100 32,84 48,100 64,84 80,68 96,84 112,68 128,52 144,68" className="art-curve" />
    </g>
  ),
}
