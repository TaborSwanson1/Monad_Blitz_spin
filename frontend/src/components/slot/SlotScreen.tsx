import { useEffect, useRef, useState, type CSSProperties } from 'react'
import {
  EXACT_RTP,
  FREE_MULT,
  FREE_SPINS,
  JACKPOT,
  PAY,
  SCATTERS,
  SYM,
  WILD_PAY,
  nearMissGrid,
  randomSeed,
  resolveSlot,
  type Spin,
} from '../../lib/slot'
import { prefersReducedMotion } from '../../lib/themes'
import { Sym, SymbolDefs } from './SlotSymbols'
import './slot.css'

// Slot demo "Diamond Cascade", sim only. Results come from lib/slot.ts (same math as the
// sandbox, exact return 0.97993). This file only decides how a result is SHOWN.
//
// Layout follows common slot conventions: logo and prize ladder beside framed reels,
// feature badges above them, and a control bar with a round spin button. All art is ours
// (SlotSymbols.tsx and CSS).
//
// Two presentations of the SAME spins, switchable at the top:
//   Honest          what landed, nothing else.
//   Near-miss demo  CLAUDE.md's one exception (team decision 2026-11-15): on losing spins it
//                   teases the jackpot and free spins, more often as the demo balance drops;
//                   it holds the last reel when two diamonds are on the line; and a coin pile
//                   grows with losses and cascades as if the jackpot were getting closer.
//                   It never changes what a spin pays.
//
// Left out on purpose (CLAUDE.md): autoplay, turbo spins, bonus buys and made-up jackpot tickers.
// Owner: Zander.

type Mode = 'honest' | 'nearmiss'
type Tone = 'idle' | 'win' | 'tease' | 'free'
type Fx = 'lit' | 'pop' | 'drop' | null

/** One reel. cells[0] is a hidden buffer above the window (for the stop bounce); cells[1..3] are the visible rows. */
interface Reel {
  key: number
  cells: number[]
  /** Spin time in ms. 0 = at rest. */
  dur: number
}

interface Overlay {
  tone: 'big' | 'jackpot' | 'free'
  title: string
  amount?: string
  sub?: string
}

