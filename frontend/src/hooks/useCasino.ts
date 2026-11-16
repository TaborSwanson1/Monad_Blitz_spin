import { useCallback, useEffect, useRef, useState } from 'react'
import type { Address, Hex } from 'viem'
import type { BlockInfo, CasinoClient, PlacedBet } from '../client'
import { resolveBet } from '../lib/outcomes'
import { GAMES } from '../lib/games'
import { lockBlock, type RoundConfig } from '../lib/rounds'
import { errMsg } from '../lib/format'
import { advance, cashOutAll, settleLive, startLive, type LiveBet, type LiveState } from '../lib/liveCrash'

export interface ResolvedBet extends PlacedBet {
  outcome: number
  raw: number
  won: boolean
  payout: bigint
  /** Crash only: the cash-out that counted, in hundredths. */
  cashoutX100?: number
  /** Crash only: true when that cash-out was the auto target, not a click. */
  autoCashout?: boolean
}

export interface RoundRecord {
  roundId: bigint
  seed: Hex
  bets: ResolvedBet[]
  staked: bigint
  paid: bigint
  net: bigint
  /** True when a Crash climb already played live, so the result screen skips the replay. */
  live?: boolean
}

/** A Crash climb running right now, after betting locked. */
export interface LiveCrash {
  roundId: bigint
  state: LiveState
  bets: LiveBet[]
}

const MAX_BLOCKS = 28

