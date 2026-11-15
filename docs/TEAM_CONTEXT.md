# Team context: the shared memory of both Claude sessions

Each person's Claude reads this at the start of a session and adds to it at the end (`/handoff`). Newest entries go at the **top** of each section. Keep entries short and dated. This replaces "what we said in my chat": if it isn't written here, the other session doesn't know it.

## Current state (overwrite this section when it changes)

_Last updated 2026-11-15 by finkierstead's Claude_

- **Branch:** everyone works on `main`. The `scaffold` branch has been deleted.
- **Frontend (Tabor):** React + Vite + viem app in `frontend/`. Sim mode works without a backend. Chain mode is written against the draft backend, which is now restored in `backend/`.
- **Backend (finkierstead):** Tabor's draft is restored, plus a Pyth Entropy adapter on Pyth's official SDK, `SeedLib` (the randomness derivation), a safer deploy script, and tests. **Not compiled or tested yet**, because Foundry isn't installed on finkierstead's machine. Mechanics write-up for game designers: `backend/docs/MECHANICS.md`.
- **Deployed contracts:** none yet.

## Verified Monad testnet facts (2026-11-15)

| | Value | Source |
|---|---|---|
| Chain ID | `10143` | docs.monad.xyz + live `eth_chainId` |
| RPC | `https://testnet-rpc.monad.xyz` (20 rps) | docs.monad.xyz |
| Explorers | testnet.monadvision.com, testnet.monadscan.com | docs.monad.xyz |
| Block time | ≈0.3 s | measured over 1,000 blocks |
| Pyth Entropy | `0x825c0390f379c631f3cf11a82a37d20bddf93c07` (contract code present) | docs.pyth.network/entropy/chainlist + live `eth_getCode` |
| Entropy reveal delay | 2 blocks | Pyth chainlist |
| Entropy fee | ≈0.124 MON per request (varies; read `fee()`) | Pyth chainlist |

## Inbox

Requests and questions between the two sides. Mark them `[done]` instead of deleting them.

### For Tabor (frontend)
- 2026-11-15, from finkierstead: **backend is back in `backend/`**, your draft plus changes. What affects you:
  - **No ABI or formula changes.** `placeBet`, `requestSettlement`, `claim`, `rounds`, `randomness().fee()`, the game order and `gameSeed` are all unchanged.
  - **Round timing is now 60 blocks per round with 40 for betting** (≈18 s / 12 s at 0.3 s blocks), up from 30/20. Chain mode reads these from the contract. Update `sim.ts` if you want sim mode to feel the same.
  - **Settling costs ≈0.124 MON per round in Pyth fees** (one request covers every bet in the round). In chain mode, the player who clicks "Request result" pays it. A keeper is on my list.
  - Your `.env.example` values (chain `10143`, RPC) are **verified correct**.
  - `backend/docs/MECHANICS.md` explains the randomness pipeline and how to design a new game.
- 2026-11-15, from finkierstead: I merged `scaffold` into `main`, so everything now shows on GitHub's front page. Please run `git switch main` and `git pull`, and work on `main` from now on.
- 2026-11-15, from finkierstead: please read `docs/TEAM_RULES.md`. It covers how we use the two Claudes: /sync, /handoff, the Inbox, ownership, and no secrets in commits. Also, since the root `.gitignore` is gone, `backend/.gitignore` now covers Foundry output and `backend/.env`.
- 2026-11-15, from finkierstead: shared context is set up. Run `/sync` at the start of your sessions and `/handoff` at the end. Your `INTEGRATION.md` is imported into everyone's context.

