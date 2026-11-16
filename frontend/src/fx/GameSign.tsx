import { CRASH_TARGETS_X100, fmtX } from '../lib/crash'
import { HOUSE_EDGE_BPS, multiplierFor, type GameDef } from '../lib/games'
import type { ThemeId } from '../lib/themes'
import { Marquee } from './Marquee'

// The huge sign at the top of each game: the game's name in lights, and under it the
// odds in plain numbers. The biggest type on the page is also the honest part.
// It tilts a little toward the cursor (see --mx / --my in Backdrop).

const edge = `${HOUSE_EDGE_BPS / 100}%`

function oddsLine(g: GameDef): string {
  if (g.kind === 'crash') {
    const t = CRASH_TARGETS_X100
    return `Cash out any time · auto targets ${fmtX(t[0])} to ${fmtX(t[t.length - 1])} · ${edge} house edge at every point`
  }
  if (g.kind === 'beauty') return `Closest to two-thirds of the average wins · ${edge} house edge at every number`
  return `Pays ${multiplierFor(g, 0)}× · wins 1 time in ${g.outcomes} · ${edge} house edge`
}

export function GameSign({ game, theme }: { game: GameDef; theme: ThemeId }) {
  const americana = theme === 'americana'
  const tone = americana ? 'plaque' : theme === 'space' ? 'space' : 'neon'
  return (
    <Marquee tone={tone} spotlights={americana} className={`game-sign ${tone === 'space' ? 'game-sign-small' : ''}`}>
      <span className="gs-sticker" aria-hidden>
        Play
        <br />
        money
      </span>
      <span className="gs-kicker">Now playing</span>
      <span className="gs-name">{game.name}</span>
      <span className="gs-odds">{oddsLine(game)}</span>
    </Marquee>
  )
}
