# Backend

Foundry contracts for the Block Casino, plus scripts that **translate the backend for the frontend**, so the UI can test against real contracts while the backend is still changing.

## Setup (once)

```bash
cd backend
npm install        # forge-std, Pyth's entropy SDK, viem (for the scripts)
forge build
forge test
```

Needs [Foundry](https://getfoundry.sh) and Node 18+.

## The translation loop

```
 you edit contracts/ ──► npm run dev ──► anvil + deploy + export + seam check + keeper
                                              │
                    backend/exports/local/frontend.env ──► frontend/.env ──► UI plays real rounds
```

| Command | What it does |
|---|---|
| `npm run dev` | Local chain (1 block/s), deploys with MockRandomness, exports for the frontend, checks the seam, then runs a **keeper** that settles every round with bets. Ctrl+C stops it all. `FUND=0xYourAddr npm run dev` also gives your wallet 1,000 local MON for gas. |
| `npm run export` | Rebuilds and regenerates `exports/` from the latest deployments |
| `npm run check-seam` | Fails if `frontend/src/client/abi.ts` or `frontend/src/lib/games.ts` no longer match the contracts. Run it before you push a contract change. |
| `npm run deploy:testnet` | Deploys to Monad testnet with real Pyth Entropy, using your keystore account `monad-deployer`. Then exports. |

### What `exports/` contains

| File | For |
|---|---|
| `exports/abis.ts` | Typed ABIs generated from Foundry output (`as const`, for viem). Committed. |
| `exports/local/frontend.env` | Paste into `frontend/.env` to point the UI at your local chain. Not committed, because addresses change each run. |
| `exports/local/deployment.json` | Addresses, round timing, VRF fee and the game list, read back from the chain |
| `exports/monad-testnet/…` | Same files for the testnet deployment. **Committed**, so teammates get the addresses with `git pull`. |

### Frontend side

1. Run `cp backend/exports/local/frontend.env frontend/.env`, or use `exports/monad-testnet/frontend.env` for testnet.
2. In MetaMask, add the network: RPC `http://127.0.0.1:8545`, chain ID `31337`, symbol MON.
3. Run `cd frontend && npm run dev`, then click "faucet" for chips and play. Rounds settle by themselves.

## Where things live

| Path | What |
|---|---|
| `contracts/BlockCasino.sol` | Round clock (blocks), bets, settlement, claims, refunds |
| `contracts/lib/SeedLib.sol` | **Mechanics core:** VRF number → per-game seed → extra draws |
| `contracts/games/` | Game logic (`IGame`). New games go here. |
| `contracts/randomness/` | Pyth Entropy adapter (testnet) and MockRandomness (local) |
| `script/Deploy.s.sol` | Deploys everything, records `deployments/<chainId>.json` |
| `scripts/` | The translation loop: `dev.sh`, `export.mjs`, `check-seam.mjs`, `local-keeper.mjs`, `deploy-testnet.sh` |
| `docs/MECHANICS.md` | How randomness works and how to design a game. **Read first.** |
| `docs/ARCHITECTURE.md` | Contract map and key choices |
