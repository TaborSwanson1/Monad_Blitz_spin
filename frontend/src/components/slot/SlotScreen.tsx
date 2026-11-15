import { useEffect, useRef, useState, type CSSProperties } from 'react'
import {
  BUY_EXPECTED_X,
  BUY_PRICE_X,
  BUY_RTP,
  EXACT_RTP,
  FREE_MULT,
  FREE_SPINS,
  JACKPOT,
  PAY,
  SCATTERS,
  SYM,
  WILD_PAY,
  demoJackpot,
  nearMissGrid,
  randomSeed,
  randomTriggerSeed,
  resolveSlot,
  type SlotResult,
  type Spin,
} from '../../lib/slot'
import { prefersReducedMotion } from '../../lib/themes'
import { burst } from '../../fx/bus'
import { useFxPrefs } from '../../fx/prefs'
import { sfx } from '../../fx/sound'
import { Sym, SymbolDefs } from './SlotSymbols'
import { Leprechaun, type Mood } from './Leprechaun'
import { JackpotPile } from './JackpotPile'
import { createSlotFx, type SlotFx } from './slotFx'
import { setMuted, sound } from './slotSound'
import './slot.css'

// Slot demo "Lucky Leprechaun", sim only. Results come from lib/slot.ts (same math as the
// sandbox, exact return 0.97993). This file only decides how a result is SHOWN.
//
// Layout follows common slot conventions: logo and prize ladder beside framed reels, the jackpot
// as a heap of coins across the top, a leprechaun beside the reels, feature badges above them,
// and a control bar with a round spin button, "Buy feature" and "Demo jackpot". All art is ours
// (SlotSymbols.tsx, Leprechaun.tsx, JackpotPile.tsx and CSS). The page around it (sidebar, sign,
// session numbers, backdrop, sound and motion switches) is the same as the other games' (App.tsx).
//
// Two presentations of the SAME spins, switchable at the top:
//   Honest          what landed, nothing else.
//   Near-miss demo  CLAUDE.md's one exception (team decision 2026-11-15): on losing spins it
//                   teases the jackpot and free spins, more often as the demo balance drops;
//                   it holds the last reel when two rainbows are on the line; and the jackpot
//                   heap creeps up with losses and cascades as if the jackpot were getting closer.
//                   The leprechaun reacts to the tease. None of it changes what a spin pays.
//
// Two extra buttons:
//   Buy feature     pays BUY_PRICE_X (14) times the bet for a spin that starts with free spins. Its exact
//                   return is shown before you confirm (BUY_RTP, 98.45%). Effects follow the NET
//                   result: nothing celebrates until the winnings pass the price.
//   Demo jackpot    plays a made-up jackpot spin for show. Costs nothing, pays nothing, and the balance
//                   and the session numbers stay as they are.
//
// Win effects (slotFx.ts, slotSound.ts): coins, bills, flames, sparks, count-ups and sound.
// They follow the real result, as CLAUDE.md asks: each line's effects are sized by what it
// paid, and the Big win, Mega win and Jackpot shows need 20x, 100x and the jackpot. A losing
// spin gets none of them. The one exception is the near-miss demo, whose teases and held
// reel get their own (pink and blue) heat and sound. Motion effects are off for people who
// ask for reduced motion.
//
// Left out on purpose (CLAUDE.md): autoplay, turbo spins and made-up "someone won" tickers.
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
  tone: 'big' | 'mega' | 'jackpot' | 'free'
  title: string
  /** Chips, counted up on screen. */
  amount?: number
  sub?: string
}

