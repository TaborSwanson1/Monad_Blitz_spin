import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from './client'
import { useCasino } from './hooks/useCasino'
import { useSession } from './hooks/useSession'
import { roundClock } from './lib/rounds'
import { SessionBar } from './components/SessionBar'
import { BlockStream } from './components/BlockStream'
import { RoundHud } from './components/RoundHud'
import { ChainCrashLive, CrashLive } from './components/CrashLive'
import { BetPanel } from './components/BetPanel'
import { History } from './components/History'
import { RevealOverlay } from './components/RevealOverlay'
import { LimitsDialog, RealityCheck } from './components/Dialogs'
import { IconCube } from './components/icons'
import { Sidebar } from './components/Sidebar'
import { SiteHeader } from './components/lobby/SiteHeader'
import { TxFeed, useGasBalance } from './components/WalletActivity'
import { Lobby } from './components/lobby/Lobby'
import { SettingsDialog } from './components/lobby/SettingsDialog'
import { useWallet } from './hooks/useWallet'
import { hasContracts } from './wallet/session'
import { tileFor, type Tile } from './components/lobby/Lobby'
import { SlotScreen } from './components/slot/SlotScreen'
import { toChips } from './lib/format'
import { THEMES, themeForGame, themeForRound } from './lib/themes'
import { EffectsDemo, effectsDemoEnabled } from './components/EffectsDemo'
import { GAMES, gamesFor } from './lib/games'
import { Backdrop } from './fx/Backdrop'
import { SpaceBackdrop } from './fx/SpaceBackdrop'
import { CloverBackdrop } from './fx/CloverBackdrop'
import { Overlay } from './fx/Overlay'
import { FxControls } from './fx/FxControls'
import { GameSign } from './fx/GameSign'
import { Marquee } from './fx/Marquee'
import { EXACT_RTP } from './lib/slot'
import { SLOT_VOLATILITY } from './lib/volatility'
import { burst } from './fx/bus'
import { sfx, unlockAudio } from './fx/sound'
import { setTrack, trackFor, unlockMusic } from './fx/music'
import { Race } from './components/Race'
import { useClickSparks } from './effects/useClickSparks'

