import type { ReactNode } from 'react'
import { gamesFor, type GameDef } from '../lib/games'
import { PRESETS } from '../lib/themes'
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
  gameId: number
  onPick: (id: number) => void
  onEditLimits: () => void
  /** The preset the current theme matches, or null if it's been customized. */
  presetId: string | null
  onPreset: (id: string) => void
  onCustomize: () => void
}

/** Left pane: pick a game, a theme, and get to session controls. On phones it becomes a row of pills. */
export function Sidebar({ mode, gameId, onPick, onEditLimits, presetId, onPreset, onCustomize }: Props) {
  const games = gamesFor(mode)
  const house = games.filter((g) => g.kind !== 'beauty')
  const pvp = games.filter((g) => g.kind === 'beauty')

  const item = (g: GameDef) => (
    <button
      key={g.id}
      className={`nav-item ${g.id === gameId ? 'on' : ''}`}
      aria-current={g.id === gameId ? 'page' : undefined}
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
      </div>
      {pvp.length > 0 && (
        <div className="nav-section">
          <div className="nav-title">Against players</div>
          {pvp.map(item)}
        </div>
      )}
      <div className="nav-section nav-session">
        <div className="nav-title">Theme</div>
        <div className="theme-picker" role="radiogroup" aria-label="Theme preset">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              role="radio"
              aria-checked={p.id === presetId}
              className={`theme-opt ${p.id === presetId ? 'on' : ''}`}
              onClick={() => onPreset(p.id)}
              title={p.describe}
            >
              <span className={`swatch swatch-${p.settings.base}`} aria-hidden />
              {p.name}
            </button>
          ))}
        </div>
        <button className="nav-item" onClick={onCustomize}>
          <IconSliders />
          <span>Customize</span>
          {presetId === null && <span className="nav-tag nav-tag-on">custom</span>}
        </button>
        <div className="nav-title nav-title-gap">Session</div>
        <button className="nav-item" onClick={onEditLimits}>
          <IconShield />
          <span>Limits and check-ins</span>
        </button>
        <p className="nav-note">Play chips only. Every game has a 2% house edge or fee.</p>
      </div>
    </nav>
  )
}