const START = 1000
const STAKES = [1, 5, 10, 25, 50]
const PILE_MAX = 96 // the heap never reads "full": nothing is actually getting closer
const VIS = 1
const STOP_MS = [900, 1250, 1600]
const HOLD_MS = 3600
const IDLE_MSG = 'Three in a row on the middle line wins'
const PLURAL = ['blanks', 'clovers', 'horseshoes', 'pots of gold', 'hats', 'leprechauns', 'rainbows', 'gold coins']
const LADDER = [
  { sym: SYM.rainbow, name: 'Jackpot', pay: JACKPOT, jackpot: true },
  { sym: SYM.wild, name: 'Wilds', pay: WILD_PAY, jackpot: false },
  { sym: SYM.hat, name: 'Hats', pay: PAY[SYM.hat], jackpot: false },
  { sym: SYM.pot, name: 'Pots', pay: PAY[SYM.pot], jackpot: false },
  { sym: SYM.horseshoe, name: 'Shoes', pay: PAY[SYM.horseshoe], jackpot: false },
  { sym: SYM.clover, name: 'Clovers', pay: PAY[SYM.clover], jackpot: false },
]
// What the reels show before the first spin. No three in a row.
const ATTRACT = [
  [SYM.horseshoe, SYM.wild, SYM.clover],
  [SYM.hat, SYM.rainbow, SYM.pot],
  [SYM.clover, SYM.coin, SYM.horseshoe],
]
/** What the leprechaun says while idle. */
const IDLE_SAY = 'Try your luck!'
type Kind = 'spin' | 'buy' | 'demo'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const fmt = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 0 })
const rnd = () => Math.floor(Math.random() * PLURAL.length)
const gridOf = (s: Spin, k: number) => [s.above[k], s.lines[k].symbols, s.below]
/** How big a win is, from what it paid in multiples of the bet: 0 small, 1 good, 2 big (20x), 3 mega (100x), 4 jackpot. */
const tierOf = (x: number, jackpot: boolean) => (jackpot ? 4 : x >= 100 ? 3 : x >= 20 ? 2 : x >= 8 ? 1 : 0)
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
  const [shake, setShake] = useState(false)
  const [lep, setLep] = useState<{ mood: Mood; say: string }>({ mood: 'idle', say: IDLE_SAY })
  const [buyOpen, setBuyOpen] = useState(false)
  // Re-render when the Sound or Motion switch changes, so the effects follow it.
  const { sound: soundOn } = useFxPrefs()
  const muted = !soundOn

  const reelsRef = useRef(reels)
  const frameEl = useRef<HTMLDivElement>(null)
  const spinBtn = useRef<HTMLButtonElement>(null)
  const fxCanvas = useRef<HTMLCanvasElement>(null)
  const fxRef = useRef<SlotFx | null>(null)
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

  // The effects canvas. Not created at all under reduced motion.
  useEffect(() => {
    if (reduced || !fxCanvas.current) return
    const engine = createSlotFx(fxCanvas.current, () => frameEl.current)
    fxRef.current = engine
    return () => {
      engine?.destroy()
      fxRef.current = null
    }
  }, [reduced])

  /** Waits for an animation. Short under reduced motion, where the animation doesn't run. */
  const wait = async (ms: number) => {
    await sleep(reduced ? Math.min(ms, 150) : ms)
    return alive.current
  }
  /** Waits so something can be read. Never shortened. */
  const read = async (ms: number) => {
    await sleep(ms)
    return alive.current
  }
  const speak = (mood: Mood, say: string) => setLep({ mood, say })
  const bump = () => {
    if (reduced) return
    setShake(true)
    setTimeout(() => alive.current && setShake(false), 600)
  }

  /** Effects for one winning line, sized by what it really paid (`pay`, in multiples of the bet). */
  function celebrateLine(pay: number, k: number, jackpot: boolean, ice: boolean) {
    const t = tierOf(pay, jackpot)
    speak(t >= 2 ? 'big' : 'win', jackpot ? 'The rainbow jackpot!' : t >= 2 ? 'Gold! Pure gold!' : k > 0 ? 'And another!' : 'A win!')
    sound.win(Math.min(3, t + (k > 0 ? 1 : 0)))
    sound.coins(3 + t * 2)
    const f = fxRef.current
    if (!f) return
    f.coinBurst(Math.min(70, 8 + Math.round(pay * 1.5)), 0.8 + t * 0.12)
    f.heat(Math.min(1, 0.3 + 0.18 * k + pay / 80), 1300, ice ? 'ice' : 'fire')
    if (t >= 1) f.sparks(30 + t * 20)
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
    if (!reduced) durs.forEach((d) => setTimeout(() => alive.current && sound.stop(), d))
    if (hold) {
      // Near-miss demo: two diamonds are on the line, so the last reel keeps turning.
      if (!(await wait(STOP_MS[1] + 60))) return false
      setHolding(true)
      sound.hold(HOLD_MS - STOP_MS[1])
      fxRef.current?.heat(0.7, HOLD_MS - STOP_MS[1], 'ice')
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
  async function playLines(s: Spin, bet: number, wonBefore: number, pileUp: boolean, ice: boolean, quietUntil = 0): Promise<number> {
    let won = wonBefore
    for (let k = 0; k < s.lines.length; k++) {
      const line = s.lines[k]
      if (line.pay === 0) break
      won += line.pay * bet
      const sym = line.symbols.find((x) => x !== SYM.wild) ?? SYM.wild
      setStep({ k, mult: line.mult })
      setFx('lit')
      setWin(won)
      // A bought feature only celebrates once its winnings are past the price: no fanfare for a net loss.
      if (won > quietUntil) celebrateLine(line.pay, k, line.jackpot, ice)
      setMsg({
        text: line.jackpot
          ? `Jackpot! Three rainbows pay ${fmt(line.pay * bet)}`
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

  async function spin(which: Kind = 'spin') {
    const cost = which === 'spin' ? stake : which === 'buy' ? stake * BUY_PRICE_X : 0
    if (busy || blockedReason || balance < cost) return
    const bet = stake
    const nm = mode === 'nearmiss'
    const ratioAfter = (balance - cost) / START
    setBusy(true)
    setInfoOpen(false)
    setBuyOpen(false)
    setOverlay(null)
    setTeased([])
    setStep(null)
    setFree(null)
    setFx(null)
    setWin(0)
    if (cost > 0) {
      setBalance((b) => b - cost)
      setStaked((s) => s + cost)
      onStake(cost)
    }
    setMsg({ text: which === 'demo' ? 'Demo jackpot: not counted' : which === 'buy' ? 'Feature bought. Good luck!' : 'Good luck!', tone: 'idle' })
    speak('spin', which === 'buy' ? 'Here come the free spins!' : 'Come on, luck!')
    sound.unlock()
    sound.spin()
    // Same confetti as a bet on the other games, thrown from the spin button.
    const box = spinBtn.current?.getBoundingClientRect()
    if (which !== 'demo' && box) {
      burst({ palette: 'vegas', x: box.left + box.width / 2, y: box.top + box.height / 2, power: Math.min(1, cost / 100) })
      sfx.bet()
    }

    const r: SlotResult = which === 'demo' ? demoJackpot() : resolveSlot(which === 'buy' ? randomTriggerSeed() : randomSeed())
    owed.current = which === 'demo' ? 0 : r.total * bet
    const tease = nm && which === 'spin' ? nearMissGrid(r, ratioAfter) : null
    const opening = tease ? tease.grid : gridOf(r.base, 0)
    // The last reel is held when two rainbows sit on the line (near-miss demo only). On the demo
    // jackpot there is no hold: the third rainbow really lands.
    const holdFor = (g: number[][]) => nm && which === 'spin' && !reduced && g[1][0] === SYM.rainbow && g[1][1] === SYM.rainbow

    if (!(await reveal(opening, holdFor(opening)))) return
    if (tease) {
      const want = tease.kind === 'jackpot' ? SYM.rainbow : SYM.coin
      setTeased(tease.grid.flatMap((row, y) => row.flatMap((s, x) => (s === want ? [`${y}-${x}`] : []))))
      setMsg({
        text: tease.kind === 'jackpot' ? 'So close! The third rainbow stopped one row away' : `Almost! One more gold coin for ${FREE_SPINS} free spins`,
        tone: 'tease',
      })
      speak('tease', tease.kind === 'jackpot' ? 'Oh! So close!' : 'Just one coin short!')
      addPile(6)
      sound.tease()
      fxRef.current?.heat(0.45, 1500, 'pink')
    }

    let won = await playLines(r.base, bet, 0, nm, false, cost)
    if (!alive.current) return

    if (r.free.length > 0) {
      setTeased([])
      setOverlay({ tone: 'free', title: `${FREE_SPINS} free spins`, sub: `${r.stars} gold coins landed. Cascades pay double.` })
      setMsg({ text: `${FREE_SPINS} free spins won`, tone: 'free' })
      speak('free', 'Free spins!')
      sound.freeSpins()
      fxRef.current?.sparks(60)
      fxRef.current?.heat(0.6, 1500, 'ice')
      if (!(await read(1700))) return
      setOverlay(null)
      for (let i = 0; i < r.free.length; i++) {
        setFree({ n: i + 1, of: r.free.length })
        setMsg({ text: `Free spin ${i + 1} of ${r.free.length}`, tone: 'free' })
        const g = gridOf(r.free[i], 0)
        if (!(await reveal(g, holdFor(g)))) return
        won = await playLines(r.free[i], bet, won, nm, true, cost)
        if (!(await wait(350))) return
      }
      setFree(null)
    }

    const payout = r.total * bet // integer: every pay is a whole multiple of the stake
    if (payout !== won) console.warn('slot: shown wins differ from the result', { payout, won })
    owed.current = 0
    if (which !== 'demo') {
      setBalance((b) => b + payout)
      setPaid((p) => p + payout)
      onPaid(payout)
    }
    setWin(payout)

    // The big show follows the real NET result: for a bought feature that is the payout minus the
    // price, so a feature that pays less than it cost gets no fanfare. A demo jackpot costs nothing.
    const netX = (payout - cost) / bet
    if (payout > 0) {
      if (which === 'buy' && payout <= cost) {
        setMsg({ text: `Feature paid ${fmt(payout)}, less than its ${fmt(cost)} chip price`, tone: 'idle' })
      } else {
        setMsg({
          text:
            which === 'demo'
              ? `Demo jackpot: ${fmt(payout)} (not added to your chips)`
              : which === 'buy'
                ? `Feature paid ${fmt(payout)} · ${fmt(payout - cost)} more than its price`
                : `You won ${fmt(payout)} · ${fmt(r.total)}× your bet`,
          tone: 'win',
        })
      }
      if (nm && which === 'spin') setPile((p) => (r.jackpot ? 12 : Math.max(10, p - 4)))
      const t = which === 'buy' && netX <= 0 ? 0 : tierOf(which === 'buy' ? netX : r.total, r.jackpot)
      if (t >= 2) {
        const ms = reduced ? 2200 : [0, 0, 2600, 3800, 5200][t]
        setOverlay({
          tone: t === 4 ? 'jackpot' : t === 3 ? 'mega' : 'big',
          title: t === 4 ? 'Jackpot' : t === 3 ? 'Mega win' : 'Big win',
          amount: payout,
          sub:
            which === 'demo'
              ? 'Demo only: no chips were added'
              : which === 'buy'
                ? `${fmt(payout)} for a ${fmt(cost)} chip feature`
                : `${fmt(r.total)}× your ${fmt(bet)} chip bet`,
        })
        speak('big', t === 4 ? 'The rainbow jackpot!' : 'Gold! Pure gold!')
        sound.fanfare(t >= 3)
        bump()
        const f = fxRef.current
        if (f) {
          f.coinRain([0, 0, 70, 150, 240][t], ms - 500)
          f.bills([0, 0, 14, 36, 60][t], ms - 500)
          f.ground(ms - 700, 'fire')
          f.heat(1, ms - 700, t === 4 ? 'ice' : 'fire')
          if (t >= 3) f.fireworks(t === 4 ? 12 : 6, ms - 800)
        }
        if (!(await read(ms))) return
        setOverlay(null)
      }
    } else {
      if (!tease) setMsg({ text: which === 'buy' ? `Feature paid nothing (price ${fmt(cost)} chips)` : 'No win this spin', tone: 'idle' })
      if (nm) addPile(ratioAfter < 0.5 ? 9 : 5)
    }
    speak(
      'idle',
      payout > cost ? 'Lovely! Again?' : nm && which === 'spin' ? 'So close! Spin again!' : which === 'buy' ? 'The feature is done.' : 'No luck this time.',
    )
    setBusy(false)
  }

  const net = paid - staked
  const canSpin = !busy && !blockedReason && balance >= stake
  const stakeIdx = STAKES.indexOf(stake)
  const buyCost = stake * BUY_PRICE_X
  const canBuy = !busy && !blockedReason && balance >= buyCost
  // How big the jackpot heap is. A slow creep in the near-miss demo, a fixed size in the honest view.
  const heap = mode === 'nearmiss' ? 0.55 + 0.4 * (pile / 100) : 0.85

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
    <div className={`slot-page sl-mode-${mode} ${free ? 'sl-free' : ''} ${holding ? 'sl-hold' : ''}`}>
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

      <section className={`sl-scene ${shake ? 'sl-shake' : ''}`}>
        <div className="sl-backdrop" aria-hidden />

        <h2 className="sl-logo">
          <span>Lucky</span>
          Leprechaun
        </h2>

        <div className="sl-top">
          <JackpotPile amount={JACKPOT * stake} level={heap} excited={holding} />
        </div>

        <aside className="sl-side" aria-label="The leprechaun">
          <Leprechaun mood={lep.mood} say={lep.say} />
        </aside>

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
            Three in a row on the middle line, shown for a {stake} chip bet. The leprechaun is WILD and stands in for clovers, shoes, pots and hats.
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
                {SCATTERS}+ <Sym id={SYM.coin} className="sl-inline" /> anywhere award {FREE_SPINS} free spins
              </>
            )}
          </div>

          <div className={`sl-frame ${fx === 'lit' ? 'is-win' : ''}`} ref={frameEl}>
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
                  {overlay.amount !== undefined && (
                    <strong>
                      <Rolling value={overlay.amount} ms={reduced ? 0 : 1400} fromZero prefix="+" />
                    </strong>
                  )}
                  {overlay.sub && <span className="sl-overlay-sub">{overlay.sub}</span>}
                </div>
              )}

              {buyOpen && (
                <div className="sl-info-panel sl-buy-panel" role="dialog" aria-label="Buy feature">
                  <div className="sl-info-head">
                    <strong>Buy the free spins feature</strong>
                    <button className="sl-round sl-small" onClick={() => setBuyOpen(false)} aria-label="Cancel">
                      ×
                    </button>
                  </div>
                  <dl className="sl-buy-facts">
                    <div>
                      <dt>Price</dt>
                      <dd>
                        {fmt(buyCost)} chips <small>({BUY_PRICE_X}× your {fmt(stake)} chip bet)</small>
                      </dd>
                    </div>
                    <div>
                      <dt>You get</dt>
                      <dd>A spin that starts with {FREE_SPINS} free spins (double cascades)</dd>
                    </div>
                    <div>
                      <dt>Pays on average</dt>
                      <dd>
                        {fmt(Math.round(BUY_EXPECTED_X * stake))} chips <small>({BUY_EXPECTED_X.toFixed(2)}× your bet)</small>
                      </dd>
                    </div>
                    <div>
                      <dt>Return</dt>
                      <dd>
                        {(BUY_RTP * 100).toFixed(2)}% <small>a {((1 - BUY_RTP) * 100).toFixed(2)}% house edge, so over many buys you lose on average</small>
                      </dd>
                    </div>
                  </dl>
                  <p className="sl-buy-note">
                    Any single feature can pay far less or far more than its price. Demo chips have no value. Celebrations only play once the winnings pass the
                    price.
                  </p>
                  <div className="sl-buy-actions">
                    <button className="btn" onClick={() => setBuyOpen(false)}>
                      Cancel
                    </button>
                    <button className="btn primary" onClick={() => spin('buy')} disabled={!canBuy}>
                      Buy for {fmt(buyCost)}
                    </button>
                  </div>
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
                    <li>The leprechaun is WILD and stands in for clovers, horseshoes, pots of gold and hats. Three wilds pay {WILD_PAY}×.</li>
                    <li>Cascades: a win clears the line, the symbols above drop in, and the next win pays 2×, then 3×, and so on.</li>
                    <li>
                      {SCATTERS} or more gold coins anywhere on the first stop give {FREE_SPINS} free spins. Their cascades pay {FREE_MULT}×, {FREE_MULT * 2}×,{' '}
                      {FREE_MULT * 3}×…
                    </li>
                    <li>Three rainbows pay the {fmt(JACKPOT)}× jackpot, with no multiplier.</li>
                    <li>
                      Buy feature: {BUY_PRICE_X}× your bet starts a spin that triggers the free spins. It pays {BUY_EXPECTED_X.toFixed(2)}× your bet on average, a{' '}
                      {(BUY_RTP * 100).toFixed(2)}% return.
                    </li>
                    <li>Demo jackpot: a made-up jackpot spin for show. It costs nothing, pays nothing and isn't counted.</li>
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

        <div className="sl-bar">
          <div className="sl-bar-fields">
            <button className="sl-round sl-info" onClick={() => setInfoOpen((o) => !o)} disabled={busy} aria-pressed={infoOpen} aria-label="Paytable and rules">
              i
            </button>
            <button
              className="sl-round sl-mute"
              onClick={() => setMuted(!muted)}
              aria-pressed={!muted}
              aria-label={muted ? 'Turn sound on' : 'Turn sound off'}
              title={muted ? 'Sound is off' : 'Sound is on'}
            >
              <svg viewBox="0 0 24 24" aria-hidden focusable="false">
                <path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z" fill="currentColor" />
                {muted ? (
                  <path d="m15.5 9.5 5 5m0-5-5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                ) : (
                  <path d="M15.5 9a4.5 4.5 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                )}
              </svg>
            </button>
            <div className="sl-bar-extras">
              <button className="sl-pill sl-buy" onClick={() => setBuyOpen((o) => !o)} disabled={busy || !!blockedReason} aria-pressed={buyOpen}>
                <b>Buy feature</b>
                <span>{fmt(buyCost)} chips</span>
              </button>
              <button className="sl-pill sl-demo" onClick={() => spin('demo')} disabled={busy} title="A made-up jackpot spin for show. Free and not counted.">
                <b>Demo jackpot</b>
                <span>free · not counted</span>
              </button>
            </div>
            <div className="sl-field">
              <span>Demo chips</span>
              <strong>
                <Rolling value={balance} ms={reduced ? 0 : 600} />
              </strong>
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
              <strong>
                <Rolling value={win} ms={reduced ? 0 : 450} />
              </strong>
            </div>
          </div>
          <button ref={spinBtn} className={`sl-spin ${busy ? 'is-busy' : ''}`} onClick={() => spin('spin')} disabled={!canSpin} aria-label={`Spin for ${stake} demo chips`}>
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

        <canvas ref={fxCanvas} className="sl-fx" aria-hidden />
      </section>

      <p className="sl-odds">
        About 1 spin in 7 wins. Free spins come about 1 spin in 120, the jackpot about 1 in 28,000. Long-run return{' '}
        <strong>{(EXACT_RTP * 100).toFixed(2)}%</strong>, a {((1 - EXACT_RTP) * 100).toFixed(2)}% house edge (bought features: {(BUY_RTP * 100).toFixed(2)}%).
        Every spin is independent, and demo chips have no value. Net on this machine:{' '}
        <strong className={net > 0 ? 'pos' : net < 0 ? 'neg' : ''}>{net > 0 ? `+${fmt(net)}` : net < 0 ? `−${fmt(-net)}` : '±0'}</strong>.
      </p>
    </div>
  )
}

/** A number that counts to its new value instead of jumping. `ms` 0 turns the counting off. */
function Rolling({ value, ms, fromZero = false, prefix = '' }: { value: number; ms: number; fromZero?: boolean; prefix?: string }) {
  const [shown, setShown] = useState(fromZero ? 0 : value)
  const at = useRef(fromZero ? 0 : value)

  useEffect(() => {
    const from = at.current
    if (from === value) return
    if (ms <= 0) {
      at.current = value
      setShown(value)
      return
    }
    const t0 = performance.now()
    let raf = 0
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / ms)
      const v = k >= 1 ? value : Math.round(from + (value - from) * (1 - (1 - k) ** 3))
      at.current = v
      setShown(v)
      if (k < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value, ms])

  return (
    <>
      {prefix}
      {fmt(shown)}
    </>
  )
}
