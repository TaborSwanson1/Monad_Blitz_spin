// Symbol art for the slot, drawn by us in SVG. No image files and no emoji, so it looks
// the same on every device. Each symbol is defined once (<SymbolDefs/>) and reused with <use>.
// Symbol ids match lib/slot.ts: 0 blank, 1 cherry, 2 bell, 3 bar, 4 seven, 5 wild, 6 diamond, 7 star.
// Owner: Zander.

const STAR = Array.from({ length: 10 }, (_, i) => {
  const r = i % 2 ? 11.5 : 27
  const a = -Math.PI / 2 + (i * Math.PI) / 5
  return `${(32 + r * Math.cos(a)).toFixed(1)},${(34 + r * Math.sin(a)).toFixed(1)}`
}).join(' ')

/** Render once per page, before any <Sym/>. */
export function SymbolDefs() {
  return (
    <svg className="sl-defs" aria-hidden focusable="false">
      <defs>
        <linearGradient id="sl-g-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff6c4" />
          <stop offset="0.5" stopColor="#f6c443" />
          <stop offset="1" stopColor="#b7740c" />
        </linearGradient>
        <radialGradient id="sl-g-red" cx="0.35" cy="0.3" r="0.85">
          <stop offset="0" stopColor="#ff9a9a" />
          <stop offset="0.45" stopColor="#e3202f" />
          <stop offset="1" stopColor="#84101b" />
        </radialGradient>
        <linearGradient id="sl-g-seven" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ff7a66" />
          <stop offset="1" stopColor="#c2101f" />
        </linearGradient>
        <linearGradient id="sl-g-ice" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#eafcff" />
          <stop offset="0.45" stopColor="#5fe3ff" />
          <stop offset="1" stopColor="#1677d8" />
        </linearGradient>
        <linearGradient id="sl-g-violet" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#a66bff" />
          <stop offset="1" stopColor="#4b1fa8" />
        </linearGradient>
        <linearGradient id="sl-g-bar" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3a3f5c" />
          <stop offset="1" stopColor="#12142a" />
        </linearGradient>
      </defs>

      <symbol id="sl-sym-0" viewBox="0 0 64 64">
        <rect x="23" y="30" width="18" height="4" rx="2" fill="#ffffff" opacity="0.14" />
      </symbol>

      <symbol id="sl-sym-1" viewBox="0 0 64 64">
        <path d="M21 44 C23 27 33 17 46 12" fill="none" stroke="#2c9a3c" strokeWidth="3.2" strokeLinecap="round" />
        <path d="M43 46 C42 31 44 21 46 12" fill="none" stroke="#2c9a3c" strokeWidth="3.2" strokeLinecap="round" />
        <path d="M46 12 C53 6 61 9 61 17 C54 21 49 18 46 12 Z" fill="#46bd52" stroke="#1f7a2c" strokeWidth="1.2" />
        <circle cx="21" cy="46" r="12.5" fill="url(#sl-g-red)" />
        <circle cx="43" cy="48" r="12.5" fill="url(#sl-g-red)" />
        <ellipse cx="16.5" cy="41" rx="3.6" ry="2.3" fill="#fff" opacity="0.65" />
        <ellipse cx="38.5" cy="43" rx="3.6" ry="2.3" fill="#fff" opacity="0.65" />
      </symbol>

      <symbol id="sl-sym-2" viewBox="0 0 64 64">
        <rect x="28.5" y="5" width="7" height="7" rx="3.5" fill="#b7740c" />
        <path
          d="M32 9 C22 9 17 18 17 29 L17 38 L9 48 L55 48 L47 38 L47 29 C47 18 42 9 32 9 Z"
          fill="url(#sl-g-gold)"
          stroke="#8a560a"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path d="M13 43 H51" stroke="#8a560a" strokeWidth="1.5" opacity="0.6" />
        <circle cx="32" cy="53.5" r="5" fill="#d99a1c" stroke="#8a560a" strokeWidth="1.5" />
        <path d="M24 17 C22 21 21 26 21 31" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity="0.6" fill="none" />
      </symbol>

      <symbol id="sl-sym-3" viewBox="0 0 64 64">
        <rect x="4" y="19" width="56" height="26" rx="8" fill="url(#sl-g-bar)" stroke="url(#sl-g-gold)" strokeWidth="3" />
        <text
          x="32"
          y="38.6"
          textAnchor="middle"
          fontSize="18"
          fontWeight="900"
          fill="#fff6c4"
          letterSpacing="2.5"
          fontFamily="Georgia, 'Times New Roman', serif"
        >
          BAR
        </text>
      </symbol>

      <symbol id="sl-sym-4" viewBox="0 0 64 64">
        <path
          d="M13 9 H53 V18 C43 28 37 41 35 57 H21 C23 41 29 30 38 21 H13 Z"
          fill="url(#sl-g-seven)"
          stroke="#fff6c4"
          strokeWidth="2.6"
          strokeLinejoin="round"
        />
        <path d="M17 13 H48" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
      </symbol>

      <symbol id="sl-sym-5" viewBox="0 0 64 64">
        <path d="M32 4 L57 18 V46 L32 60 L7 46 V18 Z" fill="url(#sl-g-violet)" stroke="url(#sl-g-gold)" strokeWidth="3" strokeLinejoin="round" />
        <path d="M32 9 L52 20.5 V30 H12 V20.5 Z" fill="#fff" opacity="0.12" />
        <text x="32" y="38.4" textAnchor="middle" fontSize="15.5" fontWeight="900" fill="#ffe27a" letterSpacing="0.6" fontFamily="system-ui, 'Segoe UI', sans-serif">
          WILD
        </text>
      </symbol>

      <symbol id="sl-sym-6" viewBox="0 0 64 64">
        <path d="M18 11 H46 L59 26 L32 57 L5 26 Z" fill="url(#sl-g-ice)" stroke="#f1fdff" strokeWidth="2.2" strokeLinejoin="round" />
        <path
          d="M5 26 H59 M18 11 L25 26 L32 57 L39 26 L46 11 M25 26 L32 11 L39 26"
          fill="none"
          stroke="#f1fdff"
          strokeWidth="1.5"
          opacity="0.85"
          strokeLinejoin="round"
        />
        <path d="M18 11 L25 26 H5 Z" fill="#fff" opacity="0.35" />
      </symbol>

      <symbol id="sl-sym-7" viewBox="0 0 64 64">
        <polygon points={STAR} fill="url(#sl-g-gold)" stroke="#8a560a" strokeWidth="2" strokeLinejoin="round" />
        <circle cx="32" cy="34" r="6" fill="#fff" opacity="0.35" />
      </symbol>
    </svg>
  )
}

/** One symbol, sized by CSS. */
export function Sym({ id, className = '' }: { id: number; className?: string }) {
  return (
    <svg className={`sl-sym ${className}`} viewBox="0 0 64 64" aria-hidden focusable="false">
      <use href={`#sl-sym-${id}`} />
    </svg>
  )
}
