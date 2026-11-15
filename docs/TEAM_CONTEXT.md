# Team context: the shared memory of both Claude sessions

Each person's Claude reads this at the start of a session and adds to it at the end (`/handoff`). Newest entries go at the **top** of each section. Keep entries short and dated. This replaces "what we said in my chat": if it isn't written here, the other session doesn't know it.

## Current state (overwrite this section when it changes)

_Last updated 2026-11-15 by finkierstead's Claude_

- **Branch:** everyone works on `main` (scaffold was merged into it on 2026-11-15). `scaffold` is now identical to `main` and can be deleted.
- **Frontend (Tabor):** React + Vite + viem app in `frontend/`. Sim mode works without a backend. Chain mode is written against the draft backend in commit `b5587a5`.
- **Backend (finkierstead):** `backend/` is empty (`.gitkeep`). Next up: math and mechanics, then the Foundry contracts. The draft in `b5587a5` is the reference.
- **Deployed contracts:** none yet.

## Inbox

Requests and questions between the two sides. Mark them `[done]` instead of deleting them.

### For Tabor (frontend)
- 2026-11-15, from finkierstead: I merged `scaffold` into `main`, so everything now shows on GitHub's front page. Please run `git switch main` and `git pull`, and work on `main` from now on.
- 2026-11-15, from finkierstead: please read `docs/TEAM_RULES.md`. It covers how we use the two Claudes: /sync, /handoff, the Inbox, ownership, and no secrets in commits. Also, since the root `.gitignore` is gone, `backend/.gitignore` now covers Foundry output and `backend/.env`.
- 2026-11-15, from finkierstead: shared context is set up. Run `/sync` at the start of your sessions and `/handoff` at the end. Your `INTEGRATION.md` is imported into everyone's context.

### For finkierstead (backend)
- From `frontend/INTEGRATION.md` (Tabor's wishlist, ordered by impact): generate ABIs from Foundry output, a cross-check test of outcome math on anvil, reading games from the contract, `betsOf`/`getBet` for restoring bets on reload, `RoundSettled` events, `refund`, a possible `claimMany`, a settlement keeper, and verifying the chain ID `10143` and RPC.

## Decisions

Settled choices. Changing one means adding a new entry, not editing the old one.

- **2026-11-15: `main` is the working branch.** `scaffold` was fast-forwarded into `main` so teammates see the work on GitHub's default view. This replaces "work on `scaffold` until frontend and backend run together." Tabor: if you'd rather keep a separate branch, say so in finkierstead's Inbox.
- **2026-11-15: The repo root holds only `frontend/` and `backend/`, plus shared Claude files** (`CLAUDE.md`, `docs/`, `.claude/`). Tabor removed the root README and `.gitignore` (commit `f06326f`). Each side keeps its own `.gitignore`. The project rules now live in `CLAUDE.md`.
- **2026-11-15: Team workflow rules adopted.** See `docs/TEAM_RULES.md`.

- **2026-11-15: Split of ownership.** Tabor owns `frontend/`, finkierstead owns `backend/`. Changes across the seam go through `frontend/INTEGRATION.md` and this Inbox.
- **2026-11-15: Randomness from a VRF, not block data.** Block properties can be manipulated (see the original README in git history, `34d078d`). Blocks are the clock and the visual show only. The first provider to try is Pyth Entropy, behind the swappable `IRandomnessSource`.
- **2026-11-15: Mechanics follow the `b5587a5` draft.** One seed per round, `keccak256(seed, gameId)` per game, `UniformGame` buckets, a 2% edge, claims instead of payout loops, refunds after `settleTimeout`, and the house mints shortfalls (play money only). Full formulas are in CLAUDE.md.
- **2026-11-15: Early "block roulette" prototype rejected for mechanics.** A design canvas exists with a slot-reel look that bets on block properties and has fake live tickers. Its look can be borrowed. Its mechanics break the README rules.

## Open questions

- Values for `roundLength`, `bettingWindow` and `settleTimeout`. These depend on measured Monad testnet block times.
- Is Pyth Entropy live on Monad testnet? Its exact address, fee and callback signature are not yet checked against the docs.
- Monad testnet chain ID and RPC (the frontend's `.env.example` values are from memory).
- Who runs the settlement keeper during the demo?

## Session log

One line per session: who, date, what changed, which commits.

- 2026-11-15, finkierstead + Claude: added `docs/TEAM_RULES.md` and `backend/.gitignore`. Made CLAUDE.md stand on its own now that the README is gone.
- 2026-11-15, finkierstead + Claude: added the shared `CLAUDE.md`, this file, and the `/sync` and `/handoff` commands.
