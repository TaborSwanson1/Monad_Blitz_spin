import { fmtChips, fmtDuration } from '../lib/format'
import type { Limits } from '../hooks/useSession'
import { IconArrowDown, IconArrowUp } from './icons'

interface Props {
  elapsedMs: number
  net: bigint
  staked: bigint
  rounds: number
  limits: Limits
}

/** Open row of session numbers: label on top, value below, no boxes. */
export function SessionBar({ elapsedMs, net, staked, rounds, limits }: Props) {
  const tone = net > 0n ? 'pos' : net < 0n ? 'neg' : ''
  // Net as a share of what was bet, shown like a dashboard trend.
  const pct = staked > 0n ? Number((net * 10_000n) / staked) / 100 : null

  return (
    <div className="stat-row">
      <Stat label="Session" value={fmtDuration(elapsedMs)} sub={limits.timeMin ? `of ${limits.timeMin} min` : undefined} />
      <Stat
        label="Net result"
        value={fmtChips(net, { sign: true })}
        tone={tone}
        badge={
          pct !== null && pct !== 0 ? (
            <span className={`badge ${pct > 0 ? 'badge-pos' : 'badge-neg'}`}>
              {pct > 0 ? <IconArrowUp /> : <IconArrowDown />}
              {Math.abs(pct).toFixed(1)}%
            </span>
          ) : undefined
        }
      />
      <Stat label="Wagered" value={fmtChips(staked)} />
      <Stat label="Rounds" value={String(rounds)} />
      <Stat label="Loss limit" value={limits.lossChips ? String(limits.lossChips) : 'Off'} />
    </div>
  )
}

function Stat({
  label,
  value,
  sub,
  tone = '',
  badge,
}: {
  label: string
  value: string
  sub?: string
  tone?: string
  badge?: React.ReactNode
}) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-line">
        <span className={`stat-value ${tone}`} style={{ '--len': value.length } as React.CSSProperties}>
          {value}
        </span>
        {sub && <span className="stat-sub">{sub}</span>}
        {badge}
      </div>
    </div>
  )
}
