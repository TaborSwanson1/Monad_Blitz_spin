// Fixed per-game themes. Players can't change them: each game has one look and one
// set of win and loss effects. Colors live in styles.css under :root[data-theme=...].
//
// Rule from CLAUDE.md: effects follow the REAL net result for the round. A win effect
// only plays when the round is net positive, a loss effect only when it's net negative.
// Both scale with the size of the result, and both are skipped for reduced motion.

import type { RoundRecord } from '../hooks/useCasino'
import { toChips } from './format'
import { motionOff } from '../fx/prefs'

export type ThemeId = 'calm' | 'midnight' | 'monad' | 'americana' | 'vegas' | 'space'
export type WinEffect = 'off' | 'sparks' | 'monad-tokens' | 'americana' | 'vegas'
export type LossEffect = 'off' | 'burning-wallet' | 'americana'

export interface ThemeDef {
  id: ThemeId
  name: string
  win: WinEffect
  loss: LossEffect
}

export const THEMES: Record<ThemeId, ThemeDef> = {
  calm: { id: 'calm', name: 'Calm', win: 'sparks', loss: 'off' },
  midnight: { id: 'midnight', name: 'Midnight', win: 'sparks', loss: 'off' },
  monad: { id: 'monad', name: 'Monad', win: 'monad-tokens', loss: 'burning-wallet' },
  // High energy. Any net win: rockets, Monad tokens, the eagle, the sign and the flags.
  // Small loss: wallet top on fire. Loss with 100+ staked: nuke.
  americana: { id: 'americana', name: 'Americana', win: 'americana', loss: 'americana' },
  // 1970s Strip sign meets 2010 glossy web app: neon on purple, coin fountain on a net
  // win, burning wallet on a net loss. Also the look of the lobby.
  vegas: { id: 'vegas', name: 'Vegas', win: 'vegas', loss: 'burning-wallet' },
  // Crash: deep space. A starfield that speeds up with the live multiplier (fx/SpaceBackdrop),
  // sparks on a net win, burning wallet on a net loss.
  space: { id: 'space', name: 'Space', win: 'sparks', loss: 'burning-wallet' },
}

/** One theme per game id. Games not listed use Calm. */
export const GAME_THEMES: Record<number, ThemeId> = {
  0: 'americana', // High / Low
  1: 'vegas', // Exact Digit
  2: 'vegas', // Block Race
  3: 'space', // Crash
  4: 'vegas', // Beauty Contest
}

/**
 * A round with at least this much STAKED is "big": nuke instead of wallet-top fire on
 * a net loss, and the announcer calls the win on a net win. Based on the bet, not the
 * amount won or lost, since High / Low always pays 1.96x. Chosen by the team on
 * 2026-11-15. Effects still only play on the real net result.
 */
export const BIG_STAKE = toChips('100')

export const themeForGame = (gameId: number): ThemeDef => THEMES[GAME_THEMES[gameId] ?? 'calm']

/** A round can hold bets on several games. Its effects follow the game with the biggest stake. */
export function themeForRound(r: RoundRecord): ThemeDef {
  const byGame = new Map<number, bigint>()
  for (const b of r.bets) byGame.set(b.gameId, (byGame.get(b.gameId) ?? 0n) + b.amount)
  let top = r.bets[0]?.gameId ?? 0
  for (const [g, amt] of byGame) if (amt > (byGame.get(top) ?? 0n)) top = g
  return themeForGame(top)
}

/** True when effects should be still: the system setting, or the player's Motion switch. */
export const prefersReducedMotion = () => motionOff()
