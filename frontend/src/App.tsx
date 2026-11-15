import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from './client'
import { useCasino } from './hooks/useCasino'
import { useSession } from './hooks/useSession'
import { roundClock } from './lib/rounds'
import { SessionBar } from './components/SessionBar'
import { BlockStream } from './components/BlockStream'
import { RoundHud } from './components/RoundHud'
import { BetPanel } from './components/BetPanel'
import { History } from './components/History'
import { RevealOverlay } from './components/RevealOverlay'
import { LimitsDialog, RealityCheck } from './components/Dialogs'
import { IconCube } from './components/icons'
import { Sidebar } from './components/Sidebar'
import { SiteHeader } from './components/lobby/SiteHeader'
import { Lobby } from './components/lobby/Lobby'
import { SettingsDialog } from './components/lobby/SettingsDialog'
import { useWallet } from './hooks/useWallet'
import { hasContracts } from './wallet/session'
import type { Tile } from './components/lobby/Lobby'
import { SlotScreen } from './components/slot/SlotScreen'
import { toChips } from './lib/format'
import { THEMES, themeForGame, themeForRound } from './lib/themes'
import { EffectsDemo, effectsDemoEnabled } from './components/EffectsDemo'

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
  // Lobby first, like casino sites. Owner of the lobby, top bar, wallet and settings: Zander.
  const [view, setView] = useState<'lobby' | 'game' | 'slot'>('lobby')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const wallet = useWallet()

  const openGame = useCallback((id: number) => {
    setGameId(id)
    setView('game')
    window.scrollTo(0, 0)
  }, [])

  // Slot demo (sim only, demo chips): not a round-based casino game, so it's an extra lobby tile.
  const extraTiles = useMemo<Tile[]>(
    () => [
      {
        key: 'slot',
        name: 'Diamond Cascade',
        art: 'slot',
        category: 'house',
        odds: 'About 1 spin in 7 wins · jackpot 1,000×',
        rtp: '98% RTP',
        tag: 'demo',
        describe:
          'Cascading reels, free spins and a 1,000× jackpot, with demo chips. Shows near-miss slot design, with a switch to the honest view of the same spins.',
        play: () => {
          setView('slot')
          window.scrollTo(0, 0)
        },
      },
    ],
    [],
  )
  const { recordBet } = session
  const onSlotStake = useCallback((n: number) => recordBet(toChips(String(n))), [recordBet])
  const onSlotPaid = useCallback((n: number) => recordRound(toChips(String(n))), [recordRound])

  // When a wallet connects through the wallet SDK, start the casino session too: in sim mode
  // that's the sim account, in chain mode chain.ts connects to the same wallet (no extra popup
  // once the site is authorized). Until chain.ts moves onto the SDK, chain.ts uses window.ethereum.
  const synced = useRef<string | null>(null)
  const connectCasino = casino.connect
  useEffect(() => {
    const addr = wallet.state.status === 'connected' ? wallet.state.address : null
    if (!addr || synced.current === addr || casino.account || casino.busy) return
    if (client.mode === 'chain' && !hasContracts) return
    synced.current = addr
    connectCasino()
  }, [wallet.state.status, wallet.state.address, casino.account, casino.busy, client.mode, connectCasino])
  // Each game has one fixed theme. The page takes the look of the game you're on;
  // the lobby and the slot demo use Calm.
  const theme = view === 'game' ? themeForGame(gameId) : THEMES.calm
  useEffect(() => {
    document.documentElement.dataset.theme = theme.id
  }, [theme.id])

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
    <div className={`app ${view === 'game' && clock && !clock.open ? 'is-locked' : ''}`}>
      <SiteHeader
        mode={client.mode}
        label={client.label}
        head={head}
        view={view === 'lobby' ? 'lobby' : 'game'}
        onHome={() => setView('lobby')}
        account={casino.account}
        balance={casino.balance}
        net={session.net}
        busy={casino.busy}
        onStart={casino.connect}
        onGetChips={casino.faucet}
        onSettings={() => setSettingsOpen(true)}
        wallet={wallet}
      />
      {view === 'lobby' ? (
        <Lobby mode={client.mode} onPlay={openGame} extra={extraTiles} onLimits={() => setEditingLimits(true)} />
      ) : view === 'slot' ? (
        <SlotScreen blockedReason={session.blockedReason} onStake={onSlotStake} onPaid={onSlotPaid} />
      ) : (
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
      )}

      {casino.reveal && (
        <RevealOverlay
          record={casino.reveal}
          theme={themeForRound(casino.reveal)}
          wallet={casino.account}
          onClose={casino.dismissReveal}
          onReplayDone={casino.finishReplay}
        />
      )}
      {session.showRealityCheck && (
        <RealityCheck
          elapsedMs={session.elapsedMs}
          net={session.net}
          rounds={session.rounds}
          onContinue={session.dismissRealityCheck}
        />
      )}
      {settingsOpen && (
        <SettingsDialog
          mode={client.mode}
          onLimits={() => {
            setSettingsOpen(false)
            setEditingLimits(true)
          }}
          wallet={wallet}
          onClose={() => setSettingsOpen(false)}
        />
      )}
      {effectsDemoEnabled() && <EffectsDemo wallet={casino.account} />}
      {editingLimits && (
        <LimitsDialog limits={session.limits} onSave={session.setLimits} onClose={() => setEditingLimits(false)} />
      )}
    </div>
  )
}
