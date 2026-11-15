import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from './client'
import { useCasino } from './hooks/useCasino'
import { useSession } from './hooks/useSession'
import { roundClock } from './lib/rounds'
import { TopBar } from './components/TopBar'
import { SessionBar } from './components/SessionBar'
import { BlockStream } from './components/BlockStream'
import { RoundHud } from './components/RoundHud'
import { BetPanel } from './components/BetPanel'
import { History } from './components/History'
import { RevealOverlay, revealDelayMs, revealIntensity } from './components/RevealOverlay'
import { LimitsDialog, RealityCheck } from './components/Dialogs'

export default function App() {
  const [client, clientError] = useMemo(() => {
    try {
      return [createClient(), null] as const
    } catch (e) {
      return [null, e instanceof Error ? e.message : String(e)] as const
    }
  }, [])
  if (!client) return <div className="fatal">{clientError}</div>
  return <Casino client={client} />
}

function Casino({ client }: { client: NonNullable<ReturnType<typeof createClient>> }) {
  const session = useSession()
  const { recordRound } = session
  const onResolved = useCallback((r: { paid: bigint }) => recordRound(r.paid), [recordRound])
  const casino = useCasino(client, onResolved)
  const [editingLimits, setEditingLimits] = useState(false)
  const [shake, setShake] = useState(0)

  const { cfg, head } = casino
  const clock = cfg && head !== null ? roundClock(head, cfg) : null
  const stakeInCurrent = !!clock && casino.pending.some((b) => b.roundId === clock.roundId)

  // Shake on a net-positive reveal, scaled to the real result. Waits for a crash
  // replay to finish so the shake doesn't give the result away early.
  useEffect(() => {
    if (!casino.reveal) return
    const i = revealIntensity(casino.reveal)
    if (i === 0) return
    let stop: ReturnType<typeof setTimeout> | undefined
    const start = setTimeout(() => {
      setShake(i)
      stop = setTimeout(() => setShake(0), 700)
    }, revealDelayMs(casino.reveal))
    return () => {
      clearTimeout(start)
      if (stop) clearTimeout(stop)
    }
  }, [casino.reveal])

  const disabledReason = !casino.account
    ? client.mode === 'sim'
      ? 'Start a session first'
      : 'Connect a wallet first'
    : session.blockedReason
      ? 'Session limit reached'
      : clock && !clock.open
        ? 'Betting locked'
        : null

  // Heat drives the lock-phase build-up in CSS. It runs harder when you have chips riding.
  const heat = clock ? clock.heat * (stakeInCurrent ? 1 : 0.45) : 0

  return (
    <div
      className={`app ${clock && !clock.open ? 'is-locked' : ''} ${shake ? 'shake' : ''}`}
      style={{ '--heat': heat, '--shake': shake } as React.CSSProperties}
    >
      <TopBar
        label={client.label}
        mode={client.mode}
        head={head}
        account={casino.account}
        balance={casino.balance}
        busy={casino.busy}
        onConnect={casino.connect}
        onFaucet={casino.faucet}
      />
      <SessionBar
        elapsedMs={session.elapsedMs}
        net={session.net}
        staked={session.staked}
        rounds={session.rounds}
        limits={session.limits}
        onEditLimits={() => setEditingLimits(true)}
      />

      {casino.error && (
        <div className="toast" onClick={casino.clearError}>
          {casino.error}
        </div>
      )}
      {session.blockedReason && (
        <div className="limit-banner">{session.blockedReason} Betting is paused. You can change limits, but consider taking a break.</div>
      )}

      <main className="layout">
        <section className="stage">
          <div className="grid-bg" aria-hidden />
          {clock && cfg ? (
            <RoundHud
              clock={clock}
              roundLength={Number(cfg.roundLength)}
              bettingWindow={Number(cfg.bettingWindow)}
              myStakeInRound={stakeInCurrent}
            />
          ) : (
            <div className="hud muted">Waiting for blocks…</div>
          )}
          <BlockStream blocks={casino.blocks} />
          {casino.needsSettle.map((id) => (
            <div key={id.toString()} className="settle-callout">
              Round {id.toString()} is locked. Request its random result to settle it. You pay the VRF fee in MON.
              <button className="btn primary small" disabled={!!casino.busy} onClick={() => casino.settle(id)}>
                Request result
              </button>
            </div>
          ))}
        </section>

        <aside className="side">
          {cfg && (
            <BetPanel
              mode={client.mode}
              canBet={!disabledReason}
              disabledReason={disabledReason}
              busy={casino.busy}
              minBet={cfg.minBet}
              maxBet={cfg.maxBet}
              myBets={casino.pending}
              onPlace={async (g, c, a) => {
                const bet = await casino.placeBet(g, c, a)
                if (bet) session.recordBet(bet.amount)
              }}
            />
          )}
          <History history={casino.history} />
        </aside>
      </main>

      {casino.reveal && <RevealOverlay record={casino.reveal} onClose={casino.dismissReveal} />}
      {session.showRealityCheck && (
        <RealityCheck
          elapsedMs={session.elapsedMs}
          net={session.net}
          rounds={session.rounds}
          onContinue={session.dismissRealityCheck}
        />
      )}
      {editingLimits && (
        <LimitsDialog limits={session.limits} onSave={session.setLimits} onClose={() => setEditingLimits(false)} />
      )}
    </div>
  )
}
