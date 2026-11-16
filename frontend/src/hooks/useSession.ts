import { useEffect, useState } from 'react'
import { toChips } from '../lib/format'

export interface Limits {
  /** Minutes. 0 means off. */
  timeMin: number
  /** Chips. 0 means off. */
  lossChips: number
  /** Minutes between reality checks. */
  checkEveryMin: number
}

// On by default, per the root README. Players can change them.
export const DEFAULT_LIMITS: Limits = {
  timeMin: 60,
  lossChips: 0, // off by default (team decision 2026-11-15); the player can still set one in Limits
  checkEveryMin: 15,
}
const KEY = 'block-casino:limits'

function loadLimits(): Limits {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? { ...DEFAULT_LIMITS, ...JSON.parse(raw) } : DEFAULT_LIMITS
  } catch {
    return DEFAULT_LIMITS
  }
}

export function useSession() {
  const [startedAt] = useState(() => Date.now())
  const [now, setNow] = useState(() => Date.now())
  const [staked, setStaked] = useState(0n)
  const [paid, setPaid] = useState(0n)
  const [rounds, setRounds] = useState(0)
  const [limits, setLimitsState] = useState(loadLimits)
  const [lastCheckAt, setLastCheckAt] = useState(() => Date.now())

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const elapsedMs = now - startedAt
  const net = paid - staked
  const timeUp = limits.timeMin > 0 && elapsedMs >= limits.timeMin * 60_000
  const lossHit = limits.lossChips > 0 && -net >= toChips(String(limits.lossChips))
  const showRealityCheck = limits.checkEveryMin > 0 && now - lastCheckAt >= limits.checkEveryMin * 60_000

  function setLimits(l: Limits) {
    setLimitsState(l)
    try {
      localStorage.setItem(KEY, JSON.stringify(l))
    } catch {
      // Storage blocked. Limits still apply for this session.
    }
  }

  return {
    elapsedMs,
    staked,
    paid,
    net,
    rounds,
    limits,
    setLimits,
    blockedReason: timeUp
      ? `You reached your ${limits.timeMin}-minute session limit.`
      : lossHit
        ? `You reached your ${limits.lossChips} CHIP loss limit.`
        : null,
    showRealityCheck,
    dismissRealityCheck: () => setLastCheckAt(Date.now()),
    recordBet: (amount: bigint) => setStaked((s) => s + amount),
    recordRound: (paidOut: bigint) => {
      setPaid((p) => p + paidOut)
      setRounds((r) => r + 1)
    },
  }
}
