import { useCallback, useEffect, useRef, useState } from 'react'
import type { Address, Hex } from 'viem'
import type { BlockInfo, CasinoClient, PlacedBet } from '../client'
import { GAMES } from '../lib/games'
import { payoutFor, resolveGame } from '../lib/outcomes'
import { lockBlock, type RoundConfig } from '../lib/rounds'
import { errMsg } from '../lib/format'

export interface ResolvedBet extends PlacedBet {
  outcome: number
  raw: number
  won: boolean
  payout: bigint
}

export interface RoundRecord {
  roundId: bigint
  seed: Hex
  bets: ResolvedBet[]
  staked: bigint
  paid: bigint
  net: bigint
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

  const refreshBalance = useCallback(() => {
    client.balance().then(setBalance).catch(() => {})
  }, [client])

  const resolveRound = useCallback(
    async (roundId: bigint, seed: Hex) => {
      const bets = pendingRef.current.filter((b) => b.roundId === roundId)
      const resolved: ResolvedBet[] = bets.map((b) => {
        const g = GAMES[b.gameId]
        const { raw, outcome } = resolveGame(seed, g)
        const won = outcome === b.choice
        return { ...b, raw, outcome, won, payout: payoutFor(b.amount, won, g) }
      })
      // Losing bets have nothing to claim, so they cost no gas.
      for (const b of resolved) if (b.won) await client.claim(b, b.payout)

      const staked = resolved.reduce((s, b) => s + b.amount, 0n)
      const paid = resolved.reduce((s, b) => s + b.payout, 0n)
      const record: RoundRecord = { roundId, seed, bets: resolved, staked, paid, net: paid - staked }

      done.current.add(roundId)
      setPending((p) => p.filter((b) => b.roundId !== roundId))
      setNeedsSettle((s) => s.filter((id) => id !== roundId))
      setHistory((h) => [record, ...h].slice(0, 30))
      setReveal(record)
      onResolvedRef.current(record)
      refreshBalance()
    },
    [client, refreshBalance],
  )

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
            if (st.status === 'settled' && st.seed) await resolveRound(id, st.seed)
            else if (st.status === 'none' && !client.autoSettles)
              setNeedsSettle((s) => (s.includes(id) ? s : [...s, id]))
            else if (st.status === 'expired') setError(`Round ${id} expired. Your stake can be refunded on-chain.`)
          })
          .catch((e) => setError(errMsg(e)))
          .finally(() => inFlight.current.delete(id))
      }
    },
    [client, resolveRound],
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
    needsSettle,
    busy,
    error,
    clearError,
    connect,
    faucet,
    placeBet,
    settle,
  }
}
