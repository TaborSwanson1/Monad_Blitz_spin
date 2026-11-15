// Fixed per-game themes. Players can't change them: each game has one look and one
// set of win and loss effects. Colors live in styles.css under :root[data-theme=...].
//
// Rule from CLAUDE.md: effects follow the REAL net result for the round. A win effect
// only plays when the round is net positive, a loss effect only when it's net negative.
// Both scale with the size of the result, and both are skipped for reduced motion.

import type { RoundRecord } from '../hooks/useCasino'
import { toChips } from './format'

export type ThemeId = 'calm' | 'midnight' | 'monad' | 'americana'
export type WinEffect = 'off' | 'sparks' | 'monad-tokens' | 'americana'
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
  // High energy. Small win: fireworks. Big win: bald eagle. Small loss: wallet top on
  // fire. Big loss: nuke.
  americana: { id: 'americana', name: 'Americana', win: 'americana', loss: 'americana' },
}

/** One theme per game id. Games not listed use Calm until they get their own. */
export const GAME_THEMES: Record<number, ThemeId> = {
  0: 'americana', // High / Low
}

/**
 * A round with at least this much STAKED is "big": eagle instead of fireworks on a net
 * win, nuke instead of wallet-top fire on a net loss. Based on the bet, not the amount
 * won or lost, since High / Low always pays 1.96x. Chosen by the team on 2026-11-15.
 * The effect still only plays on the real net result: a big stake that nets a win
 * gets the eagle, one that nets a loss gets the nuke.
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

export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