export default function App() {
  useClickSparks()
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
  // `?game=3` opens that game straight away (the on-chain site's simulator tiles link here).
  const [linkedGame] = useState(() => {
    const raw = new URLSearchParams(window.location.search).get('game')
    const id = raw === null || raw === '' ? NaN : Number(raw)
    return Number.isInteger(id) && gamesFor(client.mode).some((g) => g.id === id) ? id : null
  })
  const [gameId, setGameId] = useState(linkedGame ?? 0)
  // Lobby first, like casino sites. Owner of the lobby, top bar, wallet and settings: Zander.
  const [view, setView] = useState<'lobby' | 'game' | 'slot'>(linkedGame !== null ? 'game' : 'lobby')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const wallet = useWallet()

  const chainGameCount = casino.cfg?.gameCount
  const openGame = useCallback((id: number) => {
    setGameId(id)
    setView('game')
    window.scrollTo(0, 0)
  }, [])

  // Slot demo (sim only, plays on the account's chips): not a round-based casino game, so it's an extra lobby tile.
  const extraTiles = useMemo<Tile[]>(
    () => [
      {
        key: 'slot',
        name: 'Lucky Leprechaun',
        art: 'slot',
        category: 'house',
        odds: 'About 1 spin in 7 wins · jackpot 1,000×',
        rtp: SLOT_VOLATILITY,
        tag: 'demo',
        describe:
          'Cascading reels, free spins, a buy-feature button and a 1,000× jackpot, played with your chips. Shows near-miss slot design, with a switch to the honest view of the same spins.',
        play: () => {
          setView('slot')
          window.scrollTo(0, 0)
        },
      },
      // On-chain site: games the contract doesn't have yet (Crash, Beauty Contest) still get a
      // tile, marked "simulator", that opens them on the simulator build.
      ...(client.mode === 'chain' && import.meta.env.VITE_OTHER_MODE_URL
        ? GAMES.filter((g) => !gamesFor('chain', chainGameCount).includes(g)).map((g) => ({
            ...tileFor(g, () => {
              window.location.href = `${import.meta.env.VITE_OTHER_MODE_URL}?game=${g.id}`
            }, 'chain'),
            key: `sim-${g.id}`,
            tag: 'simulator',
            describe: `${g.describe} Plays on the simulator with free play chips, not on Monad yet.`,
          }))
        : []),
    ],
    [client.mode, chainGameCount],
  )
  const { recordBet } = session
  // The slot plays on the account's own chips: stakes come off the balance and wins go back on it.
  const { adjustBalance } = casino
  const onSlotStake = useCallback(
    (n: number) => {
      adjustBalance(-toChips(String(n)))
      recordBet(toChips(String(n)))
    },
    [adjustBalance, recordBet],
  )
  const onSlotPaid = useCallback(
    (n: number) => {
      adjustBalance(toChips(String(n)))
      recordRound(toChips(String(n)))
    },
    [adjustBalance, recordRound],
  )

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
  // Each game has one fixed theme. The page takes the look of the game you're on.
  // The lobby and the slot are Vegas (the slot used to stay Calm; changed at Zander's request, see Decisions).
  const theme = view === 'game' ? themeForGame(gameId) : THEMES.vegas
  useEffect(() => {
    document.documentElement.dataset.theme = theme.id
    // The slot keeps the Vegas layout but swaps the purple colours for a meadow green (slot.css).
    if (view === 'slot') document.documentElement.dataset.scene = 'leprechaun'
    else delete document.documentElement.dataset.scene
  }, [theme.id, view])
  const loud = theme.id === 'americana' || theme.id === 'vegas'

  // Background music follows the screen: one looping track per game (fx/music.ts).
  useEffect(() => setTrack(trackFor(view, gameId)), [view, gameId])
  useEffect(() => {
    window.addEventListener('pointerdown', unlockMusic, { once: true })
    window.addEventListener('keydown', unlockMusic, { once: true })
    return () => {
      window.removeEventListener('pointerdown', unlockMusic)
      window.removeEventListener('keydown', unlockMusic)
    }
  }, [])

  // Browsers only allow sound after a click or key press, so the first one unlocks it.
  useEffect(() => {
    window.addEventListener('pointerdown', unlockAudio, { once: true })
    window.addEventListener('keydown', unlockAudio, { once: true })
    return () => {
      window.removeEventListener('pointerdown', unlockAudio)
      window.removeEventListener('keydown', unlockAudio)
    }
  }, [])

  // Chain mode: the wallet's MON, for the header. Sim mode has no wallet balance.
  const gas = useGasBalance(client.mode === 'chain' ? casino.account : null)

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
        : stakeInCurrent
          ? 'One bet per round'
          : null

  return (
    <div className={`app ${view === 'game' && clock && !clock.open ? 'is-locked' : ''}`}>
      <Backdrop mode={view === 'slot' ? 'off' : theme.id === 'americana' ? 'americana' : theme.id === 'vegas' ? 'vegas' : 'off'} />
      {view === 'slot' && <CloverBackdrop />}
      {theme.id === 'space' && (
        // Stars speed up with the live Crash multiplier on screen (never the crash point).
        <SpaceBackdrop
          warp={casino.liveCrash && casino.liveCrash.state.crashedX100 === null ? casino.liveCrash.state.m : 1}
        />
      )}
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
        gas={gas}
      />
      {view === 'lobby' ? (
        <Lobby
          mode={client.mode}
          onPlay={openGame}
          extra={extraTiles}
          onLimits={() => setEditingLimits(true)}
          chainGameCount={cfg?.gameCount}
        />
      ) : view === 'slot' ? (
        <div className="shell sl-shell">
          <Sidebar
            mode={client.mode}
            chainGameCount={cfg?.gameCount}
            gameId={gameId}
            onPick={(id) => {
              setGameId(id)
              setView('game')
            }}
            onEditLimits={() => setEditingLimits(true)}
            slot={{ active: true, onPick: () => undefined }}
          />
          <main className="main-col">
            <Marquee tone="neon" className="game-sign sl-sign">
              <span className="gs-sticker" aria-hidden>
                Play
                <br />
                money
              </span>
              <span className="gs-kicker">Now playing</span>
              <span className="gs-name">Lucky Leprechaun</span>
              <span className="gs-odds">About 1 spin in 7 wins · jackpot 1,000× · {(EXACT_RTP * 100).toFixed(2)}% return</span>
            </Marquee>
            <SessionBar elapsedMs={session.elapsedMs} net={session.net} staked={session.staked} rounds={session.rounds} limits={session.limits} />
            {session.blockedReason && (
              <div className="limit-banner">
                {session.blockedReason} Betting is paused. You can change limits, but consider taking a break.
              </div>
            )}
            <SlotScreen
              blockedReason={session.blockedReason}
              balance={Math.floor(Number(casino.balance / 10n ** 15n) / 1000)}
              signedIn={!!casino.account}
              onGetChips={casino.faucet}
              onStake={onSlotStake}
              onPaid={onSlotPaid}
            />
          </main>
        </div>
      ) : (
      <div className="shell">
        <Sidebar
          mode={client.mode}
          chainGameCount={cfg?.gameCount}
          gameId={gameId}
          onPick={setGameId}
          onEditLimits={() => setEditingLimits(true)}
          slot={{ active: false, onPick: () => setView('slot') }}
        />

        <main className="main-col">
          {(loud || theme.id === 'space') && <GameSign game={GAMES[gameId]} theme={theme.id} />}
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
          {casino.liveCrash && <CrashLive live={casino.liveCrash} onCashOut={casino.cashOut} />}
          {casino.chainCrash && (
            <ChainCrashLive
              live={casino.chainCrash}
              busy={casino.busy === 'Cashing out'}
              onCashOut={() => casino.chainCrash && casino.cashOutChain(casino.chainCrash.roundId)}
            />
          )}
          {/* Block Race: the cars wait on the grid, and roll into pace laps once you've bet. */}
          {gameId === 2 && (
            <section className="card race-card">
              <Race
                pace={casino.pending.some((b) => b.gameId === 2)}
                picked={casino.pending.filter((b) => b.gameId === 2).map((b) => b.choice)}
              />
            </section>
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
              chain={client.mode === 'chain'}
              onPlace={async (g, c, a) => {
                const bet = await casino.placeBet(g, c, a)
                if (!bet) return
                session.recordBet(bet.amount)
                // Bet is in: confetti from the bet button, in the game's colors.
                const palette = themeForGame(g).id === 'americana' ? 'americana' : themeForGame(g).id === 'vegas' ? 'vegas' : null
                if (palette) {
                  const btn = document.querySelector('.bet .btn.wide')?.getBoundingClientRect()
                  burst({ palette, x: btn ? btn.left + btn.width / 2 : undefined, y: btn ? btn.top : undefined, power: Math.min(1, Number(a / 10n ** 18n) / 100) })
                  sfx.bet()
                }
              }}
            />
          )}
          <History history={casino.history} />
        </aside>
      </div>
      )}

      {casino.reveal && (
        <RevealOverlay
          key={casino.reveal.roundId.toString()}
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
      {loud && <Overlay />}
      {client.mode === 'chain' && <TxFeed />}
      {loud && <FxControls />}
      {editingLimits && (
        <LimitsDialog limits={session.limits} onSave={session.setLimits} onClose={() => setEditingLimits(false)} />
      )}
    </div>
  )
}
