import type { ReactNode } from 'react'
import { gamesFor, type GameDef } from '../lib/games'
import { IconFlag, IconHash, IconShield, IconSliders, IconTrend, IconUpDown, IconUsers } from './icons'

const GAME_ICONS: Record<string, ReactNode> = {
  'High / Low': <IconUpDown />,
  'Exact Digit': <IconHash />,
  'Block Race': <IconFlag />,
  Crash: <IconTrend />,
  'Beauty Contest': <IconUsers />,
}

interface Props {
  mode: 'sim' | 'chain'
  /** The game on screen. Ignored while the slot is open. */
  gameId: number
  onPick: (id: number) => void
  onEditLimits: () => void
  /** The slot demo is a separate screen, so it gets its own entry (Zander's addition). */
  slot?: { active: boolean; onPick: () => void }
}

/** Left pane: pick a game and get to session controls. On phones it becomes a row of pills. */
export function Sidebar({ mode, gameId, onPick, onEditLimits, slot }: Props) {
  const games = gamesFor(mode)
  const house = games.filter((g) => g.kind !== 'beauty')
  const pvp = games.filter((g) => g.kind === 'beauty')

  const item = (g: GameDef) => (
    <button
      key={g.id}
      className={`nav-item ${g.id === gameId && !slot?.active ? 'on' : ''}`}
      aria-current={g.id === gameId && !slot?.active ? 'page' : undefined}
      onClick={() => onPick(g.id)}
    >
      {GAME_ICONS[g.name] ?? <IconSliders />}
      <span>{g.name}</span>
      {g.simOnly && <span className="nav-tag">sim</span>}
    </button>
  )

  return (
    <nav className="sidebar" aria-label="Games">
      <div className="nav-section">
        <div className="nav-title">Against the house</div>
        {house.map(item)}
        {slot && (
          <button className={`nav-item ${slot.active ? 'on' : ''}`} aria-current={slot.active ? 'page' : undefined} onClick={slot.onPick}>
            <IconSliders />
            <span>Lucky Leprechaun</span>
            <span className="nav-tag">demo</span>
          </button>
        )}
      </div>
      {pvp.length > 0 && (
        <div className="nav-section">
          <div className="nav-title">Against players</div>
          {pvp.map(item)}
        </div>
      )}
      <div className="nav-section nav-session">
        <div className="nav-title">Session</div>
        <button className="nav-item" onClick={onEditLimits}>
          <IconShield />
          <span>Limits and check-ins</span>
        </button>
        <p className="nav-note">Play chips only. Every game has a 2% house edge or fee.</p>
      </div>
    </nav>
  )
}
