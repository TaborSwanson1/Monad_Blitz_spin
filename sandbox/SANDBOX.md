# Mechanics sandbox

A place to try game mechanics before anyone writes a contract or a screen. This file is both the input and the output:

1. Write or edit a ```` ```js experiment ```` block under **Experiments**.
2. Run `cd sandbox && npm install && npm run sandbox` (add `-- --rounds 50000` for tighter numbers).
3. Results appear under each block, and the frontend and parity sections are refreshed.

The run also pulls the **live game models from `frontend/src/lib/`** and the backend toolkit from `backend/sdk/seedlib.mjs` (both read only), so every run checks Tabor's and Lucas's current math too. For charts and interactive work, open `mechanics.ipynb`. It uses the same engine. It's deterministic: the same file gives the same numbers. Nothing here touches a chain or the frontend. It exits with an error if parity fails or an experiment breaks, so it can gate a commit.

<!-- generated:stamp -->
_Last run: 2026-11-15 21:10 UTC, commit `65451cc`, 10,000 rounds, in 38.4 s._
<!-- /generated:stamp -->

## How to write an experiment

An experiment is a JavaScript object literal:

```js
({
  name: 'Short name',
  choices: ['what a player can pick', '...'],   // optional, defaults to one choice
  rounds: 10000,                                  // optional
  gameId: 200,                                    // optional, any unused ID
  expectedReturn: 0.98,                           // optional; null for player-vs-player games
  play(seed, choice, t) {
    // seed: this game's seed for one round (bytes32), already gameSeed(roundSeed, gameId)
    // return the payout multiplier: 0 = stake lost, 1.96 = paid 1.96x
  },
})
```

When the round is costly to compute or has many choices, split `play` into two parts, the way a contract does. `resolve` runs once per round, and `pays` is called for each choice:

```js
({
  name: 'Short name',
  choices: ['a', 'b'],
  resolve(seed, t) { /* return the round's outcome, any value */ },
  pays(outcome, choice) { /* return the payout multiplier for this choice */ },
})
```

`t` is the backend toolkit, the same math as `backend/contracts/lib/SeedLib.sol` (see `backend/docs/MECHANICS.md`):

| Call | Gives |
|---|---|
| `t.draw(seed, i)` | the i-th independent 256-bit number (bigint) |
| `t.uniform(seed, i, n)` | a bigint in `[0, n)` |
| `t.chance(seed, i, bps)` | true with probability `bps / 10,000` |
| `t.weighted(seed, i, [w0, w1, ...])` | index k with probability `wk / sum` |
| `t.coin(seed)` | fair true/false from the seed's main number |
| `t.crashX100(seed)` | crash point in hundredths (bigint, at least 100n) |
| `t.subSeed(seed, k)` | a bytes32 sub-seed, to feed `coin` or `crashX100` |
| `t.unit(seed, k)` | a float in `[0, 1)`. Prototypes only: contracts use integers |

Rules from CLAUDE.md that apply here too: randomness only from the seed (never block data), a 2% edge on house games, and odds that can be shown honestly before a bet.

## Parity: frontend vs backend

<!-- generated:parity -->
500 seeds each. The backend side is `backend/sdk/seedlib.mjs`, which `backend/test/SeedVectors.t.sol` pins to the Solidity contracts, so a match here means the UI agrees with the chain.

| Check | Result |
|---|---|
| gameSeed for every game ID | ✓ match |
| High / Low: outcome (UniformGame bucket math) | ✓ match |
| Exact Digit: outcome (UniformGame bucket math) | ✓ match |
| Block Race: outcome (UniformGame bucket math) | ✓ match |
| Crash: crashPointX100 vs SeedLib.crashX100 | ✓ match |
| Payouts: payoutBpsFor vs numOutcomes × 9,800 (uniform) and target × 100 (Crash) | ✓ match |

Beauty Contest bot guesses are sim-only and have no backend copy, so they are not checked here.

<!-- /generated:parity -->

## Frontend games

<!-- generated:frontend -->
Pulled from `frontend/src/lib/`: `games.ts`, `outcomes.ts`, `crash.ts`, `beauty.ts`. Each choice is played on the same seeds with `resolveBet`, the function the UI uses.

"Return" is chips back per chip staked, with a 95% interval. Every house game must return 0.98 (a 2% edge).

### 0. High / Low (on the contract)

10,000 rounds per choice.

| Choice | Claimed chance | Claimed payout | Simulated win rate | Return | Edge check |
|---|---|---|---|---|---|
| LOW 0–49 | 50.0% | 1.96x | 49.5% | 0.970 ± 0.019 | ✓ |
| HIGH 50–99 | 50.0% | 1.96x | 50.5% | 0.990 ± 0.019 | ✓ |

### 1. Exact Digit (on the contract)

10,000 rounds per choice.

| Choice | Claimed chance | Claimed payout | Simulated win rate | Return | Edge check |
|---|---|---|---|---|---|
| 0 | 10.0% | 9.80x | 9.5% | 0.931 ± 0.056 | ✓ |
| 1 | 10.0% | 9.80x | 9.6% | 0.943 ± 0.057 | ✓ |
| 2 | 10.0% | 9.80x | 10.2% | 0.997 ± 0.058 | ✓ |
| 3 | 10.0% | 9.80x | 10.3% | 1.004 ± 0.058 | ✓ |
| 4 | 10.0% | 9.80x | 10.0% | 0.976 ± 0.058 | ✓ |
| 5 | 10.0% | 9.80x | 10.1% | 0.993 ± 0.058 | ✓ |
| 6 | 10.0% | 9.80x | 10.0% | 0.983 ± 0.058 | ✓ |
| 7 | 10.0% | 9.80x | 10.5% | 1.027 ± 0.059 | ✓ |
| 8 | 10.0% | 9.80x | 9.8% | 0.960 ± 0.057 | ✓ |
| 9 | 10.0% | 9.80x | 10.1% | 0.986 ± 0.058 | ✓ |

### 2. Block Race (on the contract)

10,000 rounds per choice.

| Choice | Claimed chance | Claimed payout | Simulated win rate | Return | Edge check |
|---|---|---|---|---|---|
| RED | 25.0% | 3.92x | 24.6% | 0.965 ± 0.033 | ✓ |
| BLUE | 25.0% | 3.92x | 25.0% | 0.979 ± 0.033 | ✓ |
| GREEN | 25.0% | 3.92x | 25.0% | 0.979 ± 0.033 | ✓ |
| GOLD | 25.0% | 3.92x | 25.4% | 0.997 ± 0.033 | ✓ |

### 3. Crash (sim mode only)

10,000 rounds per choice.

| Choice | Claimed chance | Claimed payout | Simulated win rate | Return | Edge check |
|---|---|---|---|---|---|
| 1.10× | 89.1% | 1.10x | 89.2% | 0.981 ± 0.007 | ✓ |
| 1.25× | 78.4% | 1.25x | 78.0% | 0.975 ± 0.010 | ✓ |
| 1.50× | 65.3% | 1.50x | 64.6% | 0.969 ± 0.014 | ✓ |
| 2.00× | 49.0% | 2.00x | 48.2% | 0.963 ± 0.020 | ✓ |
| 3.00× | 32.7% | 3.00x | 32.3% | 0.969 ± 0.027 | ✓ |
| 5.00× | 19.6% | 5.00x | 19.1% | 0.958 ± 0.039 | ✓ |
| 10.00× | 9.8% | 10.00x | 9.5% | 0.948 ± 0.057 | ✓ |
| 20.00× | 4.9% | 20.00x | 4.9% | 0.978 ± 0.085 | ✓ |
| 50.00× | 2.0% | 50.00x | 2.1% | 1.045 ± 0.140 | ✓ |

### 4. Beauty Contest (sim mode only)

Against the sim-mode bots (4–9 per round), 3,000 rounds per guess. Not a house game: the pot is split between players, so the return depends on how you play against them. A return above 1.00 means a fixed strategy beats the bots.

| Your guess | Win rate (incl. ties) | Return per entry | Note |
|---|---|---|---|
| 0 | 0.0% | 0.000 ± 0.000 |  |
| 5 | 2.8% | 0.126 ± 0.028 |  |
| 10 | 23.6% | 1.416 ± 0.097 | ⚠ beats the bots |
| 15 | 46.4% | 3.184 ± 0.130 | ⚠ beats the bots |
| 18 | 50.6% | 3.421 ± 0.131 | ⚠ beats the bots |
| 22 | 34.7% | 2.153 ± 0.115 | ⚠ beats the bots |
| 27 | 12.8% | 0.784 ± 0.077 |  |
| 33 | 3.4% | 0.185 ± 0.038 |  |
| 50 | 0.1% | 0.008 ± 0.008 |  |
| 67 | 0.0% | 0.000 ± 0.000 |  |
| 100 | 0.0% | 0.000 ± 0.000 |  |

Best fixed guess here: **18** (return 3.421).

<!-- /generated:frontend -->

## Experiments

Starter experiments. Edit them, delete them, or add your own below.

### Prize wheel

Unequal slices with `weighted`. Payouts are tuned so the return is exactly 0.98: 0.25 × 1.6 + 0.15 × 2.4 + 0.05 × 4.4 = 0.98.

```js experiment
({
  name: 'Prize wheel',
  play(seed, choice, t) {
    const slices = [
      { weight: 55, pays: 0 },
      { weight: 25, pays: 1.6 },
      { weight: 15, pays: 2.4 },
      { weight: 5, pays: 4.4 },
    ]
    return slices[t.weighted(seed, 0, slices.map((s) => s.weight))].pays
  },
})
```

<!-- result -->
**Prize wheel**: 10,000 rounds per choice, game ID 200.

| Choice | Paid | Profit | Return | Max | Check vs 0.98 |
|---|---|---|---|---|---|
| bet | 45.3% | 45.3% | 0.986 ± 0.024 | 4.40x | ✓ |
<!-- /result -->

### Block Walk, end side only

21 up/down steps, then bet on which side of 0 it ends. Every step is fixed at lock here, which is fine for this bet. The real Block Walk lets players trade between steps, so each step there needs its own unrevealed seed (see `backend/docs/MECHANICS.md`).

```js experiment
({
  name: 'Block Walk end side',
  choices: ['ends above 0', 'ends below 0'],
  resolve(seed, t) {
    let x = 0
    for (let k = 0; k < 21; k++) x += t.coin(t.subSeed(seed, k)) ? 1 : -1
    return x // final position, never 0 with 21 steps
  },
  pays(x, choice) {
    return (choice === 0) === x > 0 ? 1.96 : 0
  },
})
```

<!-- result -->
**Block Walk end side**: 10,000 rounds per choice, game ID 200.

| Choice | Paid | Profit | Return | Max | Check vs 0.98 |
|---|---|---|---|---|---|
| ends above 0 | 50.9% | 50.9% | 0.997 ± 0.019 | 1.96x | ✓ |
| ends below 0 | 49.1% | 49.1% | 0.963 ± 0.019 | 1.96x | ✓ |
<!-- /result -->

### Multi-block race (an example that's broken on purpose)

Four lanes move 0–3 squares each block, and the first past 30 wins. When lanes tie at the finish, the lowest lane wins, so lane 4 loses every tie and wins less often than the others. An equal 3.92x payout isn't fair then, and the ⚠ in the results is what this example is meant to show. Fix it by breaking ties with another draw, for example `t.uniform(seed, 1000 + block, tied.length)`, and run again.

```js experiment
({
  name: 'Multi-block race',
  choices: ['lane 1', 'lane 2', 'lane 3', 'lane 4'],
  rounds: 20000,
  resolve(seed, t) {
    const pos = [0, 0, 0, 0]
    for (let block = 0; ; block++) {
      for (let lane = 0; lane < 4; lane++) pos[lane] += Number(t.uniform(seed, block * 4 + lane, 4n))
      const best = Math.max(...pos)
      if (best >= 30) return pos.indexOf(best) // lowest lane wins ties: this is the bug
    }
  },
  pays(winner, choice) {
    return winner === choice ? 3.92 : 0
  },
})
```

<!-- result -->
**Multi-block race**: 20,000 rounds per choice, game ID 200.

| Choice | Paid | Profit | Return | Max | Check vs 0.98 |
|---|---|---|---|---|---|
| lane 1 | 25.9% | 25.9% | 1.016 ± 0.024 | 3.92x | ✓ |
| lane 2 | 25.8% | 25.8% | 1.010 ± 0.024 | 3.92x | ✓ |
| lane 3 | 24.8% | 24.8% | 0.971 ± 0.023 | 3.92x | ✓ |
| lane 4 | 23.5% | 23.5% | 0.922 ± 0.023 | 3.92x | ⚠ pays less than 0.98 |
<!-- /result -->

### Slot: cascades, free spins and a jackpot (Zander)

A high-variance house game with an honest return. The model and how it was tuned:

- **Reels:** 3 reels, one payline (the middle row). Each symbol is `t.weighted` over the same weights on every reel: blank 10, cherry 38, bell 16, bar 11, seven 7, wild 10, diamond 3, star 5 (out of 100).
- **Paytable (three of a kind on the line):** cherries 2x, bells 8x, bars 12x, sevens 30x, three wilds 50x. A wild stands in for cherry, bell, bar and seven. The smallest win is 2x, so every win is a real gain.
- **Jackpot:** three diamonds pay **1,000x**, flat (no multiplier). About 1 spin in 28,000.
- **Cascades:** a win clears the line, the symbols above fall in, and the line is paid again at 2x, 3x and so on, up to 8 lines. The top row shown on screen *is* what falls in next.
- **Free spins:** 3 or more stars anywhere on the opening 3×3 grid give 8 free spins with double cascade multipliers (2x, 4x, 6x...). About 1 spin in 120. Free spins don't retrigger.
- **Exact return: 0.97993** (house edge 2.007%), computed with exact fractions over every symbol combination: base game 0.866, free spins 0.114. A 2,000,000-spin simulation of this block gave 0.984 ± 0.006 (0.7 standard errors away). Per spin: 14.5% win, 1.9% cascade. Standard deviation per spin is about 7.8x, so at 50,000 rounds the sandbox's own interval is about ±0.07. Trust the exact figure for the edge.
- **Randomness:** everything comes from the game seed with fixed draw indices (line `k` on reel `r` is `3k + r`, bottom row `900 + r`, free spin `s` starts at `1000 + 100s`). Every cascade and free spin is fixed when betting locks and only shown step by step, which `backend/docs/MECHANICS.md` says is safe.
- **Contract fit:** the payout depends on the symbols, not on a player's choice, so it doesn't fit `IGame.payoutBps()`. It needs a game interface shaped like `payout(seed, choice)`. Worst case on-chain is 8 + 8×8 = 72 line checks per bet.

```js experiment
({
  name: 'Slot',
  rounds: 50000,
  gameId: 205,
  resolve(seed, t) {
    // Symbols: 0 blank, 1 cherry, 2 bell, 3 bar, 4 seven, 5 wild, 6 diamond, 7 star
    const WEIGHTS = [10, 38, 16, 11, 7, 10, 3, 5] // per reel, out of 100
    const PAY = [0, 2, 8, 12, 30]                 // three of a kind; wild stands in for 1-4
    const WILD_PAY = 50, JACKPOT = 1000           // three wilds; three diamonds (flat, no multiplier)
    const FREE_SPINS = 8, FREE_MULT = 2, MAX_LINES = 8, SCATTERS = 3

    const sym = (i) => t.weighted(seed, i, WEIGHTS)
    const lineWin = (l) => {
      if (l.every((s) => s === 6)) return { jackpot: true, pay: JACKPOT }
      if (l.every((s) => s === 5)) return { pay: WILD_PAY }
      let best = 0
      for (let x = 1; x <= 4; x++) if (l.every((s) => s === x || s === 5)) best = Math.max(best, PAY[x])
      return best ? { pay: best } : null
    }
    // One spin: line k (0-based) on reel r is draw index base + 3k + r. A win clears
    // all three symbols, the ones above fall in, and the multiplier steps up 1x, 2x, 3x...
    const spin = (base, mult) => {
      let pay = 0, lines = 0, jackpot = false
      for (let k = 0; k < MAX_LINES; k++) {
        const w = lineWin([0, 1, 2].map((r) => sym(base + 3 * k + r)))
        if (!w) break
        lines++
        if (w.jackpot) jackpot = true
        pay += w.jackpot ? w.pay : w.pay * mult * (k + 1)
      }
      return { pay, cascades: Math.max(0, lines - 1), jackpot }
    }

    const main = spin(0, 1)
    // Opening grid: middle row = line 0, top row = line 1 (what falls in next), bottom = its own draws.
    let stars = 0
    for (let r = 0; r < 3; r++) for (const i of [r, 3 + r, 900 + r]) if (sym(i) === 7) stars++
    let freePay = 0, jackpot = main.jackpot
    if (stars >= SCATTERS) {
      for (let s = 0; s < FREE_SPINS; s++) {
        const f = spin(1000 + 100 * s, FREE_MULT)
        freePay += f.pay
        jackpot ||= f.jackpot
      }
    }
    return { total: main.pay + freePay, basePay: main.pay, freePay, freeSpins: stars >= SCATTERS, cascades: main.cascades, jackpot }
  },
  pays(o) {
    return o.total
  },
})
```
