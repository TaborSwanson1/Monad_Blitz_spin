import { useCallback, useEffect, useRef, useState } from 'react'
import type { RoundRecord } from '../hooks/useCasino'
import { CRASH_TARGETS_X100, fmtX } from '../lib/crash'
import { GAMES, LANE_COLORS } from '../lib/games'
import { fmtChips } from '../lib/format'
import { BIG_STAKE, type ThemeDef } from '../lib/themes'
import { BeautyResult } from './BeautyResult'
import { Burst } from './Burst'
import { BurningWallet, BURN_MS } from './BurningWallet'
import { CrashClimb } from './CrashClimb'
import { EAGLE_MS } from './Eagle'
import { MonadTokens } from './MonadTokens'
import { Nuke, NUKE_MS } from './Nuke'
import { OutcomeStrip } from './OutcomeStrip'
import { SlotDisplay } from './SlotDisplay'
import { WinEffects, WinLoop } from '../effects/WinEffects'
import { LoseEffects, ScreenFlash } from '../effects/LoseEffects'
import { useLoseEffects, useWinEffects, winIntensity } from '../effects/useOutcomeEffects'
import { AmericanaWin } from '../fx/AmericanaWin'
import { VegasWin } from '../fx/VegasWin'
import { SAME_ODDS, resultLine } from '../fx/lines'
import { sfx } from '../fx/sound'

/*
 * Two layers of effects play together, and both follow the real net result for the round,
 * never a single bet:
 * - The game's theme (lib/themes.ts): on a net win, the Americana show (rockets, eagle, sign,
 *   flags) or the Vegas show (coin fountain, marquee), with sound; on a net loss, a burning
 *   wallet or the nuke. The loud themes also add a headline, and under a loss a line saying
 *   every round is independent (fx/lines.ts).
 * - The shared effects (src/effects): purple coins, confetti, gold glow and a green/white
 *   flash on a net win, with the glow and a coin stream continuing until the player closes
 *   the reveal; embers, shake and a red/black flash on a net loss.
 * A break-even round gets neither. The result, your pick and the net show at once.
 */

/** Win size, 0 to 1, from the real net result (zero unless the round is net positive). */
export const revealIntensity = winIntensity

/** Share of the stake lost this round, 0 to 1. Zero unless the round is net negative. */
export function lossIntensity(r: RoundRecord): number {
  if (r.net >= 0n || r.staked === 0n) return 0
  return Math.min(1, Number((-r.net * 1000n) / r.staked) / 1000)
}

const LOSS_TEXT = {
  burn: 'Burned from your wallet',
  'top-fire': 'Your wallet caught fire',
  nuke: 'Your wallet got nuked',
} as const

const crashBetsOf =(r: RoundRecord) => r.bets.filter((b) => GAMES[b.gameId].kind === 'crash')

interface Props {
  record: RoundRecord
  /** Fixed theme for this round: the game with the biggest stake decides. */
  theme: ThemeDef
  /** The player's (sim-generated or connected) wallet, shown on the loss effect. */
  wallet: string | null
  onClose: () => void
  /** Called once a crash replay ends, so the rest of the page can show the result. */
  onReplayDone: () => void
  /** Effects demo (?fx): a made-up round. Labeled so nobody mistakes it for a real result. */
  demo?: boolean
}

