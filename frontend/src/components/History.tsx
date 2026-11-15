import type { RoundRecord } from '../hooks/useCasino'
import { resultLabel } from '../lib/outcomes'
import { fmtChips } from '../lib/format'

export function History({ history }: { history: RoundRecord[] }) {
  return (
    <section className="panel history">
      <h3>Your rounds</h3>
      <p className="note">Every round is independent. Past results don't predict the next one.</p>
      {history.length === 0 ? (
        <p className="muted">No settled rounds yet.</p>
      ) : (
        <ul>
          {history.map((r) => (
            <li key={r.roundId.toString()}>
              <span className="muted">R{r.roundId.toString()}</span>
              <span className="results">
                {r.bets.map((b) => resultLabel(b.gameId, b.raw, b.outcome)).join(' · ')}
              </span>
              <span className={r.net > 0n ? 'pos' : r.net < 0n ? 'neg' : ''}>{fmtChips(r.net, { sign: true })}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
