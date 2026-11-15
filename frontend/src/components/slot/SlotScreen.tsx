import { useEffect, useRef, useState } from 'react'
import {
  EXACT_RTP,
  FREE_MULT,
  FREE_SPINS,
  GLYPHS,
  JACKPOT,
  PAY,
  SCATTERS,
  SYM,
  SYMBOL_NAMES,
  WILD_PAY,
  nearMissGrid,
  randomSeed,
  resolveSlot,
  type Spin,
} from '../../lib/slot'
import { prefersReducedMotion } from '../../lib/themes'
import './slot.css'

// Slot demo, sim only. Results come from lib/slot.ts (same math as the sandbox, exact return 0.97993).
//
// Two presentations of the SAME spins, switchable at the top:
//   Honest          what landed, nothing else.
//   Near-miss demo  CLAUDE.md's one exception (team decision 2026-11-15): teases the jackpot and
//                   free spins on losing spins, more often as the demo balance drops, and a coin pile
//                   that grows with losses and cascades as if the jackpot were getting closer.
//                   It never changes what a spin pays.
// Owner: Zander.

type Mode = 'honest' | 'nearmiss'
type Tone = 'win' | 'big' | 'jackpot' | 'free' | 'tease'

const START = 1000
const STAKES = [1, 5, 10, 25, 50]
const PILE_MAX = 96 // the pile never reads "full": nothing is actually getting closer

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 0 })
const randomGrid = () => [0, 1, 2].map(() => [0, 1, 2].map(() => Math.floor(Math.random() * GLYPHS.length)))
const gridOf = (s: Spin, k: number) => [s.above[k], s.lines[k].symbols, s.below]

interface Props {
  /** Session limit reason from useSession; spins are blocked while it's set. */
  blockedReason: string | null
  onStake: (chips: number) => void
  onPaid: (chips: number) => void
}

