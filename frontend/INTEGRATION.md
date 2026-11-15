# Front end ↔ backend integration

What the front end depends on in `backend/`, what has to stay in sync, and what
to polish once the contracts are deployed. The front end never changes the
contracts. If something here needs a contract change, raise it with the backend.

## The seam

All chain access goes through one interface, `CasinoClient` in
[src/client/types.ts](src/client/types.ts). Two implementations:

| File | Used when | Notes |
|---|---|---|
| `src/client/sim.ts` | `VITE_MODE=sim` | Fake chain in the browser. No backend needed. |
| `src/client/chain.ts` | `VITE_MODE=chain` | viem against Monad testnet. |

Components and hooks only see `CasinoClient`, so the backend can change shape
without touching the UI, as long as `chain.ts` is updated to match.

## Contract calls the front end makes

| Call | Contract | Where | Why |
|---|---|---|---|
| `genesisBlock`, `roundLength`, `bettingWindow`, `minBet`, `maxBet` | BlockCasino | `init` | Round timing and bet limits |
| `rounds(roundId)` | BlockCasino | `roundState` | Status and seed (polled once per block per pending round) |
| `placeBet(gameId, choice, amount)` | BlockCasino | `placeBet` | Simulated first to read back `(roundId, betIndex)` |
| `requestSettlement(roundId)` payable | BlockCasino | `requestSettlement` | Player pays the VRF fee |
| `claim(roundId, betIndex)` | BlockCasino | `claim` | Winning bets only |
| `randomness()` | BlockCasino | `requestSettlement` | To look up the fee |
| `fee()` | IRandomnessSource | `requestSettlement` | VRF fee in MON |
| `balanceOf`, `allowance`, `approve`, `faucet` | ChipToken | various | Chips |

ABIs are written by hand in [src/client/abi.ts](src/client/abi.ts).

## Things that must stay in sync

1. **ABIs.** If a signature changes in `backend/contracts`, update `src/client/abi.ts`.
2. **Game list and order.** `src/lib/games.ts` has to match the order of games
   passed to the `BlockCasino` constructor in `backend/script/Deploy.s.sol`:
   0 High / Low (range 100, 2 outcomes), 1 Exact Digit (10, 10), 2 Block Race (4, 4).
   Games 3 (Crash) and 4 (Beauty Contest) are `simOnly` and hidden in chain mode, so
   they don't affect this until the contracts add them. See the "Proposed" sections below.
3. **Outcome math.** `src/lib/outcomes.ts` copies `BlockCasino.gameSeed` and
   `UniformGame.rawResult` / `outcome`. The UI computes results from the seed
   itself instead of calling `gameResult`, which saves reads. If the contract
   math changes, this has to change too or the UI will show wrong results.
4. **Round status enum.** `chain.ts` maps `0..3` to none, requested, settled, expired.
5. **Payout math.** `amount × payoutBps / 10_000`, rounded down, same as the contract.

## Proposed: Crash (game 3, sim mode only)

