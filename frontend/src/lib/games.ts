// Mirrors the UniformGame contracts deployed by backend/script/Deploy.s.sol.
// Game IDs must match the order passed to the BlockCasino constructor.

export const HOUSE_EDGE_BPS = 200

export interface GameDef {
  id: number
  name: string
  short: string
  range: number
  outcomes: number
  payoutBps: number
  labels: string[]
  describe: string
}

function game(id: number, name: string, short: string, range: number, labels: string[], describe: string): GameDef {
  return { id, name, short, range, outcomes: labels.length, payoutBps: labels.length * (10_000 - HOUSE_EDGE_BPS), labels, describe }
}

export const GAMES: GameDef[] = [
  game(0, 'High / Low', 'HI·LO', 100, ['LOW 0–49', 'HIGH 50–99'], 'The result is a number from 0 to 99.'),
  game(1, 'Exact Digit', 'DIGIT', 10, ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'], 'The result is one digit from 0 to 9.'),
  game(2, 'Block Race', 'RACE', 4, ['RED', 'BLUE', 'GREEN', 'GOLD'], 'One of four lanes wins the round.'),
]

export const LANE_COLORS = ['var(--lane-red)', 'var(--lane-blue)', 'var(--lane-green)', 'var(--lane-gold)']

export const multiplier = (g: GameDef) => g.payoutBps / 10_000
export const winChance = (g: GameDef) => 1 / g.outcomes
