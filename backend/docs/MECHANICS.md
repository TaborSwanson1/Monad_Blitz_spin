# Mechanics: how randomness gets from Monad to a game result

For anyone designing a game. Read this before you design anything that needs a random result.

## The pipeline

```
  Monad blocks (≈0.3 s each)            the CLOCK, never the randomness
  ─────────────────────────────────────────────────────────────────────────────
  round r:  start = genesis + r·60     betting open for 40 blocks (≈12 s)
            lock  = start + 40         placeBet reverts from here on
                                       anyone calls requestSettlement(r), paying the Pyth fee
                                         │
  Pyth Entropy (VRF)                     ▼
  ─────────────────────────────────────────────────────────────────────────────
            requestV2() ─► provider reveals ≈2 blocks later ─► callback
                                         │
                                         ▼
  roundSeed (bytes32)      ONE verifiable random number per round, stored on-chain
            │
            ├─ gameSeed = keccak256(abi.encode(roundSeed, gameId))   independent per game
            │      │
            │      ├─ uint256(gameSeed)             the game's main number
            │      └─ SeedLib.draw(gameSeed, i)     extra numbers, if a game needs several
            ▼
  IGame.outcome(gameSeed) ─► winning outcome ─► claim pays amount × payoutBps / 10 000
```

Code: `contracts/lib/SeedLib.sol` (derivation), `contracts/BlockCasino.sol` (clock, settlement, claims), `contracts/randomness/PythEntropyAdapter.sol` (Pyth), `contracts/games/UniformGame.sol` (current games).

## Why it's fair

- **Nobody knows the number while bets are open.** It's requested only after the lock block, and the contract rejects late bets.
- **Nobody can steer it.** Pyth's provider commits to its randomness in advance and combines it with the request, and the result comes with a proof. Neither we, the player, nor the Monad block producer can choose it.
- **Anyone can check it.** The round seed is public on-chain (`rounds(r).seed`, `RoundSettled` event), and every step after it is a pure function. `gameResult(r, gameId)` recomputes any result.
- **Games don't move together.** Each game hashes the seed with its own ID, so High/Low and Exact Digit in the same round are unrelated.

## Verified testnet facts (2026-11-15)

| | |
|---|---|
| Chain ID | 10143 |
| Block time | ≈0.3 s (measured over 1,000 blocks) |
| Pyth Entropy | `0x825c0390f379c631f3cf11a82a37d20bddf93c07` |
| Reveal delay | 2 blocks |
| Fee per request | ≈0.124 MON (read the live value with `adapter.fee()`; it moves with gas price) |

One request settles **every bet in the round across all games**. Rounds with no bets are never requested.

## The seed toolkit

Every game turns its `gameSeed` into results with these functions, and nothing else. They exist in two copies that give identical answers:

- `contracts/lib/SeedLib.sol` (on-chain, used by the games)
- `sdk/seedlib.mjs` (JavaScript, for scripts, simulations and the frontend)

| Function | Gives | Used for |
|---|---|---|
| `gameSeed(roundSeed, gameId)` | an independent seed per game | every game |
| `draw(seed, i)` | the i-th independent 256-bit number | several numbers per round: per lane, per step, per player |
| `uniform(seed, i, n)` | a number in `[0, n)` | dice, digits, lanes |
| `chance(seed, i, bps)` | true with probability `bps / 10,000` | yes/no events ("25% chance of a bonus") |
| `weighted(seed, i, weights)` | index `k` with probability `weights[k] / sum` | unequal outcomes, such as a wheel with big and small slices |
| `coin(seed)` | a fair true/false from the main number | Block Walk steps (up or down) |
| `crashX100(seed)` | crash point in hundredths, at least 100 | Crash. `P(≥ T) = 98 / T`, a 2% edge at every target |

Conventions:

1. **Functions that take only a seed** (`coin`, `crashX100`, `UniformGame`) use the seed's own value, the game's main number.
2. **Functions that take `(seed, i)`** hash first. Give every unrelated use its own `i`, and never reuse one number for two things.

**Changing the math.** Edit both copies, then run `npm run vectors && forge test`. `scripts/seed-vectors.mjs` writes `test/vectors/seed.json` from the JavaScript copy, and `test/SeedVectors.t.sol` fails if the Solidity copy disagrees on any entry. `crashX100` and `gameSeed` are also copied in `frontend/src/lib/`, so a change there needs an Inbox note for the frontend.

**Try it before building it.** `sandbox/SANDBOX.md` is a sandbox for these functions. Write an experiment as a ```` ```js experiment ```` block, run `npm run sandbox`, and the win rates, return and a 2%-edge check are written in under it. The same run simulates the frontend's current games and checks their math against this toolkit.

**Which games can use one seed for many steps.** Deriving many numbers from one seed (`draw(seed, 0..n)`) is safe only when every result is fixed at lock and only *shown* step by step (a Crash replay, a multi-block race). If players act *between* steps, like trading in Block Walk, each step needs a seed nobody knows yet: a later round's seed, or its own VRF request. One revealed seed would give away every step that follows.

## Designing a new game

A game is a contract implementing `contracts/interfaces/IGame.sol`:

| Function | Meaning |
|---|---|
| `numOutcomes()` | How many choices a player can bet on (2–255) |
| `rawResult(seed)` | The number the UI shows (for example 0–99) |
| `outcome(seed)` | The winning choice index, `0 … numOutcomes-1` |
| `payoutBps()` | Total payout for a winning bet, in basis points (19,600 = 1.96×) |

Rules every game must follow, from the project's non-negotiables:

1. **State the odds honestly.** Every outcome must be equally likely, *or* the payout per outcome must reflect its real probability. With equal outcomes, `payoutBps = numOutcomes × 9,800` gives exactly a 2% house edge.
2. **Use only the seed.** No `block.timestamp`, `blockhash`, `msg.sender` or other chain data in the result.
3. **Need several numbers or unequal odds?** Use the seed toolkit above. Never reuse one number for two unrelated things.
4. **Tell the frontend.** A new game ID changes `frontend/src/lib/games.ts` and the deploy order in `script/Deploy.s.sol`. If the game doesn't fit "pick 1 of N equal buckets," `frontend/src/lib/outcomes.ts` needs its math too. Put a note in Tabor's Inbox in `docs/TEAM_CONTEXT.md`.

Example: a Block Race where each of the 4 lanes gets a random speed and the fastest wins. Draw `speed[i] = SeedLib.uniform(seed, i, 1000)` for each lane. Ties need a rule (for example, the lowest lane index wins), and that makes some lanes more likely than others. Either break ties with another draw, or compute the real odds and set the payouts to match.

## Running the tests

```bash
cd backend
npm install            # once: forge-std + Pyth's SDK
forge test             # 35 unit tests, including a full round through Pyth's MockEntropy and the JS↔Solidity vectors
```

`test/fork/` holds read-only checks against the **real** Entropy contract on Monad testnet. They spend nothing, and they show as skipped unless you fork Monad:

```bash
forge test --match-path "test/fork/*" --fork-url https://testnet-rpc.monad.xyz -vv
```

Last run (2026-11-15): passing, with a live fee of 123,805,606,509,000,001 wei (≈0.1238 MON) and default provider `0x6CC14824Ea2918f5De5C2f75A9Da968ad4BD6344`.
