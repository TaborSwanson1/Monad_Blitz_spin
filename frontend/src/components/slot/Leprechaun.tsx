// The little leprechaun beside the reels. Drawn by us in SVG (an original character, no
// borrowed art) and animated with CSS: the mood decides which pose and motion he plays.
//
//   idle    sways, blinks, flips a coin in his hand
//   spin    rubs his hands, looks at the reels
//   win     jumps with both arms up, coins fly from his pot
//   big     a bigger jump, his hat lifts off his head, the rainbow lights up
//   tease   wide eyes, hands out, a worried "o" (near-miss demo only)
//   free    arms out, spinning coin
//
// Owner: Zander.

export type Mood = 'idle' | 'spin' | 'win' | 'big' | 'tease' | 'free'

interface Props {
  mood: Mood
  /** What he says, in a bubble above his hat. */
  say: string
}

const RAINBOW: [string, number][] = [
  ['#ff4b5c', 100],
  ['#ff9f1c', 88],
  ['#ffe14a', 76],
  ['#3ddc84', 64],
  ['#3aa0ff', 52],
]

const sparkle = (x: number, y: number, r: number, key: number) => {
  const pts = [0, 1, 2, 3, 4, 5, 6, 7]
    .map((i) => {
      const rr = i % 2 ? r * 0.28 : r
      const a = -Math.PI / 2 + (i * Math.PI) / 4
      return `${(x + rr * Math.cos(a)).toFixed(1)},${(y + rr * Math.sin(a)).toFixed(1)}`
    })
    .join(' ')
  return <polygon key={key} className={`lep-spark lep-spark-${key}`} points={pts} fill="#fff6c4" />
}