Not on the contract yet. Nothing here changes the seam until the backend agrees.
Full rules and reasoning are in [GAMES.md](GAMES.md#2-crash).

- **Seed:** `gameSeed(roundSeed, 3)`, same as the other games.
- **Choice:** index into the target ladder `[110, 125, 150, 200, 300, 500, 1000, 2000, 5000]`
  (hundredths). `choice` is a `uint8`, so it can't hold the target itself.
- **Math** (`src/lib/crash.ts`): `r = uint256(gameSeed) % 2^52`,
  `crashX100 = max(100, 98 * 2^52 / (2^52 - r))`, win if `crashX100 >= target`,
  payout `amount * target / 100` rounded down. 2% edge at every target.
- **Doesn't fit `IGame`:** many targets can win in one round, each with its own payout.
  Needs something like `wins(seed, choice)` plus `payoutBps(choice)`, or a Crash path in `claim`.
- When the contract has it: drop `simOnly`, add the ABI pieces, and add Crash to the
  outcome cross-check test below.
- **Update 2026-11-15, live cash-out (sim only for now).** The sim draws the crash point
  live, step by step (`src/lib/liveCrash.ts`), and cash-outs lock the current multiplier.
  On-chain, a live crash point must stay unknown while players decide, so the seeded
  formula above can't be used as is. Options, with their cost:
  1. Per-step randomness (a VRF result per block or few blocks): trustless and live, but
     each request costs about 0.124 MON on Pyth.
  2. Blind window: the multiplier climbs on a clock, `cashOut(roundId, betIndex)` records
     the multiplier at the block it lands in, and the crash point is drawn from one VRF
     seed after the window closes. Trustless and cheap, but there's no live crash moment.
  3. A house seed chain (commit to hashes ahead, reveal after): live and verifiable later,
     but the operator knows outcomes early.
  Whichever is picked, a cash-out lands a block after the click, so the UI must show the
  multiplier at the landing block, not the click.

## Proposed: Beauty Contest (game 4, sim mode only)

Not on any contract yet. Full rules are in [GAMES.md](GAMES.md#3-beauty-contest).

- **Probably its own contract**, not a `BlockCasino` game: a pot split between players
  instead of house payouts, and a commit phase then a reveal phase.
- **Calls the frontend would need:** `commit(roundId, hash)` with the entry fee,
  `reveal(roundId, guess, salt)` where `hash = keccak256(abi.encode(guess, salt, player))`,
  `settle(roundId)`, `claim(roundId)`, and reads for the phase, the revealed guesses, and the winners.
- **Math to match** (`src/lib/beauty.ts`): target is 2/3 of the average of revealed guesses.
  Closest wins, compared as `|3n × guess − 2 × sum|` so it's exact. Pot × 0.98 split evenly
  between tied winners, rounded down. Unrevealed entries stay in the pot.
- **Open:** minimum players, and what happens if nobody reveals.
- In sim mode, bots stand in for other players, with guesses drawn from the round seed.
  On-chain the game doesn't need the VRF.

## Polish once contracts are deployed

Ordered by impact.

- [ ] **Generate ABIs from Foundry output** instead of writing them by hand. Read
      `backend/out/*.json` at build time, or use `@wagmi/cli` with its Foundry plugin.
      This removes sync item 1.
- [ ] **Cross-check outcome math.** Add a test that runs `resolveGame` on a few
      seeds and compares to `BlockCasino.gameResult` on a local anvil deploy.
      This guards sync item 3. Nobody has checked this yet.
- [ ] **Read games from the contract.** `games(i)`, `numOutcomes`, and `payoutBps`
      are on-chain. Fetch them in `init` and check them against `GAMES`, or drop
      the hard-coded list. This guards sync item 2.
- [ ] **Restore bets on reload.** Pending bets live only in memory right now.
      Use `betsOf(roundId, player)` plus `getBet` (or `BetPlaced` logs) to rebuild them.
- [ ] **Use events instead of polling.** Watch `RoundSettled` rather than calling
      `rounds()` every block. Cuts RPC load a lot with a websocket RPC.
- [ ] **Show refunds.** Expired rounds currently show an error toast. Add a
      `refund(roundId, betIndex)` button.
- [ ] **Batch claims.** Each winning bet is one transaction. A `claimMany` on the
      contract would help, but that's a backend change.
- [ ] **Settlement keeper.** In chain mode the player has to click "Request result"
      and pay the fee. A small backend bot calling `requestSettlement` for every
      round with bets would make chain mode feel like the simulator.
- [ ] **Verify chain config.** Chain ID `10143` and the RPC URL in `.env.example`
      are from memory. Check Monad's docs.
- [ ] **Link to the explorer** for each settled round so players can check the
      seed and the VRF proof themselves.

## Running against a local backend

```
# terminal 1
cd backend && anvil
# terminal 2
cd backend && forge script script/Deploy.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
# copy the printed addresses into frontend/.env, set VITE_MODE=chain,
# VITE_CHAIN_ID=31337, VITE_RPC_HTTP=http://127.0.0.1:8545
cd frontend && npm run dev
```

With `MockRandomness`, nobody answers the VRF request on anvil. Call
`MockRandomness.fulfill(requestId, seed)` with `cast` to settle a round by hand.
