// Volatility scores for the lobby tiles (Zander): how bumpy a game is, 1 (steady) to 10 (wild).
//
// Basis: the standard deviation of one bet's result per 1 staked. Every house game returns 98% on average,
// so this is what tells them apart. Score = round(10 * ln(1 + sd) / ln(11)), so sd 0.3 is about 1 and sd 10 is 10.
//   High / Low      sd 0.96  -> 3        Exact Digit  sd 2.9 -> 6        Block Race  sd 1.7 -> 4
//   Crash           sd 0.34 (1.10x target) to 6.9 (50x target) -> 1 to 9, depends on the target you pick
//   Beauty Contest  sd about 1 (guess 18) to 8.5 (guess 4)     -> 3 to 9, depends on the number you pick
//   Slot            sd about 7.3 (the 1,000x jackpot alone adds about 6) -> 9
// To change one, recompute its sd and update the number here.

export const volatilityScore = (sd: number) => Math.min(10, Math.max(1, Math.round((10 * Math.log(1 + sd)) / Math.log(11))))

/** A game that pays `mult` x the stake with chance `p`, edge already in `mult`. */
export const volatilityOfBet = (p: number, mult: number) => volatilityScore(Math.sqrt(p * mult * mult - (p * mult) ** 2))

export const fmtVolatility = (lo: number, hi = lo) => `Volatility ${lo === hi ? lo : `${lo}–${hi}`}/10`

/** Crash: win chance 0.98/t and pays t at a target of t. */
export const crashVolatility = (targetsX100: readonly number[]) => {
  const v = targetsX100.map((t) => volatilityOfBet(0.98 / (t / 100), t / 100))
  return fmtVolatility(Math.min(...v), Math.max(...v))
}

export const BEAUTY_VOLATILITY = fmtVolatility(3, 9)
export const SLOT_VOLATILITY = fmtVolatility(9)