### For finkierstead (backend)
- 2026-11-15, from Tabor: new game lineup in `frontend/GAMES.md`: High / Low, Crash, Beauty Contest, Block Walk. High / Low already works as game `0`. The other three need backend work, so please read GAMES.md and say what's doable. Short version: **Crash** fits the round model best. Same round seed, target in hundredths in the existing `choice` field, but it needs a new game type, since `UniformGame` assumes equal buckets, plus a cap on max target. **Beauty Contest** is probably its own contract with commit and reveal and no VRF. **Block Walk** is the biggest. Each walk step can use one casino round's seed, so no extra VRF calls, plus share minting and batch clearing. Nothing in the seam changes until you agree.
- From `frontend/INTEGRATION.md` (Tabor's wishlist, ordered by impact): generate ABIs from Foundry output, a cross-check test of outcome math on anvil, reading games from the contract, `betsOf`/`getBet` for restoring bets on reload, `RoundSettled` events, `refund`, a possible `claimMany`, a settlement keeper, and verifying the chain ID `10143` and RPC. **[done]:** chain ID and RPC verified. `betsOf`, `getBet`, `RoundSettled` and `refund` already exist in the restored contract.

## Decisions

Settled choices. Changing one means adding a new entry, not editing the old one.

- **2026-11-15: Pyth Entropy is the randomness source. Blocks are the clock only.** finkierstead chose this over a block-hash source (even a labeled demo-only one). It confirms the earlier VRF decision with real numbers: Entropy is live on Monad testnet, reveals 2 blocks after the request, and costs ≈0.124 MON per settled round.
- **2026-11-15: Backend restored from Tabor's `b5587a5` draft** as the base, so the frontend's chain mode matches it. Changes: the Pyth adapter now inherits Pyth's official `IEntropyConsumer` (SDK 2.2.1); `SeedLib` holds the seed derivation (same formula); rounds are 60/40 blocks; deploys use an encrypted Foundry keystore (`--account monad-deployer`), never a `PRIVATE_KEY` in `.env`; the deploy refuses `MockRandomness` off anvil.
- **2026-11-15: Backend Solidity dependencies come from npm** (`backend/package.json`: forge-std + `@pythnetwork/entropy-sdk-solidity`), not git submodules. Setup is `cd backend && npm install`.
- **2026-11-15: Lucas co-owns `frontend/` with Tabor** (Tabor). This adds to the "Split of ownership" decision below: `frontend/` is now Tabor and Lucas, `backend/` is still finkierstead. Inbox items "For Tabor (frontend)" are for both frontend owners. `docs/TEAM_RULES.md` and `CLAUDE.md` are updated to match.
- **2026-11-15: Game lineup is High / Low, Crash, Beauty Contest, Block Walk** (Tabor). Details in `frontend/GAMES.md`. Exact Digit and Block Race get dropped, but they stay in the contract and frontend until the backend supports the new games, so the game order in the seam doesn't change yet. How to build the new games on the backend is still open.
- **2026-11-15: `main` is the working branch.** `scaffold` was fast-forwarded into `main` so teammates see the work on GitHub's default view. This replaces "work on `scaffold` until frontend and backend run together." Tabor: if you'd rather keep a separate branch, say so in finkierstead's Inbox.
- **2026-11-15: The repo root holds only `frontend/` and `backend/`, plus shared Claude files** (`CLAUDE.md`, `docs/`, `.claude/`). Tabor removed the root README and `.gitignore` (commit `f06326f`). Each side keeps its own `.gitignore`. The project rules now live in `CLAUDE.md`.
- **2026-11-15: Team workflow rules adopted.** See `docs/TEAM_RULES.md`.
- **2026-11-15: Split of ownership.** Tabor owns `frontend/`, finkierstead owns `backend/`. Changes across the seam go through `frontend/INTEGRATION.md` and this Inbox.
- **2026-11-15: Randomness from a VRF, not block data.** Block properties can be manipulated (see the original README in git history, `34d078d`). Blocks are the clock and the visual show only. The first provider to try is Pyth Entropy, behind the swappable `IRandomnessSource`.
- **2026-11-15: Mechanics follow the `b5587a5` draft.** One seed per round, `keccak256(seed, gameId)` per game, `UniformGame` buckets, a 2% edge, claims instead of payout loops, refunds after `settleTimeout`, and the house mints shortfalls (play money only). Full formulas are in CLAUDE.md.
- **2026-11-15: Early "block roulette" prototype rejected for mechanics.** A design canvas exists with a slot-reel look that bets on block properties and has fake live tickers. Its look can be borrowed. Its mechanics break the README rules.

## Open questions

- How will the backend support Crash, Beauty Contest, and Block Walk? See `frontend/GAMES.md` and the Inbox note from 2026-11-15.
- Who runs the settlement keeper during the demo, and from which wallet? It pays ≈0.124 MON per round.
- **[resolved 2026-11-15]** Round timing: 60/40 blocks, `settleTimeout` 2,000 blocks (≈10 min). Tune after a live test.
- **[resolved 2026-11-15]** Pyth Entropy on Monad testnet: live, address and interface verified (see the facts table).
- **[resolved 2026-11-15]** Chain ID and RPC: verified.

## Session log

One line per session: who, date, what changed, which commits.

- 2026-11-15, finkierstead + Claude: verified Monad testnet and Pyth Entropy. Restored the draft backend (`933d17d`), npm deps and verified config (`a8050e5`), SeedLib and the Pyth adapter on the official SDK (`4583286`), tests and MECHANICS.md (`f306119`). Not compiled yet.
- 2026-11-15, Tabor + Claude: added `frontend/GAMES.md` with the new game lineup and an Inbox request for the backend.
- 2026-11-15, finkierstead + Claude: added `docs/TEAM_RULES.md` and `backend/.gitignore`. Made CLAUDE.md stand on its own now that the README is gone.
- 2026-11-15, finkierstead + Claude: added the shared `CLAUDE.md`, this file, and the `/sync` and `/handoff` commands.
