import { useMemo, useState } from 'react'
import { CRASH_TARGETS_X100, fmtX } from '../../lib/crash'
import { gamesFor, type GameDef } from '../../lib/games'
import { BEAUTY_VOLATILITY, crashVolatility, fmtVolatility, volatilityOfBet } from '../../lib/volatility'
import { GameArt, type ArtId } from './GameArt'
import './lobby.css'

// The lobby: every game as a tile, with filters and search, laid out like the big
// casino sites (a category row, search as you type, tiles with a favorite star and an
// info button). What it leaves out on purpose: fake "live wins" feeds, bonus countdowns
// and anything that pushes play. Owner: Zander.

export interface Tile {
  key: string
  name: string
  art: ArtId
  category: 'house' | 'players'
  /** Odds in one line, shown before anyone opens the game (CLAUDE.md honest UI). */
  odds: string
  /** Corner badge: volatility score, see lib/volatility.ts. */
  rtp: string
  describe: string
  tag?: string
  /** Missing: the tile is shown as "in design" and can't be opened. */
  play?: () => void
}

type Filter = 'all' | 'house' | 'players' | 'favorites'

const ART_FOR: Record<string, ArtId> = {
  'High / Low': 'highlow',
  'Exact Digit': 'digit',
  'Block Race': 'race',
  Crash: 'crash',
  'Beauty Contest': 'beauty',
}

function tileFor(g: GameDef, onPlay: (id: number) => void, mode: 'sim' | 'chain'): Tile {
  const base = { key: `game-${g.id}`, name: g.name, art: ART_FOR[g.name] ?? 'digit', describe: g.describe, tag: g.simOnly && mode === 'sim' ? 'sim' : undefined, play: () => onPlay(g.id) }
  if (g.kind === 'crash') {
    const lo = CRASH_TARGETS_X100[0]
    const hi = CRASH_TARGETS_X100[CRASH_TARGETS_X100.length - 1]
    return { ...base, category: 'house', odds: `Cash-out targets ${fmtX(lo)} to ${fmtX(hi)}`, rtp: crashVolatility(CRASH_TARGETS_X100) }
  }
  if (g.kind === 'beauty') return { ...base, category: 'players', odds: 'Closest to ⅔ of the average wins', rtp: BEAUTY_VOLATILITY }
  const chance = Math.round(100 / g.outcomes)
  const mult = (g.payoutBps / 10_000).toFixed(2)
  return { ...base, category: 'house', odds: `${chance}% win chance · pays ${mult}×`, rtp: fmtVolatility(volatilityOfBet(1 / g.outcomes, g.payoutBps / 10_000)) }
}

const FAV_KEY = 'block-casino.favorites'
function readFavs(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(FAV_KEY) ?? '[]') as string[])
  } catch {
    return new Set()
  }
}

interface Props {
  mode: 'sim' | 'chain'
  onPlay: (gameId: number) => void
  /** Extra playable tiles that aren't round-based casino games (for example the slot demo). */
  extra?: Tile[]
  onLimits: () => void
  /** Chain mode: how many games the contract has (gameCount). */
  chainGameCount?: number
}

