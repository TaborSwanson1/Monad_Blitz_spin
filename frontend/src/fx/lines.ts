// The loud line on the result popup. Everything here is true.
//
// CLAUDE.md, honest UI: no near-miss framing outside the Slot demo. So a loss never
// says "almost", "so close" or "one more", and nothing here hints that the next round
// is more likely to win. Loss lines are jokes about what just happened, and the footer
// under them says the one thing that IS true about the next round: same odds as ever.
// If the team wants near-miss lines on these games, that needs a new Decision first,
// like the one for the slot.

import type { ThemeId } from '../lib/themes'

const WIN: Partial<Record<ThemeId, string[]>> = {
  americana: ['Liberty pays!', 'Stars, stripes and chips!', 'Land of the free chips!', 'The eagle has landed!'],
  vegas: ['Cha-ching!', 'Winner winner!', 'The house blinked!', 'Paid in full!'],
}

const LOSS: Partial<Record<ThemeId, string[]>> = {
  americana: ['The house takes this one.', 'Freedom isn’t free.', 'Taxed without representation.', 'Tough break, patriot.'],
  vegas: ['The house takes this one.', 'Ouch. That stung.', 'What happens in Vegas…', 'The neon giveth, the neon taketh.'],
}

const pick = (list: string[] | undefined, seed: string) => (list?.length ? list[parseInt(seed.slice(2, 8), 16) % list.length] : null)

/** A headline for the result. Picked from the round seed, so one round always shows the same line. */
export function resultLine(theme: ThemeId, net: bigint, seed: string): string | null {
  if (net > 0n) return pick(WIN[theme], seed)
  if (net < 0n) return pick(LOSS[theme], seed)
  return null
}

/** Shown under every loss on the loud themes. The honest counterpart of "you're due". */
export const SAME_ODDS = 'Every round is independent. Past results don’t change the next one, and the house’s 2% cut is always there.'
