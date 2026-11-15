import { useState } from 'react'
import { toHex } from 'viem'
import type { RoundRecord } from '../hooks/useCasino'
import { toChips } from '../lib/format'
import { THEMES, type ThemeDef } from '../lib/themes'
import { RevealOverlay } from './RevealOverlay'

// Effects demo for the team. Open the app with ?fx in the URL (for example
// http://localhost:5174/?fx) to get a panel that plays every win and loss effect on a
// made-up High / Low round. Nothing touches the balance, history or session: the round
// is fake and the result card says "Demo, no chips moved". Players never see this
// panel unless they type that address.

export const effectsDemoEnabled = () =>
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('fx')

interface Case {
  label: string
  note: string
  theme: ThemeDef
  stake: string
  win: boolean
}

const CASES: Case[] = [
  { label: 'Americana win', note: 'Rockets, eagle, sign, flags (bet 10)', theme: THEMES.americana, stake: '10', win: true },
  { label: 'Americana big win', note: 'Same, plus the announcer (bet 150)', theme: THEMES.americana, stake: '150', win: true },
  { label: 'Wallet fire', note: 'Americana, small loss (bet 10)', theme: THEMES.americana, stake: '10', win: false },
  { label: 'Nuke', note: 'Americana, big loss (bet 150)', theme: THEMES.americana, stake: '150', win: false },
  { label: 'Monad tokens', note: 'Monad, win', theme: THEMES.monad, stake: '25', win: true },
  { label: 'Burning wallet', note: 'Monad, loss', theme: THEMES.monad, stake: '25', win: false },
  { label: 'Vegas win', note: 'Coins, confetti, marquee', theme: THEMES.vegas, stake: '25', win: true },
  { label: 'Vegas loss', note: 'Burning wallet', theme: THEMES.vegas, stake: '25', win: false },
  { label: 'Sparks', note: 'Calm, win', theme: THEMES.calm, stake: '25', win: true },
]

/** A fake High / Low round with one bet on HIGH that wins or loses. */
function fakeRound(c: Case, n: number): RoundRecord {
  const amount = toChips(c.stake)
  const payout = c.win ? (amount * 19_600n) / 10_000n : 0n
  const raw = c.win ? 72 : 31
  return {
    roundId: BigInt(n),
    seed: toHex(crypto.getRandomValues(new Uint8Array(32))),
    bets: [{ roundId: BigInt(n), index: 0, gameId: 0, choice: 1, amount, raw, outcome: raw >= 50 ? 1 : 0, won: c.win, payout }],
    staked: amount,
    paid: payout,
    net: payout - amount,
  }
}

export function EffectsDemo({ wallet }: { wallet: string | null }) {
  const [open, setOpen] = useState(true)
  const [play, setPlay] = useState<{ c: Case; rec: RoundRecord } | null>(null)

  return (
    <>
      <div className={`fx-demo ${open ? 'open' : ''}`}>
        <button className="fx-demo-head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          Effects demo <span className="muted small">{open ? 'hide' : 'show'}</span>
        </button>
        {open && (
          <div className="fx-demo-list">
            {CASES.map((c) => (
              <button
                key={c.label}
                className="btn small fx-demo-btn"
                onClick={() => setPlay({ c, rec: fakeRound(c, Date.now()) })}
              >
                <span>{c.label}</span>
                <span className="muted small">{c.note}</span>
              </button>
            ))}
            <p className="note">Plays on a made-up round. No chips move.</p>
          </div>
        )}
      </div>
      {play && (
        <RevealOverlay
          key={play.rec.roundId.toString()}
          record={play.rec}
          theme={play.c.theme}
          wallet={wallet}
          onClose={() => setPlay(null)}
          onReplayDone={() => {}}
          demo
        />
      )}
    </>
  )
}