export function Lobby({ mode, onPlay, extra = [], onLimits, chainGameCount }: Props) {
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [favs, setFavs] = useState(readFavs)
  const [info, setInfo] = useState<string | null>(null)

  const tiles = useMemo<Tile[]>(
    () => [...gamesFor(mode, chainGameCount).map((g) => tileFor(g, onPlay, mode)), ...extra],
    [mode, onPlay, extra, chainGameCount],
  )

  const toggleFav = (key: string) => {
    setFavs((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      try {
        localStorage.setItem(FAV_KEY, JSON.stringify([...next]))
      } catch {
        /* storage blocked: favorites last for this visit only */
      }
      return next
    })
  }

  const q = query.trim().toLowerCase()
  const shown = tiles.filter(
    (t) =>
      (filter === 'all' || (filter === 'favorites' ? favs.has(t.key) : t.category === filter)) &&
      (!q || t.name.toLowerCase().includes(q) || t.describe.toLowerCase().includes(q)),
  )

  const FILTERS: { id: Filter; label: string; count: number }[] = [
    { id: 'all', label: 'All games', count: tiles.length },
    { id: 'players', label: 'Multiplayer', count: tiles.filter((t) => t.category === 'players').length },
    { id: 'favorites', label: 'Favorites', count: tiles.filter((t) => favs.has(t.key)).length },
  ]

  const card = (t: Tile) => (
    <article key={t.key} className={`tile tile-${t.art} ${t.play ? '' : 'tile-soon'}`}>
      <button className="tile-art" onClick={t.play} disabled={!t.play} aria-label={t.play ? `Play ${t.name}` : `${t.name}, in design`}>
        <GameArt id={t.art} />
        {t.tag && <span className="tile-tag">{t.tag}</span>}
        <span className="tile-rtp" title="How bumpy the results are: 1 is steady, 10 is wild. Every house game still returns 98% on average.">{t.rtp}</span>
        {t.play ? <span className="tile-play">Play</span> : <span className="tile-play tile-play-soon">In design</span>}
        {info === t.key && (
          <span className="tile-info-panel" onClick={(e) => e.stopPropagation()}>
            <strong>{t.name}</strong>
            <span>{t.describe}</span>
            <span className="muted">{t.odds}</span>
          </span>
        )}
      </button>
      <div className="tile-meta">
        <div className="tile-name">
          <span>{t.name}</span>
          <button className="tile-icon" onClick={() => setInfo(info === t.key ? null : t.key)} aria-label={`About ${t.name}`} aria-pressed={info === t.key}>
            i
          </button>
          {t.play && (
            <button
              className={`tile-icon tile-fav ${favs.has(t.key) ? 'on' : ''}`}
              onClick={() => toggleFav(t.key)}
              aria-label={favs.has(t.key) ? `Remove ${t.name} from favorites` : `Add ${t.name} to favorites`}
              aria-pressed={favs.has(t.key)}
            >
              ★
            </button>
          )}
        </div>
        <div className="tile-odds">{t.odds}</div>
      </div>
    </article>
  )

  return (
    <main className="lobby">
      <section className="hero">
        <div className="hero-copy">
          <span className="badge badge-primary">Provably fair</span>
          <h1>STIM and SPIN</h1>
          <p>
            Games that settle on Monad. Every result comes from a public random seed you can check yourself, never from
            block data. Play chips only, free from the faucet, with no real value.
          </p>
          <div className="hero-facts">
            <span>
              <strong>2%</strong> house edge on every house game
            </span>
            <span>
              <strong>≈18 s</strong> rounds
            </span>
            <span>
              <strong>{mode === 'sim' ? 'Simulator' : 'On-chain'}</strong> mode
            </span>
          </div>
        </div>
        <div className="hero-art" aria-hidden>
          <GameArt id="crash" />
        </div>
      </section>

      <div className="lobby-bar">
        <div className="chips" role="tablist" aria-label="Game categories">
          {FILTERS.map((f) => (
            <button key={f.id} role="tab" aria-selected={filter === f.id} className={`chip ${filter === f.id ? 'on' : ''}`} onClick={() => setFilter(f.id)}>
              {f.label} <span className="chip-count">{f.count}</span>
            </button>
          ))}
        </div>
        <label className="search">
          <svg className="icon" width="15" height="15" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search games" aria-label="Search games" />
        </label>
      </div>

      {shown.length > 0 ? (
        <div className="tile-grid">{shown.map(card)}</div>
      ) : (
        <p className="muted lobby-empty">{filter === 'favorites' && !q ? 'No favorites yet. Tap ★ on a game to add it.' : 'No games match.'}</p>
      )}

      <footer className="lobby-foot">
        <p>
          Play chips only, with no real value. Odds and the house edge are shown on every game before you bet. Past rounds
          don't predict future ones.
        </p>
        <button className="btn small" onClick={onLimits}>
          Limits and check-ins
        </button>
      </footer>
    </main>
  )
}
