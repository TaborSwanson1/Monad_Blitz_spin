import { useCallback, useMemo, useState } from 'react'
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
import { RevealOverlay } from './components/RevealOverlay'
import { LimitsDialog, RealityCheck } from './components/Dialogs'
import { IconCube } from './components/icons'
import { Sidebar } from './components/Sidebar'

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
  const [gameId, setGameId] = useState(0)

  const { cfg, head } = casino
  const clock = cfg && head !== null ? roundClock(head, cfg) : null
  const stakeInCurrent = !!clock && casino.pending.some((b) => b.roundId === clock.roundId)

  const disabledReason = !casino.account
    ? client.mode === 'sim'
      ? 'Start a session first'
      : 'Connect a wallet first'
    : session.blockedReason
      ? 'Session limit reached'
      : clock && !clock.open
        ? 'Betting locked'
        : null

  return (
    <div className={`app ${clock && !clock.open ? 'is-locked' : ''}`}>
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
      <div className="shell">
        <Sidebar mode={client.mode} gameId={gameId} onPick={setGameId} onEditLimits={() => setEditingLimits(true)} />

        <main className="main-col">
          <SessionBar
            elapsedMs={session.elapsedMs}
            net={session.net}
            staked={session.staked}
            rounds={session.rounds}
            limits={session.limits}
          />
          {casino.error && (
            <div className="toast" onClick={casino.clearError}>
              {casino.error}
            </div>
          )}
          {session.blockedReason && (
            <div className="limit-banner">
              {session.blockedReason} Betting is paused. You can change limits, but consider taking a break.
            </div>
          )}
          {clock && cfg ? (
            <RoundHud
              clock={clock}
              roundLength={Number(cfg.roundLength)}
              bettingWindow={Number(cfg.bettingWindow)}
              myStakeInRound={stakeInCurrent}
            />
          ) : (
            <section className="card">
              <div className="card-body muted">Waiting for blocks…</div>
            </section>
          )}
          {casino.needsSettle.map((id) => (
            <div key={id.toString()} className="settle-callout">
              Round {id.toString()} is locked. Request its random result to settle it. You pay the VRF fee in MON.
              <button className="btn primary small" disabled={!!casino.busy} onClick={() => casino.settle(id)}>
                Request result
              </button>
            </div>
          ))}
          <section className="card">
            <header className="card-head">
              <IconCube />
              <h3>Live blocks</h3>
              <div className="card-actions muted small">Display only. Results come from the VRF.</div>
            </header>
            <div className="card-body">
              <BlockStream blocks={casino.blocks} />
            </div>
          </section>
        </main>

        <aside className="rightbar">
          {cfg && (
            <BetPanel
              key={gameId}
              gameId={gameId}
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
      </div>

      {casino.reveal && (
        <RevealOverlay
          key={casino.reveal.roundId.toString()}
          record={casino.reveal} onClose={casino.dismissReveal} onReplayDone={casino.finishReplay} />
      )}
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
