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
   Games 3 (Crash) and 4 (Beauty Contest) are hidden in chain mode until the contract's
   `gameCount()` is 5 or more. See "Proposed: Crash and Beauty Contest on-chain" below.
3. **Outcome math.** `src/lib/outcomes.ts` copies `BlockCasino.gameSeed` and
   `UniformGame.rawResult` / `outcome`. The UI computes results from the seed
   itself instead of calling `gameResult`, which saves reads. If the contract
   math changes, this has to change too or the UI will show wrong results.
4. **Round status enum.** `chain.ts` maps `0..3` to none, requested, settled, expired.
5. **Payout math.** `amount × payoutBps / 10_000`, rounded down, same as the contract.

## Proposed: Crash and Beauty Contest on-chain (games 3 and 4)

Agreed on the frontend side 2026-11-15 (Tabor). **Backend: finkierstead, your call on the
internals.** This is what the UI is built to talk to. The frontend already has the code for it,
switched off until `gameCount()` returns 5 or more (see "How the UI turns them on" below).
Full game rules are in [GAMES.md](GAMES.md).

### Shape: two more games in BlockCasino

Both fit the existing round: same clock, one VRF seed per round, `placeBet` and `claim` as they
are, game seed `gameSeed(roundSeed, gameId)`. What changes is that `IGame` today returns one
winning outcome per seed, and these two pay per bet. Something like this works for all five:

```solidity
/// payout for one bet, in basis points of the stake (0 = lost). Uniform games: payoutBps if
/// outcome(seed) == choice. `cashoutBlock` is 0 unless the bet cashed out (Crash only).
function payoutBpsFor(bytes32 seed, uint8 choice, uint256 cashoutBlock) external view returns (uint256);
```

Payout stays `amount * bps / 10_000`, rounded down, so sync item 5 doesn't change.

### Crash (game 3): blind window

The multiplier climbs on the block clock after betting locks. Players cash out during the climb.
The crash point is drawn from the round seed, and the seed can only be requested after the climb,
so nobody knows it while deciding. Trade-off: there's no live "it crashed" moment. Players see
where it crashed when the round settles. Cost is the same one Pyth fee per round as today.

- **New constructor param** `crashClimbBlocks` (suggest `roundLength - bettingWindow`, which is 20,
  so the climb fills the locked part and the round settles when it ends). Public getter
  `crashClimbBlocks() view returns (uint256)`.
- **Multiplier at block** `lock + k`: `m(0) = 100`, then `m(k) = m(k-1) * 120 / 100`, integer
  division each step (hundredths). 1.20x, 1.44x, 1.72x, 2.06x ... about 38x at k = 20.
  Frontend copy: `src/lib/crashChain.ts`.
- **`cashOut(uint256 roundId, uint256 betIndex)`**: only the bet's player, only Crash bets, once,
  only while `1 <= block.number - lock <= crashClimbBlocks`. Saves `k = block.number - lock`.
  Event `CashedOut(uint256 indexed roundId, uint256 indexed betIndex, address indexed player, uint256 k, uint256 multX100)`.
- **`cashoutBlock(uint256 roundId, uint256 betIndex) view returns (uint256)`**: the saved k, 0 if none.
- **`requestSettlement`**: for every round, revert until `block.number > lock + crashClimbBlocks`.
  Otherwise the seed could land mid-climb and anyone could read the crash point. This delays
  results for the other games by the same 20 blocks.
- **Choice**: `0..8` = auto target index into `[110, 125, 150, 200, 300, 500, 1000, 2000, 5000]`,
  `9` = no auto target.
- **Settle one bet**: `cash = min(autoTarget, m(k) if cashed out, m(crashClimbBlocks))`. A bet still
  riding at the end of the window cashes out at the final multiplier. Then
  `crash = max(100, 98 * 2^52 / (2^52 - (uint256(gameSeed) % 2^52)))`, win if `crash >= cash`,
  payout bps `cash * 100`.
- **Why k starts at 1:** the formula floors at 1.00x, so a cash-out at 1.00x would always win and
  return 100%. From 1.20x up, P(crash >= x) = 98 / x, so every cash-out returns 98%.
- **Transactions land a block later than the click.** The UI shows the multiplier from the
  `CashedOut` event, not the one on screen when the player clicked.

### Beauty Contest (game 4): house game against seeded bots

Same as the sim today. Real-player commit and reveal can come later. It needs a crowd, and a
demo won't have one.

- **Choice** = the guess, 0 to 100 (fits `uint8`). **Amount** must equal 10 CHIP. One entry per
  player per round (revert `AlreadyEntered`).
- **Bots** from `gameSeed`: `draw(i) = uint256(keccak256(abi.encode(gameSeed, i)))`,
  `unit(i) = (draw(i) % 1e6) / 1e6`. Count `4 + draw(0) % 6`. Each bot's guess:
  `src/lib/beauty.ts` `botGuesses`. It uses floats; in Solidity work in millionths and round
  half up to match `Math.round`. **This is the one place the copy can drift. Please add the
  cross-check test below for it.**
- **Winner**: closest to 2/3 of the average, compared as `|3n * guess - 2 * sum|` (exact).
- **Payout bps** = `BEAUTY_PAYOUT_BPS[guess]` from `src/lib/beautyOdds.ts` (101 numbers, made by
  `sandbox/beauty-odds.mjs`), divided by the number of tied winners, rounded down.

### How the UI turns them on

At start the chain client reads `gameCount()` and, if the contract has it, `crashClimbBlocks()`.
With `gameCount() >= 5`, Crash and Beauty Contest show on the on-chain site. Before that they stay
on `/sim/` only, so a redeploy of the contracts is all it takes. Please keep the game order
`3 = Crash, 4 = Beauty Contest` in `Deploy.s.sol`.

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
