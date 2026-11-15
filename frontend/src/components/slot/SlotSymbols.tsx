// Symbol art for the Lucky Leprechaun slot, drawn by us in SVG. No image files and no emoji, so it
// looks the same on every device. Each symbol is defined once (<SymbolDefs/>) and reused with <use>.
// Symbol ids match lib/slot.ts:
//   0 blank, 1 clover, 2 horseshoe, 3 pot of gold, 4 hat, 5 leprechaun (wild), 6 rainbow (jackpot), 7 gold coin (scatter)
// Owner: Zander.

const STAR = Array.from({ length: 10 }, (_, i) => {
  const r = i % 2 ? 7 : 17
  const a = -Math.PI / 2 + (i * Math.PI) / 5
  return `${(32 + r * Math.cos(a)).toFixed(1)},${(33 + r * Math.sin(a)).toFixed(1)}`
}).join(' ')

/** A heart-shaped clover leaf pointing at the middle (32,30), turned by `deg`. */
const LEAF = 'M32 30 C19 23 20 8 32 14.5 C44 8 45 23 32 30 Z'
const LEAF_VEIN = 'M32 28 L32 17'

// Heap of coins for the pot: [x, y] of each coin's centre.
const POT_COINS: [number, number][] = [
  [20, 25], [29, 22], [38, 23], [46, 26], [24, 19], [34, 17], [43, 19], [29, 13], [38, 12],
]

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
        <linearGradient id="sl-g-leaf" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7dffa6" />
          <stop offset="0.55" stopColor="#25b84f" />
          <stop offset="1" stopColor="#0c6b2c" />
        </linearGradient>
        <linearGradient id="sl-g-hat" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3fd66f" />
          <stop offset="1" stopColor="#0f6a2d" />
        </linearGradient>
        <linearGradient id="sl-g-iron" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4a4f66" />
          <stop offset="1" stopColor="#101226" />
        </linearGradient>
        <linearGradient id="sl-g-beard" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffb457" />
          <stop offset="1" stopColor="#e0680f" />
        </linearGradient>
        <linearGradient id="sl-g-silver" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.5" stopColor="#c5ccdc" />
          <stop offset="1" stopColor="#7a849e" />
        </linearGradient>
      </defs>

      {/* 0: blank */}
      <symbol id="sl-sym-0" viewBox="0 0 64 64">
        <rect x="23" y="30" width="18" height="4" rx="2" fill="#ffffff" opacity="0.14" />
      </symbol>

      {/* 1: four-leaf clover */}
      <symbol id="sl-sym-1" viewBox="0 0 64 64">
        <path d="M32 31 C32 42 28 51 22 59" fill="none" stroke="#1d8f3f" strokeWidth="3.4" strokeLinecap="round" />
        {[0, 90, 180, 270].map((deg) => (
          <g key={deg} transform={`rotate(${deg} 32 30)`}>
            <path d={LEAF} fill="url(#sl-g-leaf)" stroke="#0b5a26" strokeWidth="1.4" strokeLinejoin="round" />
            <path d={LEAF_VEIN} stroke="#c9ffd9" strokeWidth="1.4" strokeLinecap="round" opacity="0.7" fill="none" />
          </g>
        ))}
        <circle cx="32" cy="30" r="2.6" fill="#0b5a26" />
        <ellipse cx="25" cy="17" rx="3.4" ry="2" fill="#fff" opacity="0.55" transform="rotate(-30 25 17)" />
      </symbol>

      {/* 2: horseshoe, open end up */}
      <symbol id="sl-sym-2" viewBox="0 0 64 64">
        <path d="M15 8 V33 A17 17 0 0 0 49 33 V8" fill="none" stroke="#7a849e" strokeWidth="13" strokeLinecap="butt" />
        <path d="M15 8 V33 A17 17 0 0 0 49 33 V8" fill="none" stroke="url(#sl-g-silver)" strokeWidth="10.5" strokeLinecap="butt" />
        {[
          [15, 15], [15, 26], [19, 39], [32, 49.6], [45, 39], [49, 26], [49, 15],
        ].map(([x, y]) => (
          <g key={`${x}-${y}`}>
            <circle cx={x} cy={y} r="2.4" fill="#3b4156" />
            <circle cx={x - 0.6} cy={y - 0.6} r="0.9" fill="#fff" opacity="0.6" />
          </g>
        ))}
        <path d="M11.5 10 V31" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity="0.8" />
      </symbol>

      {/* 3: pot of gold */}
      <symbol id="sl-sym-3" viewBox="0 0 64 64">
        <path d="M12 56 L16 60 M52 56 L48 60" stroke="#101226" strokeWidth="4" strokeLinecap="round" />
        {POT_COINS.map(([x, y], i) => (
          <g key={i}>
            <ellipse cx={x} cy={y + 1.2} rx="7.2" ry="4.3" fill="#a8680a" />
            <ellipse cx={x} cy={y} rx="7.2" ry="4.3" fill="url(#sl-g-gold)" stroke="#8a560a" strokeWidth="0.9" />
          </g>
        ))}
        <path d="M9 31 C6 52 18 59 32 59 C46 59 58 52 55 31 Z" fill="url(#sl-g-iron)" stroke="#05060f" strokeWidth="1.6" strokeLinejoin="round" />
        <ellipse cx="32" cy="31" rx="23.5" ry="5.6" fill="#1c1f38" stroke="#05060f" strokeWidth="1.6" />
        <path d="M11 33 C9 44 12 50 16 53" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" opacity="0.28" fill="none" />
        <circle cx="48" cy="27" r="1.6" fill="#fff6c4" />
        <circle cx="17" cy="16" r="1.3" fill="#fff6c4" />
      </symbol>

      {/* 4: green hat with a gold buckle */}
      <symbol id="sl-sym-4" viewBox="0 0 64 64">
        <path d="M18 7 H46 L49 46 H15 Z" fill="url(#sl-g-hat)" stroke="#07461c" strokeWidth="2" strokeLinejoin="round" />
        <path d="M21 10 L23 40" stroke="#c9ffd9" strokeWidth="2.6" strokeLinecap="round" opacity="0.5" />
        <path d="M15.4 37 H48.6 L49 46 H15 Z" fill="#14172b" />
        <rect x="26" y="34.5" width="12" height="14" rx="2.5" fill="url(#sl-g-gold)" stroke="#8a560a" strokeWidth="1.6" />
        <rect x="29.5" y="38.3" width="5" height="6.4" rx="1" fill="#14172b" />
        <ellipse cx="32" cy="51" rx="28" ry="7" fill="url(#sl-g-hat)" stroke="#07461c" strokeWidth="2" />
        <path d="M10 49 C20 53 44 53 54 49" stroke="#c9ffd9" strokeWidth="1.6" fill="none" opacity="0.4" strokeLinecap="round" />
      </symbol>

      {/* 5: leprechaun face (wild) */}
      <symbol id="sl-sym-5" viewBox="0 0 64 64">
        <path d="M32 3 L58 17 V47 L32 61 L6 47 V17 Z" fill="#134f2c" stroke="url(#sl-g-gold)" strokeWidth="3" strokeLinejoin="round" />
        <path d="M20 5 H44 L46 18 H18 Z" fill="url(#sl-g-hat)" stroke="#07461c" strokeWidth="1.4" strokeLinejoin="round" />
        <rect x="18.6" y="13.6" width="26.8" height="3.6" fill="#14172b" />
        <rect x="29.2" y="12.6" width="5.6" height="5.6" rx="1" fill="url(#sl-g-gold)" stroke="#8a560a" strokeWidth="0.8" />
        <ellipse cx="32" cy="19" rx="17" ry="3.2" fill="url(#sl-g-hat)" stroke="#07461c" strokeWidth="1.2" />
        <path d="M17 29 C15 41 22 48 32 48 C42 48 49 41 47 29 C43 34 38 35.5 32 35.5 C26 35.5 21 34 17 29 Z" fill="url(#sl-g-beard)" stroke="#a84a05" strokeWidth="1" />
        <ellipse cx="32" cy="28.5" rx="12" ry="8.2" fill="#ffd2a8" stroke="#c98a5c" strokeWidth="0.9" />
        <circle cx="27.2" cy="27" r="1.9" fill="#1b1230" />
        <circle cx="36.8" cy="27" r="1.9" fill="#1b1230" />
        <circle cx="27.7" cy="26.4" r="0.6" fill="#fff" />
        <circle cx="37.3" cy="26.4" r="0.6" fill="#fff" />
        <circle cx="32" cy="30.6" r="2" fill="#ff8f86" />
        <path d="M24.5 23.8 L29.6 24.6 M39.5 23.8 L34.4 24.6" stroke="#d9620e" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M25.5 37.6 C29 40.8 35 40.8 38.5 37.6" stroke="#8a2e00" strokeWidth="1.8" strokeLinecap="round" fill="none" />
        <rect x="9" y="47" width="46" height="10" rx="3" fill="#0a2e19" stroke="url(#sl-g-gold)" strokeWidth="1.6" />
        <text x="32" y="55" textAnchor="middle" fontSize="8.4" fontWeight="900" fill="#ffe27a" letterSpacing="1.2" fontFamily="system-ui, 'Segoe UI', sans-serif">
          WILD
        </text>
      </symbol>

      {/* 6: rainbow (jackpot) */}
      <symbol id="sl-sym-6" viewBox="0 0 64 64">
        {[
          ['#ff4b5c', 26],
          ['#ff9f1c', 22],
          ['#ffe14a', 18],
          ['#3ddc84', 14],
          ['#3aa0ff', 10],
        ].map(([color, r]) => (
          <path key={String(color)} d={`M${32 - Number(r)} 44 A${r} ${r} 0 0 1 ${32 + Number(r)} 44`} fill="none" stroke={String(color)} strokeWidth="4.4" />
        ))}
        <path d="M8 38 A24 24 0 0 1 22 22" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" opacity="0.5" />
        <g fill="#ffffff" stroke="#bcd4f0" strokeWidth="1">
          <ellipse cx="11" cy="48" rx="9" ry="6" />
          <ellipse cx="19" cy="50" rx="8" ry="5.5" />
          <ellipse cx="53" cy="48" rx="9" ry="6" />
          <ellipse cx="45" cy="50" rx="8" ry="5.5" />
        </g>
        <g fill="url(#sl-g-gold)" stroke="#8a560a" strokeWidth="0.9">
          <ellipse cx="29" cy="55" rx="4.6" ry="2.8" />
          <ellipse cx="36.5" cy="55.4" rx="4.6" ry="2.8" />
          <ellipse cx="32.6" cy="52" rx="4.6" ry="2.8" />
        </g>
      </symbol>

      {/* 7: gold coin (scatter) */}
      <symbol id="sl-sym-7" viewBox="0 0 64 64">
        <circle cx="32" cy="34" r="27" fill="#a8680a" />
        <circle cx="32" cy="32" r="27" fill="url(#sl-g-gold)" stroke="#8a560a" strokeWidth="2" />
        <circle cx="32" cy="32" r="21.5" fill="none" stroke="#b7740c" strokeWidth="2" />
        <circle cx="32" cy="32" r="19.6" fill="none" stroke="#fff6c4" strokeWidth="1" opacity="0.8" />
        <polygon points={STAR} fill="#b7740c" stroke="#8a560a" strokeWidth="1.2" strokeLinejoin="round" transform="translate(0 -1)" />
        <polygon points={STAR} fill="#ffe27a" opacity="0.75" transform="translate(-0.8 -1.8)" />
        <path d="M12 22 C15 14 22 9 30 8" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity="0.6" fill="none" />
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
