# Architecture

## Contracts

```
ChipToken ◄──── mints payouts ──── BlockCasino ────► IGame (x3, UniformGame)
                                      │   ▲
                         request()    │   │ onRandomness()
                                      ▼   │
                               IRandomnessSource
                               ├── MockRandomness       (tests, local anvil)
                               └── PythEntropyAdapter ──► Pyth Entropy (testnet)
```

| File | Job |
|---|---|
| `contracts/ChipToken.sol` | Play-money ERC-20. Free faucet (1,000 CHIP a day). Only the casino can mint. |
| `contracts/BlockCasino.sol` | Round timing, bets, settlement requests, claims, refunds. |
| `contracts/games/UniformGame.sol` | Maps a seed to one of N equal outcomes. Pays N × 0.98. |
| `contracts/interfaces/IRandomness.sol` | The only thing the casino knows about randomness. |
| `contracts/randomness/MockRandomness.sol` | Caller picks the number. Tests only. |
| `contracts/randomness/PythEntropyAdapter.sol` | Wraps Pyth Entropy. Built on Pyth's official SDK 2.2.1 (`IEntropyV2`, `IEntropyConsumer`). Testnet address verified 2026-11-15. |
| `contracts/lib/SeedLib.sol` | Round seed → per-game seed → extra draws. See `MECHANICS.md`. |

## Round lifecycle

Round `r` starts at `genesisBlock + r × roundLength`.

1. **Open** for `bettingWindow` blocks. `placeBet` always goes into the current round.
2. **Locked** after that. Anyone can call `requestSettlement` and pay the VRF fee.
3. **Settled** when the VRF calls back with a seed.
4. Players (or anyone on their behalf) call `claim` per bet.
5. If no seed arrives within `settleTimeout` blocks after lock, the round is **Expired** and `refund` returns stakes. A late callback is ignored.

## Key choices

- **One seed per round.** All games share one VRF request. Each game uses
  `keccak256(seed, gameId)`, so the games don't move together.
- **One game contract for all three games.** High / Low, Exact Digit, and Block Race
  are all "pick 1 of N equal outcomes." Only the range and N change.
- **Claims, not loops.** Settlement doesn't touch bets, so a busy round can't run out of gas.
- **House mints shortfalls.** Losing stakes stay in the casino. If a payout is bigger
  than the balance, it mints the difference. Fine for play money, wrong for anything real.
- **Swappable randomness.** Changing VRF provider means writing a new adapter, nothing else.

## Not built yet

- Front end and block visualizer (`../frontend/`)
- Session limits and reality checks. These live in the front end, since they're about
  the player's own session and don't need the chain to enforce them.
- A keeper to call `requestSettlement` automatically. Right now someone has to call it.
