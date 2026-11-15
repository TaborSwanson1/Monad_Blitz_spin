import type { CSSProperties } from 'react'
import { LANE_COLORS, type GameDef } from '../lib/games'

/**
 * Every outcome of a uniform game, with the drawn one highlighted and the player's pick marked.
 * A losing pick dims. All other outcomes look the same, whatever their distance from the
 * result, so nothing reads as "almost".
 */
export function OutcomeStrip({ game, outcome, choice }: { game: GameDef; outcome: number; choice: number }) {
  const won = outcome === choice
  return (
    <div className={`fx-strip ${won ? 'is-won' : 'is-lost'}`}>
      {game.labels.map((label, i) => (
        <span
          key={i}
          className={`fx-opt ${i === outcome ? 'is-result' : ''} ${i === choice ? 'is-pick' : ''}`}
          style={game.id === 2 && i === outcome ? ({ '--opt': LANE_COLORS[i] } as CSSProperties) : undefined}
          title={i === outcome ? 'Result' : i === choice ? 'Your pick' : undefined}
        >
          {label}
        </span>
      ))}
    </div>
  )
}
