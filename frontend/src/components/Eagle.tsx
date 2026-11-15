import { prefersReducedMotion } from '../lib/themes'
import { Fireworks } from './Fireworks'

// Americana BIG win effect (stake >= BIG_STAKE and the round is a net win): a bald eagle soars overhead, seen
// from below with wings spread, over fireworks. Drawn by us: broad wings with slotted
// primary feathers, lighter coverts, white head and fanned tail. It glides with a slow
// bank and wing flex rather than flapping, and grows as it passes, like it's flying
// toward you. It flies behind the result card so the result stays readable.

const WING =
  'M186 70 C160 58 130 48 98 47 C78 46 58 49 42 52 L16 49 L36 58 L10 60 L34 66 L8 72 L34 74 L12 84 L38 82 L22 95 L46 88 L40 104 L62 93 C88 104 120 108 150 104 C166 102 178 98 188 94 Z'
const COVERTS = 'M184 72 C158 62 128 54 100 54 C80 54 62 56 48 58 C70 64 110 68 150 76 C166 80 178 82 186 84 Z'
const FEATHER_LINES = 'M70 96 L84 74 M88 100 L100 76 M106 103 L116 78 M124 104 L132 80 M142 103 L148 82 M160 100 L164 84'

function Wing() {
  return (
    <>
      <path className="eagle-wing" d={WING} />
      <path className="eagle-coverts" d={COVERTS} />
      <path className="eagle-feathers" d={FEATHER_LINES} />
    </>
  )
}

export function Eagle() {
  if (prefersReducedMotion()) return null
  return (
    <>
      <Fireworks intensity={1} duration={3600} />
      <div className="eagle-flight" aria-hidden>
        <svg className="eagle" viewBox="0 0 400 170">
          <defs>
            <linearGradient id="wing-shade" x1="1" y1="0" x2="0" y2="0">
              <stop offset="0" stopColor="#4d3019" />
              <stop offset="0.7" stopColor="#33200f" />
              <stop offset="1" stopColor="#1f1309" />
            </linearGradient>
            <radialGradient id="head-shade" cx="50%" cy="35%" r="70%">
              <stop offset="0" stopColor="#ffffff" />
              <stop offset="1" stopColor="#d9d4c8" />
            </radialGradient>
          </defs>
          <g className="wing wing-l">
            <Wing />
          </g>
          <g className="wing wing-r">
            <g transform="translate(400 0) scale(-1 1)">
              <Wing />
            </g>
          </g>
          <path className="eagle-tail" d="M190 114 L176 156 Q200 168 224 156 L210 114 Z" />
          <path className="eagle-tail-lines" d="M200 120 L200 162 M193 120 L186 159 M207 120 L214 159" />
          <path
            className="eagle-body"
            d="M200 50 C214 54 219 80 215 104 C213 113 207 119 200 121 C193 119 187 113 185 104 C181 80 186 54 200 50 Z"
          />
          <ellipse className="eagle-foot" cx="193" cy="117" rx="4" ry="6" />
          <ellipse className="eagle-foot" cx="207" cy="117" rx="4" ry="6" />
          <ellipse cx="200" cy="40" rx="13" ry="17" fill="url(#head-shade)" />
          <path className="eagle-beak" d="M194 27 C195 16 205 16 206 27 C204 30 196 30 194 27 Z" />
        </svg>
      </div>
    </>
  )
}
