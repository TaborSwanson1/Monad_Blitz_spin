// Games 0-2 mirror the UniformGame contracts deployed by backend/script/Deploy.s.sol.
// Game IDs must match the order passed to the BlockCasino constructor.
// Game 3 (Crash) is a proposal that only exists in sim mode. See src/lib/crash.ts.

import { CRASH_TARGETS_X100, crashWinChance, fmtX } from './crash'

export const HOUSE_EDGE_BPS = 200

export type GameKind = 'uniform' | 'crash'

export interface GameDef {
  id: number
  name: string
  short: string
  kind: GameKind
  /** Not on the contract yet. Hidden in chain mode. */
  simOnly?: boolean
  range: number
  outcomes: number
  /** Uniform games only. Crash pays per target, see payoutBpsFor. */
  payoutBps: number
  labels: string[]
  describe: string
}

function game(id: number, name: string, short: string, range: number, labels: string[], describe: string): GameDef {
  return {
    id,
    name,
    short,
    kind: 'uniform',
    range,
    outcomes: labels.length,
    payoutBps: labels.length * (10_000 - HOUSE_EDGE_BPS),
    labels,
    describe,
  }
}

export const CRASH_ID = 3

export const GAMES: GameDef[] = [
  game(0, 'High / Low', 'HI·LO', 100, ['LOW 0–49', 'HIGH 50–99'], 'The result is a number from 0 to 99.'),
  game(1, 'Exact Digit', 'DIGIT', 10, ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'], 'The result is one digit from 0 to 9.'),
  game(2, 'Block Race', 'RACE', 4, ['RED', 'BLUE', 'GREEN', 'GOLD'], 'One of four lanes wins the round.'),
  {
    id: CRASH_ID,
    name: 'Crash',
    short: 'CRASH',
    kind: 'crash',
    simOnly: true,
    range: 0,
    outcomes: CRASH_TARGETS_X100.length,
    payoutBps: 0,
    labels: CRASH_TARGETS_X100.map(fmtX),
    describe:
      'Pick a cash-out target before betting closes. If the crash point reaches your target, you win your stake times the target.',
  },
]

export const LANE_COLORS = ['var(--lane-red)', 'var(--lane-blue)', 'var(--lane-green)', 'var(--lane-gold)']

/** Games the current client can actually play. */
export const gamesFor = (mode: 'sim' | 'chain') => GAMES.filter((g) => mode === 'sim' || !g.simOnly)

export const payoutBpsFor = (g: GameDef, choice: number) =>
  g.kind === 'crash' ? CRASH_TARGETS_X100[choice] * 100 : g.payoutBps

export const multiplierFor = (g: GameDef, choice: number) => payoutBpsFor(g, choice) / 10_000

export const chanceFor = (g: GameDef, choice: number) =>
  g.kind === 'crash' ? crashWinChance(CRASH_TARGETS_X100[choice]) : 1 / g.outcomes