export function Leprechaun({ mood, say }: Props) {
  return (
    <div className="sl-lep-wrap">
      <div className="sl-lep-say" key={say} aria-live="polite">
        {say}
      </div>
      <svg className="sl-lep" data-mood={mood} viewBox="0 0 220 320" role="img" aria-label="A friendly leprechaun cheering you on">
        <defs>
          <linearGradient id="lep-coat" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#2fc45f" />
            <stop offset="1" stopColor="#0d5a27" />
          </linearGradient>
          <linearGradient id="lep-beard" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffb457" />
            <stop offset="1" stopColor="#dd620b" />
          </linearGradient>
          <linearGradient id="lep-gold" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff6c4" />
            <stop offset="0.5" stopColor="#f6c443" />
            <stop offset="1" stopColor="#b7740c" />
          </linearGradient>
          <radialGradient id="lep-glow" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#ffe27a" stopOpacity="0.55" />
            <stop offset="1" stopColor="#ffe27a" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* glow and rainbow behind him */}
        <circle className="lep-aura" cx="110" cy="170" r="112" fill="url(#lep-glow)" />
        <g className="lep-rainbow" fill="none" strokeWidth="11">
          {RAINBOW.map(([c, r]) => (
            <path key={c} d={`M${110 - r} 250 A${r} ${r} 0 0 1 ${110 + r} 250`} stroke={c} />
          ))}
          <g fill="#fff" stroke="none" opacity="0.95">
            <ellipse cx="14" cy="252" rx="26" ry="14" />
            <ellipse cx="38" cy="258" rx="22" ry="12" />
            <ellipse cx="206" cy="252" rx="26" ry="14" />
            <ellipse cx="182" cy="258" rx="22" ry="12" />
          </g>
        </g>

        <ellipse cx="110" cy="304" rx="64" ry="7" fill="#000" opacity="0.28" />

        {/* pot of gold, with the coins that fly out of it */}
        <g className="lep-pot">
          <g className="lep-fountain">
            {[0, 1, 2, 3, 4].map((i) => (
              <ellipse key={i} className={`lep-fcoin lep-fcoin-${i}`} cx={170 + (i - 2) * 6} cy="268" rx="7" ry="4.2" fill="url(#lep-gold)" stroke="#8a560a" strokeWidth="0.8" />
            ))}
          </g>
          <ellipse cx="170" cy="272" rx="18" ry="6" fill="url(#lep-gold)" stroke="#8a560a" strokeWidth="1" />
          <ellipse cx="164" cy="268" rx="8" ry="3.4" fill="url(#lep-gold)" stroke="#8a560a" strokeWidth="0.8" />
          <ellipse cx="176" cy="267" rx="8" ry="3.4" fill="url(#lep-gold)" stroke="#8a560a" strokeWidth="0.8" />
          <path d="M150 274 C148 296 158 304 170 304 C182 304 192 296 190 274 Z" fill="#171a30" stroke="#05060f" strokeWidth="1.5" />
          <ellipse cx="170" cy="274" rx="20" ry="5" fill="#23274a" stroke="#05060f" strokeWidth="1.5" />
          <path d="M153 280 C152 290 155 295 158 297" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity="0.25" fill="none" />
        </g>

        <g className="lep-body">
          {/* legs and shoes */}
          <g className="lep-legs">
            <rect x="82" y="232" width="22" height="30" rx="6" fill="#0f6a2d" />
            <rect x="116" y="232" width="22" height="30" rx="6" fill="#0f6a2d" />
            <rect x="84" y="260" width="18" height="24" rx="4" fill="#f4f4fb" />
            <rect x="118" y="260" width="18" height="24" rx="4" fill="#f4f4fb" />
            <path d="M78 296 C78 284 84 281 94 281 H104 V296 Z" fill="#14172b" />
            <path d="M142 296 C142 284 136 281 126 281 H116 V296 Z" fill="#14172b" />
            <rect x="86" y="283" width="10" height="9" rx="2" fill="url(#lep-gold)" stroke="#8a560a" strokeWidth="1" />
            <rect x="124" y="283" width="10" height="9" rx="2" fill="url(#lep-gold)" stroke="#8a560a" strokeWidth="1" />
          </g>

          {/* coat */}
          <path d="M76 174 C70 200 64 226 67 242 H153 C156 226 150 200 144 174 Z" fill="url(#lep-coat)" stroke="#07461c" strokeWidth="2" strokeLinejoin="round" />
          <path d="M95 174 L110 212 L125 174 Z" fill="#f4f4fb" stroke="#c9c9d9" strokeWidth="1" />
          <circle cx="110" cy="222" r="3.4" fill="url(#lep-gold)" stroke="#8a560a" strokeWidth="0.8" />
          <rect x="66" y="230" width="88" height="12" fill="#14172b" />
          <rect x="98" y="227" width="24" height="18" rx="3" fill="url(#lep-gold)" stroke="#8a560a" strokeWidth="1.4" />
          <rect x="104" y="232" width="12" height="8" rx="1.5" fill="#14172b" />

          {/* left arm */}
          <g className="lep-arm lep-arm-l">
            <rect x="68" y="178" width="19" height="54" rx="9.5" fill="url(#lep-coat)" stroke="#07461c" strokeWidth="2" />
            <rect x="66.5" y="222" width="22" height="9" rx="3" fill="#f4f4fb" stroke="#c9c9d9" strokeWidth="1" />
            <circle cx="77.5" cy="240" r="9" fill="#ffd2a8" stroke="#c98a5c" strokeWidth="1.2" />
          </g>

          {/* right arm, with the coin he flips */}
          <g className="lep-arm lep-arm-r">
            <rect x="133" y="178" width="19" height="54" rx="9.5" fill="url(#lep-coat)" stroke="#07461c" strokeWidth="2" />
            <rect x="131.5" y="222" width="22" height="9" rx="3" fill="#f4f4fb" stroke="#c9c9d9" strokeWidth="1" />
            <circle cx="142.5" cy="240" r="9" fill="#ffd2a8" stroke="#c98a5c" strokeWidth="1.2" />
            <g className="lep-coin">
              <ellipse cx="142.5" cy="228" rx="9" ry="9" fill="url(#lep-gold)" stroke="#8a560a" strokeWidth="1.2" />
              <ellipse cx="142.5" cy="228" rx="5.6" ry="5.6" fill="none" stroke="#b7740c" strokeWidth="1.2" />
            </g>
          </g>

          {/* head */}
          <g className="lep-head">
            <path d="M82 124 L64 114 L79 140 Z" fill="#ffd2a8" stroke="#c98a5c" strokeWidth="1.2" strokeLinejoin="round" />
            <path d="M138 124 L156 114 L141 140 Z" fill="#ffd2a8" stroke="#c98a5c" strokeWidth="1.2" strokeLinejoin="round" />
            <ellipse cx="110" cy="130" rx="32" ry="28" fill="#ffd2a8" stroke="#c98a5c" strokeWidth="1.4" />
            <ellipse cx="80" cy="108" rx="10" ry="9" fill="url(#lep-beard)" />
            <ellipse cx="140" cy="108" rx="10" ry="9" fill="url(#lep-beard)" />
            <circle cx="86" cy="140" r="6" fill="#ff8f86" opacity="0.5" />
            <circle cx="134" cy="140" r="6" fill="#ff8f86" opacity="0.5" />
            {/* beard and moustache */}
            <path d="M80 134 C68 176 92 204 110 208 C128 204 152 176 140 134 C134 150 124 156 110 156 C96 156 86 150 80 134 Z" fill="url(#lep-beard)" stroke="#a84a05" strokeWidth="1.4" strokeLinejoin="round" />
            <path d="M92 182 C98 192 104 196 110 198 M128 182 C122 192 116 196 110 198" stroke="#ffd08a" strokeWidth="2" strokeLinecap="round" opacity="0.6" fill="none" />
            <ellipse cx="99" cy="149" rx="13" ry="6.2" transform="rotate(14 99 149)" fill="url(#lep-beard)" stroke="#a84a05" strokeWidth="1" />
            <ellipse cx="121" cy="149" rx="13" ry="6.2" transform="rotate(-14 121 149)" fill="url(#lep-beard)" stroke="#a84a05" strokeWidth="1" />
            <circle cx="110" cy="141" r="6.4" fill="#ff9a8a" stroke="#d9695a" strokeWidth="1" />
            <circle cx="108" cy="139" r="1.8" fill="#fff" opacity="0.7" />
            {/* mouth: smile, open grin, or a worried o */}
            <path className="lep-mouth lep-mouth-smile" d="M99 161 Q110 170 121 161" stroke="#7a1f00" strokeWidth="2.6" strokeLinecap="round" fill="none" />
            <g className="lep-mouth lep-mouth-open">
              <path d="M97 159 Q110 182 123 159 Q110 164 97 159 Z" fill="#7a1018" stroke="#5a0a10" strokeWidth="1.4" strokeLinejoin="round" />
              <path d="M103 170 Q110 176 117 170 Q110 168 103 170 Z" fill="#ff7a7a" />
            </g>
            <ellipse className="lep-mouth lep-mouth-o" cx="110" cy="165" rx="5" ry="6.4" fill="#7a1018" stroke="#5a0a10" strokeWidth="1.2" />
            {/* eyes */}
            <g className="lep-eyes">
              <circle cx="96" cy="124" r="8" fill="#fff" stroke="#c98a5c" strokeWidth="1" />
              <circle cx="124" cy="124" r="8" fill="#fff" stroke="#c98a5c" strokeWidth="1" />
              <g className="lep-pupils">
                <circle cx="97" cy="125" r="3.8" fill="#1b1230" />
                <circle cx="125" cy="125" r="3.8" fill="#1b1230" />
                <circle cx="98.2" cy="123.6" r="1.2" fill="#fff" />
                <circle cx="126.2" cy="123.6" r="1.2" fill="#fff" />
              </g>
            </g>
            <g className="lep-brows" stroke="#d9620e" strokeWidth="3.4" strokeLinecap="round" fill="none">
              <path d="M87 112 Q96 107 105 111" />
              <path d="M115 111 Q124 107 133 112" />
            </g>
            {/* hat */}
            <g className="lep-hat">
              <path d="M72 98 L78 46 H142 L148 98 Z" fill="url(#lep-coat)" stroke="#07461c" strokeWidth="2" strokeLinejoin="round" />
              <ellipse cx="110" cy="46" rx="32" ry="7" fill="#1f9c47" stroke="#07461c" strokeWidth="1.6" />
              <path d="M84 56 L86 86" stroke="#c9ffd9" strokeWidth="4" strokeLinecap="round" opacity="0.4" />
              <path d="M73.5 84 H146.5 L148 98 H72 Z" fill="#14172b" />
              <rect x="96" y="79" width="28" height="22" rx="3.4" fill="url(#lep-gold)" stroke="#8a560a" strokeWidth="1.6" />
              <rect x="103" y="85" width="14" height="10" rx="1.6" fill="#14172b" />
              <ellipse cx="110" cy="99" rx="56" ry="11" fill="url(#lep-coat)" stroke="#07461c" strokeWidth="2" />
              <path d="M62 97 C80 106 140 106 158 97" stroke="#c9ffd9" strokeWidth="2" fill="none" opacity="0.35" strokeLinecap="round" />
            </g>
          </g>
        </g>

        <g className="lep-sparks" aria-hidden>
          {sparkle(40, 90, 11, 0)}
          {sparkle(182, 70, 13, 1)}
          {sparkle(26, 170, 9, 2)}
          {sparkle(198, 168, 10, 3)}
          {sparkle(110, 20, 9, 4)}
        </g>
      </svg>
    </div>
  )
}