export function RevealOverlay({ record, theme, wallet, onClose, onReplayDone, demo = false }: Props) {
  const crashBets = crashBetsOf(record)
  // A live Crash round was already watched as it climbed, so there's no replay.
  const replay = crashBets.length > 0 && !record.live
  const [climbDone, setClimbDone] = useState(!replay)
  const markDone = useCallback(() => {
    setClimbDone(true)
    onReplayDone()
  }, [onReplayDone])

  // Nothing hints at the result until the replay finishes.
  const win = useWinEffects(record, climbDone)
  const lose = useLoseEffects(record, climbDone)
  const intensity = win.intensity
  const loss = climbDone ? lossIntensity(record) : 0
  const up = intensity > 0
  // Big goes by the amount bet this round, not the amount won or lost.
  const big = record.staked >= BIG_STAKE

  // Which loss effect plays, if any. 'americana' splits at BIG_STAKE.
  const lossFx: 'none' | 'burn' | 'top-fire' | 'nuke' =
    loss === 0 || theme.loss === 'off'
      ? 'none'
      : theme.loss === 'burning-wallet'
        ? 'burn'
        : big
          ? 'nuke'
          : 'top-fire'

  // The loud themes get a sign above the result, a headline, and sound.
  const loud = theme.id === 'americana' || theme.id === 'vegas'
  const sign = up && (theme.win === 'americana' || theme.win === 'vegas')

  // A winning round stays open until the player closes it. Losses close once their theme
  // effect has played, other rounds after 3.2 s.
  useEffect(() => {
    if (!climbDone || up) return
    const ms = lossFx === 'nuke' ? NUKE_MS + 1600 : lossFx !== 'none' ? BURN_MS + 1600 : 3200
    const t = setTimeout(onClose, ms)
    return () => clearTimeout(t)
  }, [record, up, lossFx, onClose, climbDone])

  // Sound, once per result. Like the pictures, it follows the real net result: the
  // cash register and fanfare only on a net win, the boom only on a net loss.
  const sounded = useRef<RoundRecord | null>(null)
  useEffect(() => {
    if (!climbDone || !loud || sounded.current === record) return
    sounded.current = record
    if (up) {
      sfx.chaChing(intensity)
      if (theme.win === 'americana') {
        sfx.fanfare()
        sfx.rocket(0.15)
        sfx.rocket(0.6)
        sfx.rocket(1.15)
        sfx.eagle(0.5)
        sfx.eagle(EAGLE_MS / 2000 + 0.3)
        if (big) sfx.bigWinVoice()
      } else if (intensity >= 0.45) {
        sfx.fanfare()
        sfx.bigWinVoice(intensity >= 0.8 ? 'Mega win!' : 'Big win!')
      }
    } else if (lossFx === 'nuke') sfx.nuke()
    else if (lossFx !== 'none') {
      sfx.fire()
      sfx.loss()
    } else if (record.net < 0n) sfx.loss()
  }, [climbDone, loud, record, up, intensity, theme.win, big, lossFx])

  const headline = climbDone && loud ? resultLine(theme.id, record.net, record.seed) : null

  const crashTargets = [...new Set(crashBets.map((b) => CRASH_TARGETS_X100[b.choice]))]

  return (
    <div
      className={`reveal ${up ? 'reveal-up' : 'reveal-down'} ${lossFx !== 'none' ? 'has-bottom-fx' : ''} ${sign ? 'has-sign' : ''}`}
      onClick={climbDone ? onClose : undefined}
      role="dialog"
      aria-live="polite"
    >
      {win.particles && <ScreenFlash kind="win" />}
      {/* The nuke has its own strobe. Two full-screen flashes at once would pass three a second. */}
      {lose.particles && lossFx !== 'nuke' && <ScreenFlash kind="loss" />}
      {win.loop && <WinLoop intensity={intensity} />}
      {win.particles && <WinEffects {...win} />}
      {lose.particles && <LoseEffects />}
      {up && theme.win === 'monad-tokens' && <MonadTokens intensity={intensity} />}
      {up && theme.win === 'sparks' && <Burst intensity={intensity} />}
      {up && theme.win === 'americana' && <AmericanaWin intensity={intensity} />}
      {up && theme.win === 'vegas' && <VegasWin intensity={intensity} />}
      <div className={`reveal-card ${win.cardClass} ${lose.cardClass}`} style={win.cardStyle}>
        <div className="reveal-round">
          {demo ? <span className="demo-tag">Demo, no chips moved</span> : <>Round {record.roundId.toString()} settled</>}
        </div>

        {replay && <CrashClimb crashX100={crashBets[0].raw} targetsX100={crashTargets} onDone={markDone} />}

        {climbDone && (
          <>
            {headline && <div className="reveal-line">{headline}</div>}
            <div className="reveal-results">
              {record.bets.map((b) => {
                const g = GAMES[b.gameId]
                if (g.kind === 'beauty') {
                  return (
                    <div key={b.index} className="reveal-row reveal-row-wide">
                      <div className="reveal-game">{g.name}</div>
                      <BeautyResult roundSeed={record.seed} yourGuess={b.choice} />
                      <div className="reveal-pick">
                        Your guess {b.choice} · {b.won ? `paid ${fmtChips(b.payout)}` : 'no payout'}
                      </div>
                    </div>
                  )
                }
                const shown =
                  g.kind === 'crash'
                    ? fmtX(b.raw)
                    : g.id === 2
                      ? g.labels[b.outcome]
                      : String(b.raw).padStart(String(g.range - 1).length, '0')
                return (
                  <div key={b.index} className="reveal-row">
                    <div className="reveal-game">{g.name}</div>
                    <SlotDisplay
                      value={shown}
                      color={g.id === 2 ? LANE_COLORS[b.outcome] : undefined}
                      small={g.kind === 'crash' || g.id === 2}
                    />
                    {g.kind === 'uniform' && <OutcomeStrip game={g} outcome={b.outcome} choice={b.choice} />}
                    <div className="reveal-pick">
                      {g.kind === 'crash'
                        ? b.cashoutX100 !== undefined && b.won
                          ? `${b.autoCashout ? 'Auto cash-out' : 'You cashed out'} at ${fmtX(b.cashoutX100)}`
                          : "You didn't cash out in time"
                        : `You picked ${g.labels[b.choice]}`}{' '}
                      · {b.won ? `paid ${fmtChips(b.payout)}` : 'no payout'}
                    </div>
                  </div>
                )
              })}
            </div>
            <div className={`reveal-net ${up ? 'pos' : record.net < 0n ? 'neg' : ''}`}>
              {fmtChips(record.net, { sign: true })} CHIP
            </div>
            {lossFx !== 'none' && <div className="reveal-sub">{LOSS_TEXT[lossFx]}</div>}
            {loud && record.net < 0n && <div className="reveal-odds">{SAME_ODDS}</div>}
          </>
        )}
        <div className="reveal-seed">
          seed {record.seed.slice(0, 18)}…{record.live && ' · crash point drawn live, not from the seed'}
        </div>
        {up && (
          <button className="btn reveal-close" onClick={onClose}>
            Close
          </button>
        )}
      </div>
      {/* Wallet effects play big at the bottom of the screen, behind the card. */}
      {lossFx === 'burn' && <BurningWallet wallet={wallet} intensity={loss} />}
      {lossFx === 'top-fire' && <BurningWallet wallet={wallet} intensity={loss} variant="top" />}
      {lossFx === 'nuke' && <Nuke wallet={wallet} />}
    </div>
  )
}