export function SlotScreen({ blockedReason, onStake, onPaid }: Props) {
  const [mode, setMode] = useState<Mode>('nearmiss')
  const [balance, setBalance] = useState(START)
  const [stake, setStake] = useState(10)
  const [staked, setStaked] = useState(0)
  const [paid, setPaid] = useState(0)
  const [grid, setGrid] = useState(randomGrid)
  const [spinning, setSpinning] = useState(false)
  const [busy, setBusy] = useState(false)
  const [lineLit, setLineLit] = useState(false)
  const [teaseCells, setTeaseCells] = useState<string[]>([])
  const [banner, setBanner] = useState<{ text: string; sub?: string; tone: Tone } | null>(null)
  const [freeLeft, setFreeLeft] = useState<number | null>(null)
  const [pile, setPile] = useState(18)
  const alive = useRef(true)
  /** Payout of the spin on screen, until it's credited. Credited on unmount so the session net stays right. */
  const owed = useRef(0)
  const onPaidRef = useRef(onPaid)
  onPaidRef.current = onPaid
  const reduced = prefersReducedMotion()

  useEffect(() => {
    alive.current = true // StrictMode mounts twice in development
    return () => {
      alive.current = false
      if (owed.current > 0) onPaidRef.current(owed.current)
      owed.current = 0
    }
  }, [])

  // Reel blur while spinning: random symbols, presentation only.
  useEffect(() => {
    if (!spinning) return
    const t = setInterval(() => setGrid(randomGrid()), 70)
    return () => clearInterval(t)
  }, [spinning])

  const wait = async (ms: number) => {
    await sleep(reduced ? Math.min(ms, 150) : ms)
    return alive.current
  }
  const addPile = (n: number) => setPile((p) => Math.max(0, Math.min(PILE_MAX, p + n)))

  /** Plays one spin's lines: highlight each win, then cascade. Returns chips won. */
  async function playLines(s: Spin, label: string, bet: number): Promise<number> {
    let won = 0
    for (let k = 0; k < s.lines.length; k++) {
      const line = s.lines[k]
      if (line.pay === 0) break
      won += line.pay * bet
      setLineLit(true)
      const what = line.jackpot ? 'Three diamonds' : `Three ${SYMBOL_NAMES[line.symbols.find((x) => x !== SYM.wild) ?? SYM.wild].toLowerCase()}s`
      setBanner({
        text: `+${fmt(line.pay * bet)}`,
        sub: `${what}${line.jackpot ? '' : ` · ${line.mult}× ${k > 0 ? 'cascade' : label}`}`,
        tone: line.jackpot ? 'jackpot' : 'win',
      })
      if (!(await wait(900))) return won
      setLineLit(false)
      if (k + 1 < s.lines.length) {
        setGrid(gridOf(s, k + 1))
        if (mode === 'nearmiss') addPile(8)
        if (!(await wait(450))) return won
      }
    }
    return won
  }

  async function spin() {
    if (busy || blockedReason || balance < stake) return
    const bet = stake
    const ratioAfter = (balance - bet) / START
    setBusy(true)
    setBalance((b) => b - bet)
    setStaked((s) => s + bet)
    onStake(bet)
    setBanner(null)
    setTeaseCells([])
    setFreeLeft(null)

    const r = resolveSlot(randomSeed())
    owed.current = r.total * bet

    setSpinning(true)
    if (!(await wait(900))) return
    setSpinning(false)

    const tease = mode === 'nearmiss' ? nearMissGrid(r, ratioAfter) : null
    const opening = gridOf(r.base, 0)
    setGrid(tease ? tease.grid : opening)

    if (tease) {
      const cells: string[] = []
      tease.grid.forEach((row, y) =>
        row.forEach((s, x) => {
          if ((tease.kind === 'jackpot' && s === SYM.diamond) || (tease.kind === 'free' && s === SYM.star)) cells.push(`${y}-${x}`)
        }),
      )
      setTeaseCells(cells)
      setBanner(
        tease.kind === 'jackpot'
          ? { text: 'So close!', sub: 'The jackpot diamond stopped one row away', tone: 'tease' }
          : { text: 'Almost!', sub: 'One more star for 8 free spins', tone: 'tease' },
      )
      addPile(6)
    }

    let won = await playLines(r.base, 'line', bet)

    if (r.free.length > 0) {
      setBanner({ text: `${FREE_SPINS} free spins`, sub: `${r.stars} stars · cascades pay double`, tone: 'free' })
      if (!(await wait(1400))) return
      for (let s = 0; s < r.free.length; s++) {
        setFreeLeft(r.free.length - s)
        setSpinning(true)
        if (!(await wait(500))) return
        setSpinning(false)
        setGrid(gridOf(r.free[s], 0))
        won += await playLines(r.free[s], 'free spin', bet)
        if (!(await wait(350))) return
      }
      setFreeLeft(null)
    }

    const payout = r.total * bet // integer: every pay is a whole multiple of the stake
    owed.current = 0
    if (payout !== won) console.warn('slot: shown wins differ from the result', { payout, won })
    setBalance((b) => b + payout)
    setPaid((p) => p + payout)
    onPaid(payout)

    if (payout > 0) {
      const x = r.total
      setBanner({
        text: r.jackpot ? `JACKPOT +${fmt(payout)}` : `${x >= 20 ? 'Big win' : 'Win'} +${fmt(payout)}`,
        sub: `${x}× your ${fmt(bet)} chip spin`,
        tone: r.jackpot ? 'jackpot' : x >= 20 ? 'big' : 'win',
      })
      if (mode === 'nearmiss') setPile((p) => (r.jackpot ? 12 : Math.max(10, p - 4)))
    } else if (mode === 'nearmiss') {
      addPile(ratioAfter < 0.5 ? 9 : 5)
    }
    setBusy(false)
  }

  const net = paid - staked
  const canSpin = !busy && !blockedReason && balance >= stake
  const lowFunds = !busy && balance < STAKES[0]

  return (
    <main className={`slot-page mode-${mode}`}>
      <div className="slot-modebar">
        <div className="seg" role="radiogroup" aria-label="Presentation">
          {(['honest', 'nearmiss'] as Mode[]).map((m) => (
            <button key={m} role="radio" aria-checked={mode === m} className={mode === m ? 'on' : ''} onClick={() => !busy && setMode(m)}>
              {m === 'honest' ? 'Honest' : 'Near-miss demo'}
            </button>
          ))}
        </div>
        <span className="muted small">
          {mode === 'nearmiss'
            ? 'Demo of manipulative slot design. Same spins and payouts as Honest.'
            : 'Shows exactly what landed. Each spin is independent.'}
        </span>
      </div>

      <div className="slot-layout">
        <section className="machine">
          <div className="machine-top">
            <span className="machine-title">Diamond Cascade</span>
            {freeLeft !== null && <span className="badge badge-primary">Free spins left: {freeLeft}</span>}
          </div>

          <div className={`reels ${spinning ? 'is-spinning' : ''}`}>
            {grid.map((row, y) =>
              row.map((s, x) => (
                <div
                  key={`${y}-${x}`}
                  className={`cell sym-${s} ${y === 1 ? 'on-line' : ''} ${y === 1 && lineLit ? 'lit' : ''} ${teaseCells.includes(`${y}-${x}`) ? 'teased' : ''}`}
                >
                  {GLYPHS[s]}
                </div>
              )),
            )}
            <div className="payline" aria-hidden />
          </div>

          <div className="banner-slot" aria-live="polite">
            {banner && (
              <div className={`slot-banner tone-${banner.tone}`}>
                <strong>{banner.text}</strong>
                {banner.sub && <span>{banner.sub}</span>}
              </div>
            )}
          </div>

          <div className="slot-controls">
            <div className="stakes" role="radiogroup" aria-label="Stake per spin">
              {STAKES.map((s) => (
                <button key={s} role="radio" aria-checked={stake === s} className={`stake ${stake === s ? 'on' : ''}`} onClick={() => setStake(s)} disabled={busy}>
                  {s}
                </button>
              ))}
            </div>
            <button className="btn primary spin-btn" onClick={spin} disabled={!canSpin}>
              {busy ? 'Spinning…' : `Spin · ${stake}`}
            </button>
          </div>
          {blockedReason && <p className="limit-banner">{blockedReason} Spins are paused.</p>}

          <div className="slot-stats">
            <div>
              <span className="muted small">Demo chips</span>
              <strong className="mono">{fmt(balance)}</strong>
            </div>
            <div>
              <span className="muted small">Net this session</span>
              <strong className={`mono ${net > 0 ? 'pos' : net < 0 ? 'neg' : ''}`}>{net > 0 ? `+${fmt(net)}` : net < 0 ? `−${fmt(-net)}` : '±0'}</strong>
            </div>
            <div>
              <span className="muted small">Return</span>
              <strong className="mono">{(EXACT_RTP * 100).toFixed(2)}%</strong>
            </div>
          </div>
          {lowFunds && (
            <button className="btn wide" onClick={() => setBalance((b) => b + START)}>
              Refill {fmt(START)} free demo chips
            </button>
          )}
        </section>

        <aside className="slot-side">
          {mode === 'nearmiss' && (
            <section className="card pile-card">
              <header className="card-head">
                <h3>Jackpot pile</h3>
                <span className="card-actions small muted">{pile >= 80 ? 'Almost there' : pile >= 50 ? 'Heating up' : 'Building'}</span>
              </header>
              <div className="card-body">
                <div className="pile" aria-hidden>
                  {Array.from({ length: Math.round(pile / 6) }, (_, i) => (
                    <span key={i} className="coin" style={{ bottom: `${i * 9}px`, left: `${50 + ((i * 37) % 11) - 5}%` }} />
                  ))}
                </div>
                <div className="pile-bar">
                  <span style={{ width: `${pile}%` }} />
                </div>
                <p className="small muted">💎💎💎 pays {fmt(JACKPOT)}×</p>
              </div>
            </section>
          )}

          <section className="card">
            <header className="card-head">
              <h3>Paytable</h3>
              <span className="card-actions small muted">3 on the middle line</span>
            </header>
            <div className="card-body paytable">
              <Row g={[SYM.diamond]} label="Jackpot, flat" pay={JACKPOT} />
              <Row g={[SYM.wild]} label="Three wilds" pay={WILD_PAY} />
              {[SYM.seven, SYM.bar, SYM.bell, SYM.cherry].map((s) => (
                <Row key={s} g={[s]} label={`Three ${SYMBOL_NAMES[s].toLowerCase()}s`} pay={PAY[s]} />
              ))}
              <p className="small muted">
                W stands in for 🍒 🔔 BAR 7. Each win clears the line and the next symbols fall in, paying 2×, 3× and up.{' '}
                {SCATTERS}+ ⭐ anywhere on the reels: {FREE_SPINS} free spins at {FREE_MULT}× cascades.
              </p>
              <p className="small muted">
                About 1 spin in 7 wins. Free spins about 1 in 120, the jackpot about 1 in 28,000. Long-run return{' '}
                {(EXACT_RTP * 100).toFixed(2)}%, a {((1 - EXACT_RTP) * 100).toFixed(2)}% house edge. Demo chips have no value.
              </p>
            </div>
          </section>
        </aside>
      </div>
    </main>
  )
}

function Row({ g, label, pay }: { g: number[]; label: string; pay: number }) {
  return (
    <div className="pay-row">
      <span className={`pay-glyph sym-${g[0]}`}>{GLYPHS[g[0]]}</span>
      <span>{label}</span>
      <strong className="mono">{fmt(pay)}×</strong>
    </div>
  )
}
