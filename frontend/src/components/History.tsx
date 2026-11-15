import type { RoundRecord } from '../hooks/useCasino'
import { resultLabel } from '../lib/outcomes'
import { fmtChips } from '../lib/format'

/** Bar list: the faint bar behind each row shows the size of that round's result. */
export function History({ history }: { history: RoundRecord[] }) {
  const max = history.reduce((m, r) => {
    const a = r.net < 0n ? -r.net : r.net
    return a > m ? a : m
  }, 0n)

  return (
    <section className="panel-section history">
      <div className="section-head">
        <h3>Your rounds</h3>
        <span className="muted small">Net</span>
      </div>
      <p className="note">Every round is independent. Past results don't predict the next one.</p>
      {history.length === 0 ? (
        <p className="muted small">No settled rounds yet.</p>
      ) : (
        <ul className="bar-list">
          {history.map((r) => {
            const a = r.net < 0n ? -r.net : r.net
            const w = max > 0n ? Math.max(6, Number((a * 100n) / max)) : 0
            const tone = r.net > 0n ? 'pos' : r.net < 0n ? 'neg' : ''
            return (
              <li key={r.roundId.toString()}>
                <div className={`bar ${tone}`} style={{ width: `${w}%` }} aria-hidden />
                <span className="bar-label">
                  <span className="muted">R{r.roundId.toString()}</span>{' '}
                  {r.bets.map((b) => resultLabel(b.gameId, b.raw, b.outcome)).join(' · ')}
                </span>
                <span className={`bar-value ${tone}`}>{fmtChips(r.net, { sign: true })}</span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
