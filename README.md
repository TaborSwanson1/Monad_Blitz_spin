# STIM and SPIN

A play-money casino on Monad testnet, built for Monad Blitz Oregon.

Rounds are timed by Monad blocks. Results come from a public random seed (Pyth Entropy), never from block data, so nobody can steer them, block producers included. Chips are free from the faucet and have no real value. Nothing here takes real money.

## Play it

- **On Monad testnet** (MetaMask, real contracts): https://taborswanson1.github.io/Monad_Blitz_spin/
- **Simulator** (nothing to install, no wallet): https://taborswanson1.github.io/Monad_Blitz_spin/sim/

## Games

| Game | How it works | Where |
|---|---|---|
| High / Low | Guess the low or high half of 0 to 99. Pays 1.96x. | On-chain and simulator |
| Exact Digit | Pick a digit on the wheel. Pays 9.8x. | On-chain and simulator |
| Block Race | Pick one of four cars. Pays 3.92x. | On-chain and simulator |
| Crash | The multiplier climbs. Cash out before it crashes. | Simulator (on-chain version specced) |
| Beauty Contest | Guess closest to two-thirds of the average. | Simulator (on-chain version specced) |
| Lucky Leprechaun | A slot demo that shows how near-miss design works. | Simulator |

Every house game has a 2% edge, shown before you bet. Session time limits and reality checks are on by default.

## Repo

| Folder | What's in it | Owner |
|---|---|---|
| [`frontend/`](frontend/README.md) | React + Vite + viem app, simulator and chain clients | Tabor, Lucas, Zander |
| [`backend/`](backend/README.md) | Foundry contracts, deploy scripts, keeper, wallet SDK | finkierstead |
| [`sandbox/`](sandbox/README.md) | Notebook for checking game math | finkierstead |
| [`docs/`](docs/TEAM_CONTEXT.md) | Team context, decisions and inbox | everyone |

How the two halves talk is in [frontend/INTEGRATION.md](frontend/INTEGRATION.md). Game rules are in [frontend/GAMES.md](frontend/GAMES.md).

## Run it locally

```
cd frontend
npm install
npm run dev
```

That starts the simulator. To play against real contracts, see [backend/README.md](backend/README.md).
