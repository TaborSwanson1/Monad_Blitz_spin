import { fmtChips, fmtDuration } from '../lib/format'
import type { Limits } from '../hooks/useSession'

interface Props {
  elapsedMs: number
  net: bigint
  staked: bigint
  rounds: number
  limits: Limits
  onEditLimits: () => void
}

export function SessionBar({ elapsedMs, net, staked, rounds, limits, onEditLimits }: Props) {
  const tone = net > 0n ? 'pos' : net < 0n ? 'neg' : ''
  return (
    <div className="sessionbar">
      <Stat k="SESSION" v={fmtDuration(elapsedMs)} sub={limits.timeMin ? `limit ${limits.timeMin}m` : 'no limit'} />
      <Stat k="NET RESULT" v={`${fmtChips(net, { sign: true })} CHIP`} tone={tone} />
      <Stat k="WAGERED" v={`${fmtChips(staked)} CHIP`} />
      <Stat k="ROUNDS" v={String(rounds)} />
      <Stat k="LOSS LIMIT" v={limits.lossChips ? `${limits.lossChips} CHIP` : 'off'} />
      <button className="btn ghost small" onClick={onEditLimits}>
        Limits
      </button>
    </div>
  )
}

function Stat({ k, v, sub, tone = '' }: { k: string; v: string; sub?: string; tone?: string }) {
  return (
    <div className="stat">
      <div className="stat-k">{k}</div>
      <div className={`stat-v ${tone}`}>{v}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  )
}