const START = 1000
const STAKES = [1, 5, 10, 25, 50]
const PILE_MAX = 96 // the pile never reads "full": nothing is actually getting closer
const COIN_SLOTS = 34
const VIS = 1
const STOP_MS = [900, 1250, 1600]
const HOLD_MS = 3600
const IDLE_MSG = 'Three in a row on the middle line wins'
const PLURAL = ['blanks', 'cherries', 'bells', 'bars', 'sevens', 'wilds', 'diamonds', 'stars']
const LADDER = [
  { sym: SYM.diamond, name: 'Jackpot', pay: JACKPOT, jackpot: true },
  { sym: SYM.wild, name: 'Wilds', pay: WILD_PAY, jackpot: false },
  { sym: SYM.seven, name: 'Sevens', pay: PAY[SYM.seven], jackpot: false },
  { sym: SYM.bar, name: 'Bars', pay: PAY[SYM.bar], jackpot: false },
  { sym: SYM.bell, name: 'Bells', pay: PAY[SYM.bell], jackpot: false },
  { sym: SYM.cherry, name: 'Cherries', pay: PAY[SYM.cherry], jackpot: false },
]
// What the reels show before the first spin. No three in a row.
const ATTRACT = [
  [SYM.bell, SYM.wild, SYM.cherry],
  [SYM.seven, SYM.diamond, SYM.bar],
  [SYM.cherry, SYM.star, SYM.bell],
]

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 0 })
const rnd = () => Math.floor(Math.random() * PLURAL.length)
const gridOf = (s: Spin, k: number) => [s.above[k], s.lines[k].symbols, s.below]
const restReels = (): Reel[] => [0, 1, 2].map((x) => ({ key: x, dur: 0, cells: [rnd(), ATTRACT[0][x], ATTRACT[1][x], ATTRACT[2][x]] }))

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
  const [reels, setReels] = useState<Reel[]>(restReels)
  const [fx, setFx] = useState<Fx>(null)
  const [teased, setTeased] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [holding, setHolding] = useState(false)
  const [msg, setMsg] = useState<{ text: string; tone: Tone }>({ text: IDLE_MSG, tone: 'idle' })
  const [win, setWin] = useState(0)
  const [step, setStep] = useState<{ k: number; mult: number } | null>(null)
  const [free, setFree] = useState<{ n: number; of: number } | null>(null)
  const [overlay, setOverlay] = useState<Overlay | null>(null)
  const [pile, setPile] = useState(18)
  const [infoOpen, setInfoOpen] = useState(false)

  const reelsRef = useRef(reels)
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

  const wait = async (ms: number) => {
    await sleep(reduced ? Math.min(ms, 150) : ms)
    return alive.current
  }
  const apply = (next: Reel[]) => {
    reelsRef.current = next
    setReels(next)
  }
  const addPile = (n: number) => setPile((p) => Math.max(0, Math.min(PILE_MAX, p + n)))

  /** Spins every reel from what it shows now to `grid`. Reels stop left to right. */
  async function reveal(grid: number[][], hold: boolean): Promise<boolean> {
    const durs = [STOP_MS[0], STOP_MS[1], hold ? HOLD_MS : STOP_MS[2]]
    apply(
      reelsRef.current.map((r, x) => ({
        key: r.key + 3,
        dur: durs[x],
        cells: [
          rnd(),
          grid[0][x],
          grid[1][x],
          grid[2][x],
          ...Array.from({ length: Math.round(durs[x] / 65) }, rnd),
          ...r.cells.slice(VIS, VIS + 3),
        ],
      })),
    )
    if (hold) {
      // Near-miss demo: two diamonds are on the line, so the last reel keeps turning.
      if (!(await wait(STOP_MS[1] + 60))) return false
      setHolding(true)
      setTeased(['1-0', '1-1'])
      setMsg({ text: 'Two diamonds… jackpot chance!', tone: 'tease' })
      if (!(await wait(HOLD_MS - STOP_MS[1]))) return false
      setHolding(false)
      setTeased([])
    } else if (!(await wait(STOP_MS[2] + 60))) return false
    apply(reelsRef.current.map((r) => ({ ...r, dur: 0, cells: r.cells.slice(0, VIS + 3) })))
    return true
  }

  /** Plays one spin's lines: light up each win, clear it, drop the next symbols in. Returns the running total won. */
  async function playLines(s: Spin, bet: number, wonBefore: number, pileUp: boolean): Promise<number> {
    let won = wonBefore
    for (let k = 0; k < s.lines.length; k++) {
      const line = s.lines[k]
      if (line.pay === 0) break
      won += line.pay * bet
      const sym = line.symbols.find((x) => x !== SYM.wild) ?? SYM.wild
      setStep({ k, mult: line.mult })
      setFx('lit')
      setWin(won)
      setMsg({
        text: line.jackpot
          ? `Jackpot! Three diamonds pay ${fmt(line.pay * bet)}`
          : `Three ${PLURAL[sym]}${line.mult > 1 ? ` × ${line.mult}` : ''} pay ${fmt(line.pay * bet)}`,
        tone: 'win',
      })
      if (!(await wait(line.jackpot ? 1500 : 950))) return won
      if (k + 1 >= s.lines.length) break
      setFx('pop')
      if (!(await wait(300))) return won
      apply(
        reelsRef.current.map((r, x) => ({
          ...r,
          dur: 0,
          cells: [rnd(), s.above[k + 1][x], s.lines[k + 1].symbols[x], s.below[x]],
        })),
      )
      setFx('drop')
      if (pileUp) addPile(8)
      if (!(await wait(460))) return won
    }
    setFx(null)
    setStep(null)
    return won
  }

  async function spin() {
    if (busy || blockedReason || balance < stake) return
    const bet = stake
    const demo = mode === 'nearmiss'
    const ratioAfter = (balance - bet) / START
    setBusy(true)
    setInfoOpen(false)
    setOverlay(null)
    setTeased([])
    setStep(null)
    setFree(null)
    setFx(null)
    setWin(0)
    setBalance((b) => b - bet)
    setStaked((s) => s + bet)
    onStake(bet)
    setMsg({ text: 'Good luck!', tone: 'idle' })

    const r = resolveSlot(randomSeed())
    owed.current = r.total * bet
    const tease = demo ? nearMissGrid(r, ratioAfter) : null
    const opening = tease ? tease.grid : gridOf(r.base, 0)
    const holdFor = (g: number[][]) => demo && !reduced && g[1][0] === SYM.diamond && g[1][1] === SYM.diamond

    if (!(await reveal(opening, holdFor(opening)))) return
    if (tease) {
      const want = tease.kind === 'jackpot' ? SYM.diamond : SYM.star
      setTeased(tease.grid.flatMap((row, y) => row.flatMap((s, x) => (s === want ? [`${y}-${x}`] : []))))
      setMsg({
        text: tease.kind === 'jackpot' ? 'So close! The third diamond stopped one row away' : `Almost! One more star for ${FREE_SPINS} free spins`,
        tone: 'tease',
      })
      addPile(6)
    }

    let won = await playLines(r.base, bet, 0, demo)
    if (!alive.current) return

    if (r.free.length > 0) {
      setTeased([])
      setOverlay({ tone: 'free', title: `${FREE_SPINS} free spins`, sub: `${r.stars} stars landed. Cascades pay double.` })
      setMsg({ text: `${FREE_SPINS} free spins won`, tone: 'free' })
      if (!(await wait(1700))) return
      setOverlay(null)
      for (let i = 0; i < r.free.length; i++) {
        setFree({ n: i + 1, of: r.free.length })
        setMsg({ text: `Free spin ${i + 1} of ${r.free.length}`, tone: 'free' })
        const g = gridOf(r.free[i], 0)
        if (!(await reveal(g, holdFor(g)))) return
        won = await playLines(r.free[i], bet, won, demo)
        if (!(await wait(350))) return
      }
      setFree(null)
    }

    const payout = r.total * bet // integer: every pay is a whole multiple of the stake
    if (payout !== won) console.warn('slot: shown wins differ from the result', { payout, won })
    owed.current = 0
    setBalance((b) => b + payout)
    setPaid((p) => p + payout)
    onPaid(payout)
    setWin(payout)

    if (payout > 0) {
      setMsg({ text: `You won ${fmt(payout)} · ${fmt(r.total)}× your bet`, tone: 'win' })
      if (demo) setPile((p) => (r.jackpot ? 12 : Math.max(10, p - 4)))
      // Fanfare follows the real result: only for the jackpot or 20× and up.
      if (r.jackpot || r.total >= 20) {
        setOverlay({
          tone: r.jackpot ? 'jackpot' : 'big',
          title: r.jackpot ? 'Jackpot' : 'Big win',
          amount: `+${fmt(payout)}`,
          sub: `${fmt(r.total)}× your ${fmt(bet)} chip bet`,
        })
        if (!(await wait(2400))) return
        setOverlay(null)
      }
    } else {
      if (!tease) setMsg({ text: 'No win this spin', tone: 'idle' })
      if (demo) addPile(ratioAfter < 0.5 ? 9 : 5)
    }
    setBusy(false)
  }

  const net = paid - staked
  const canSpin = !busy && !blockedReason && balance >= stake
  const stakeIdx = STAKES.indexOf(stake)
  const coins = Math.round((pile / 100) * COIN_SLOTS)

  const cellClass = (i: number, x: number) => {
    const row = i - VIS // 0 top, 1 the payline, 2 bottom
    let c = 'sl-cell'
    if (row === 1 && fx === 'lit') c += ' lit'
    if (row === 1 && fx === 'pop') c += ' pop'
    if ((row === 0 || row === 1) && fx === 'drop') c += ' drop'
    if (teased.includes(`${row}-${x}`)) c += ' teased'
    return c
  }

  return (
    <main className={`slot-page sl-mode-${mode} ${free ? 'sl-free' : ''} ${holding ? 'sl-hold' : ''}`}>
      <SymbolDefs />

      <div className="sl-modebar">
        <div className="sl-seg" role="radiogroup" aria-label="Presentation">
          {(['honest', 'nearmiss'] as Mode[]).map((m) => (
            <button key={m} role="radio" aria-checked={mode === m} className={mode === m ? 'on' : ''} onClick={() => setMode(m)} disabled={busy}>
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

      <section className="sl-scene">
        <div className="sl-backdrop" aria-hidden />

        <h1 className="sl-logo">
          <span>Diamond</span>
          Cascade
        </h1>

        <div className="sl-prizes">
          <ul className="sl-ladder" aria-label={`Payouts for a ${stake} chip bet`}>
            {LADDER.map((row) => (
              <li key={row.sym} className={row.jackpot ? 'is-jackpot' : ''}>
                <span className="sl-ladder-syms" aria-hidden>
                  <Sym id={row.sym} />
                  <Sym id={row.sym} />
                  <Sym id={row.sym} />
                </span>
                <span className="sl-ladder-name">{row.name}</span>
                <strong>{fmt(row.pay * stake)}</strong>
              </li>
            ))}
          </ul>
          <p className="sl-note">
            Three in a row on the middle line, shown for a {stake} chip bet. WILD stands in for cherries, bells, bars and sevens.
          </p>
        </div>

        <div className="sl-center">
          <div className="sl-badges">
            <div className={`sl-badge ${step && step.mult > 1 ? 'on' : ''}`}>
              <span>Cascade</span>
              <strong>{step ? `${step.mult}×` : `${free ? FREE_MULT : 1}×`}</strong>
            </div>
            <div className={`sl-badge is-free ${free ? 'on' : ''}`}>
              <span>Free spins</span>
              <strong>{free ? `${free.n} / ${free.of}` : FREE_SPINS}</strong>
            </div>
            <div className={`sl-badge is-jackpot ${holding ? 'on' : ''}`}>
              <span>Jackpot</span>
              <strong>{fmt(JACKPOT * stake)}</strong>
            </div>
          </div>

          <div className="sl-strap">
            {free ? (
              <>Free spins: every cascade pays double</>
            ) : (
              <>
                {SCATTERS}+ <Sym id={SYM.star} className="sl-inline" /> anywhere award {FREE_SPINS} free spins
              </>
            )}
          </div>

          <div className="sl-frame">
            <div className={`sl-window ${fx === 'lit' ? 'has-win' : ''}`}>
              {reels.map((reel, x) => (
                <div className="sl-reel" key={x}>
                  <div
                    key={reel.key}
                    className={`sl-strip ${reel.dur ? 'is-spin' : ''}`}
                    style={{ '--rows': reel.cells.length - 4, '--dur': `${reel.dur}ms` } as CSSProperties}
                  >
                    {reel.cells.map((s, i) => (
                      <div key={i} className={cellClass(i, x)}>
                        <Sym id={s} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <div className="sl-shade" aria-hidden />
              <div className="sl-payline" aria-hidden />

              {overlay && (
                <div className={`sl-overlay tone-${overlay.tone}`} role="status">
                  <span className="sl-overlay-title">{overlay.title}</span>
                  {overlay.amount && <strong>{overlay.amount}</strong>}
                  {overlay.sub && <span className="sl-overlay-sub">{overlay.sub}</span>}
                </div>
              )}

              {infoOpen && (
                <div className="sl-info-panel" role="dialog" aria-label="Paytable and rules">
                  <div className="sl-info-head">
                    <strong>Paytable and rules</strong>
                    <button className="sl-round sl-small" onClick={() => setInfoOpen(false)} aria-label="Close paytable">
                      ×
                    </button>
                  </div>
                  <div className="sl-info-pays">
                    {LADDER.map((row) => (
                      <span key={row.sym}>
                        <Sym id={row.sym} />
                        <Sym id={row.sym} />
                        <Sym id={row.sym} />
                        <b>{fmt(row.pay)}×</b>
                      </span>
                    ))}
                  </div>
                  <ul>
                    <li>One payline: the middle row. Pays are multiples of your bet.</li>
                    <li>WILD stands in for cherries, bells, bars and sevens. Three wilds pay {WILD_PAY}×.</li>
                    <li>Cascades: a win clears the line, the symbols above drop in, and the next win pays 2×, then 3×, and so on.</li>
                    <li>
                      {SCATTERS} or more stars anywhere on the first stop give {FREE_SPINS} free spins. Their cascades pay {FREE_MULT}×, {FREE_MULT * 2}×,{' '}
                      {FREE_MULT * 3}×…
                    </li>
                    <li>Three diamonds pay the {fmt(JACKPOT)}× jackpot, with no multiplier.</li>
                    <li>
                      About 1 spin in 7 wins. Free spins come about 1 spin in 120, the jackpot about 1 in 28,000. Long-run return{' '}
                      {(EXACT_RTP * 100).toFixed(2)}%.
                    </li>
                  </ul>
                </div>
              )}
            </div>
          </div>

          <div className={`sl-msg tone-${msg.tone}`} aria-live="polite">
            {msg.text}
          </div>
        </div>

        {mode === 'nearmiss' && (
          <aside className="sl-tube" aria-label="Jackpot pile, part of the near-miss demo">
            <span className="sl-tube-label">Jackpot pile</span>
            <div className="sl-tube-glass" aria-hidden>
              <span className="sl-tube-mark" />
              <span className="sl-tube-fill" style={{ width: `${pile}%` }} />
              {Array.from({ length: coins }, (_, i) => (
                <span key={i} className="sl-coin" style={{ bottom: `${(i / COIN_SLOTS) * 100}%`, marginLeft: `${((i * 37) % 9) - 27}px` }} />
              ))}
            </div>
            <span className={`sl-tube-status ${pile >= 80 ? 'hot' : ''}`}>{pile >= 80 ? 'Almost there!' : pile >= 50 ? 'Heating up' : 'Building'}</span>
          </aside>
        )}

        <div className="sl-bar">
          <div className="sl-bar-fields">
            <button className="sl-round sl-info" onClick={() => setInfoOpen((o) => !o)} disabled={busy} aria-pressed={infoOpen} aria-label="Paytable and rules">
              i
            </button>
            <div className="sl-field">
              <span>Demo chips</span>
              <strong>{fmt(balance)}</strong>
            </div>
            <div className="sl-field sl-bet">
              <button className="sl-round" onClick={() => setStake(STAKES[stakeIdx - 1])} disabled={busy || stakeIdx <= 0} aria-label="Lower bet">
                −
              </button>
              <div>
                <span>Bet</span>
                <strong>{stake}</strong>
              </div>
              <button
                className="sl-round"
                onClick={() => setStake(STAKES[stakeIdx + 1])}
                disabled={busy || stakeIdx >= STAKES.length - 1}
                aria-label="Raise bet"
              >
                +
              </button>
            </div>
            <div className="sl-field sl-win">
              <span>Win</span>
              <strong key={win}>{fmt(win)}</strong>
            </div>
          </div>
          <button className={`sl-spin ${busy ? 'is-busy' : ''}`} onClick={spin} disabled={!canSpin} aria-label={`Spin for ${stake} demo chips`}>
            <svg viewBox="0 0 48 48" aria-hidden focusable="false">
              <path d="M38 24a14 14 0 0 1-24.6 9.2" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
              <path d="M10 24a14 14 0 0 1 24.6-9.2" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
              <path d="M36.5 5.5v10h-10z" fill="currentColor" />
              <path d="M11.5 42.5v-10h10z" fill="currentColor" />
            </svg>
          </button>
        </div>

        {(blockedReason || (!busy && balance < stake)) && (
          <div className="sl-under">
            {blockedReason ? (
              <p className="limit-banner">{blockedReason} Spins are paused.</p>
            ) : (
              <>
                <span>Not enough demo chips for a {stake} chip spin.</span>
                <button className="btn" onClick={() => setBalance((b) => b + START)}>
                  Refill {fmt(START)} free demo chips
                </button>
              </>
            )}
          </div>
        )}
      </section>

      <p className="sl-odds">
        About 1 spin in 7 wins. Free spins come about 1 spin in 120, the jackpot about 1 in 28,000. Long-run return{' '}
        <strong>{(EXACT_RTP * 100).toFixed(2)}%</strong>, a {((1 - EXACT_RTP) * 100).toFixed(2)}% house edge. Every spin is independent, and demo
        chips have no value. Net on this machine:{' '}
        <strong className={net > 0 ? 'pos' : net < 0 ? 'neg' : ''}>{net > 0 ? `+${fmt(net)}` : net < 0 ? `−${fmt(-net)}` : '±0'}</strong>.
      </p>
    </main>
  )
}