export function useCasino(client: CasinoClient, onRoundResolved: (r: RoundRecord) => void) {
  const [cfg, setCfg] = useState<RoundConfig | null>(null)
  const [blocks, setBlocks] = useState<BlockInfo[]>([])
  const [account, setAccount] = useState<Address | null>(null)
  const [balance, setBalance] = useState(0n)
  const [pending, setPending] = useState<PlacedBet[]>([])
  const [history, setHistory] = useState<RoundRecord[]>([])
  const [reveal, setReveal] = useState<RoundRecord | null>(null)
  const [needsSettle, setNeedsSettle] = useState<bigint[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const cfgRef = useRef(cfg)
  cfgRef.current = cfg
  const pendingRef = useRef(pending)
  pendingRef.current = pending
  const onResolvedRef = useRef(onRoundResolved)
  onResolvedRef.current = onRoundResolved
  const inFlight = useRef(new Set<bigint>())
  const done = useRef(new Set<bigint>())
  const unpublished = useRef<(() => void) | null>(null)
  // Live Crash: the run state lives in a ref (a timer moves it every 40 ms); `liveTick`
  // re-renders whatever shows it.
  const live = useRef<(LiveCrash & { seed: Hex; timer: ReturnType<typeof setInterval> }) | null>(null)
  const [liveTick, setLiveTick] = useState(0)

  const refreshBalance = useCallback(() => {
    client.balance().then(setBalance).catch(() => {})
  }, [client])

  const resolveRound = useCallback(
    async (roundId: bigint, seed: Hex, liveState?: LiveState) => {
      const bets = pendingRef.current.filter((b) => b.roundId === roundId)
      const resolved: ResolvedBet[] = bets.map((b) =>
        liveState && GAMES[b.gameId].kind === 'crash'
          ? { ...b, ...settleLive(liveState, b), autoCashout: liveState.auto.has(b.index) }
          : { ...b, ...resolveBet(seed, b.gameId, b.choice, b.amount) },
      )
      // Losing bets have nothing to claim, so they cost no gas.
      for (const b of resolved) if (b.won) await client.claim(b, b.payout)

      const staked = resolved.reduce((s, b) => s + b.amount, 0n)
      const paid = resolved.reduce((s, b) => s + b.payout, 0n)
      const record: RoundRecord = { roundId, seed, bets: resolved, staked, paid, net: paid - staked, live: !!liveState }

      done.current.add(roundId)
      setPending((p) => p.filter((b) => b.roundId !== roundId))
      setNeedsSettle((s) => s.filter((id) => id !== roundId))
      setReveal(record)
      // History, session stats and balance would all give the result away, so with a
      // crash bet they wait until the replay actually finishes (finishReplay). That
      // holds even if the tab is in the background and the animation is paused.
      const publish = () => {
        setHistory((h) => [record, ...h].slice(0, 30))
        onResolvedRef.current(record)
        refreshBalance()
      }
      unpublished.current?.() // an older round still waiting: publish it first
      unpublished.current = null
      // A live Crash climb was already watched in real time, so it publishes right away.
      // Exact Digit's wheel spins before the result shows, so it waits too.
      const replays = !liveState && resolved.some((b) => GAMES[b.gameId].kind === 'crash' || b.gameId === 1)
      if (replays) unpublished.current = publish
      else publish()
    },
    [client, refreshBalance],
  )

  /** Settlement arrived for a round with Crash bets: run the climb live, settle at the crash. */
  const beginLive = useCallback(
    (roundId: bigint, seed: Hex) => {
      if (live.current) return
      const bets: LiveBet[] = pendingRef.current
        .filter((b) => b.roundId === roundId && GAMES[b.gameId].kind === 'crash')
        .map((b) => ({ index: b.index, choice: b.choice, amount: b.amount }))
      const state = startLive(performance.now())
      const finish = () => {
        const L = live.current
        if (!L || L.roundId !== roundId) return
        clearInterval(L.timer)
        live.current = null
        setLiveTick((t) => t + 1)
        resolveRound(roundId, seed, state)
      }
      const tick = () => {
        advance(state, bets, performance.now())
        setLiveTick((t) => t + 1)
        if (state.crashedX100 !== null) {
          clearInterval(timer)
          setTimeout(finish, 1200) // hold the crash on screen for a moment
        }
      }
      const timer = setInterval(tick, 40)
      live.current = { roundId, seed, state, bets, timer }
      done.current.add(roundId)
      tick()
    },
    [resolveRound],
  )

  /** Cash out every Crash bet still riding, at this exact moment. */
  const cashOut = useCallback(() => {
    const L = live.current
    if (!L) return null
    const x = cashOutAll(L.state, L.bets, performance.now())
    setLiveTick((t) => t + 1)
    if (x === null) setError('Too late, it crashed first.')
    return x
  }, [])

  const checkRounds = useCallback(
    (head: bigint) => {
      const c = cfgRef.current
      if (!c) return
      const ids = [...new Set(pendingRef.current.map((b) => b.roundId))]
      for (const id of ids) {
        if (head < lockBlock(id, c) || inFlight.current.has(id) || done.current.has(id)) continue
        inFlight.current.add(id)
        client
          .roundState(id)
          .then(async (st) => {
            if (st.status === 'settled' && st.seed) {
              const hasCrash = pendingRef.current.some((b) => b.roundId === id && GAMES[b.gameId].kind === 'crash')
              if (hasCrash) beginLive(id, st.seed)
              else await resolveRound(id, st.seed)
            }
            else if (st.status === 'none' && !client.autoSettles)
              setNeedsSettle((s) => (s.includes(id) ? s : [...s, id]))
            else if (st.status === 'expired') setError(`Round ${id} expired. Your stake can be refunded on-chain.`)
          })
          .catch((e) => setError(errMsg(e)))
          .finally(() => inFlight.current.delete(id))
      }
    },
    [client, resolveRound, beginLive],
  )

  useEffect(() => {
    client.init().then(setCfg).catch((e) => setError(errMsg(e)))
  }, [client])

  useEffect(
    () =>
      client.subscribeBlocks((b) => {
        setBlocks((prev) => [b, ...prev.filter((x) => x.number !== b.number)].slice(0, MAX_BLOCKS))
        checkRounds(b.number)
      }),
    [client, checkRounds],
  )

  async function run<T>(label: string, fn: () => Promise<T>): Promise<T | undefined> {
    setBusy(label)
    setError(null)
    try {
      return await fn()
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(null)
    }
  }

  const connect = () =>
    run('Connecting', async () => {
      setAccount(await client.connect())
      refreshBalance()
    })

  /** Slot spins and wins go straight onto the account's chips (sim mode). */
  const adjustBalance = useCallback(
    (delta: bigint) => {
      if (!client.adjustBalance) return
      setBalance((b) => b + delta)
      void client.adjustBalance(delta)
    },
    [client],
  )

  const faucet = () =>
    run('Claiming chips', async () => {
      await client.faucet()
      refreshBalance()
    })

  const placeBet = (gameId: number, choice: number, amount: bigint) =>
    run('Placing bet', async () => {
      const bet = await client.placeBet(gameId, choice, amount)
      setPending((p) => [...p, bet])
      refreshBalance()
      return bet
    })

  const settle = (roundId: bigint) =>
    run('Requesting result', async () => {
      await client.requestSettlement(roundId)
      setNeedsSettle((s) => s.filter((id) => id !== roundId))
    })

  // Stable so the reveal's auto-close timer doesn't reset on every block.
  const dismissReveal = useCallback(() => setReveal(null), [])
  /** The crash replay ended: now history, stats and balance can show the result. */
  const finishReplay = useCallback(() => {
    const f = unpublished.current
    unpublished.current = null
    f?.()
  }, [])
  const clearError = useCallback(() => setError(null), [])

  return {
    cfg,
    blocks,
    head: blocks[0]?.number ?? null,
    account,
    balance,
    pending,
    history,
    reveal,
    dismissReveal,
    finishReplay,
    liveCrash: live.current ? { roundId: live.current.roundId, state: live.current.state, bets: live.current.bets } : null,
    liveTick,
    cashOut,
    needsSettle,
    busy,
    error,
    clearError,
    connect,
    faucet,
    adjustBalance,
    placeBet,
    settle,
  }
}
