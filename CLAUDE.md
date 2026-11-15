# CLAUDE.md: shared by every Claude session on this team

Two people work on this repo, each with their own Claude. This file and the two it imports are how those sessions **share one context**. Claude Code loads this file automatically, in the terminal, VS Code and the desktop app.

@docs/TEAM_CONTEXT.md
@frontend/INTEGRATION.md

The human-facing rules for this setup are in `docs/TEAM_RULES.md`. Follow them, and point your human to them when they ask how the team workflow works.

## Start every session like this

1. `git pull` on the working branch (currently `main`).
2. Read `docs/TEAM_CONTEXT.md`, especially **Inbox** and **Decisions**, and `git log --oneline -15` to see what the other chat did.
3. Tell your human, in a few lines, what changed since their last session and anything addressed to them.

The `/sync` command does all three.

## Who owns what

| Area | Owner | Their Claude may edit |
|---|---|---|
| `frontend/` | **Tabor** (TaborSwanson1) and **Lucas** | `frontend/**` |
| `backend/` (Foundry contracts, tests, scripts, keeper) | **finkierstead** | `backend/**` |
| `CLAUDE.md`, `docs/`, `.claude/` | Both | Shared, append-only where possible |

**Don't edit the other person's area.** If you need something changed there, write it in the TEAM_CONTEXT **Inbox** addressed to them.

## The seam between frontend and backend

`frontend/INTEGRATION.md` (imported above) is the contract between the two halves. It lists every call the UI makes and the five things that must stay in sync: ABIs, game order, outcome math, the round status enum, and payout math.

- **Backend chat:** never change a function signature, event, game order, status enum or the outcome/payout math without (a) updating `frontend/INTEGRATION.md`'s table and (b) leaving an Inbox note for Tabor. The frontend copies this logic in `frontend/src/lib/` and `frontend/src/client/abi.ts`.
- **Frontend chat:** if the UI needs a new contract feature (for example `claimMany` or a keeper), ask in the Inbox. Don't change `backend/`.

## Non-negotiables

These come from the original root README. Tabor removed it on 2026-11-15, so this section is now the source of truth for them. The original is still in git history: `git show 34d078d:README.md`.

- **Testnet and play money only.** Chips are a free-faucet ERC-20 with no value. Never add deposits, withdrawals to real currency, chip purchases or mainnet config.
- **Randomness comes from a VRF, never from block data.** Blocks are the clock and the show. Tx count, gas, base fee, hash and timestamp can all be manipulated.
- **The contract enforces timing.** `placeBet` reverts at or after the lock block, whatever the UI shows.
- **Honest UI:**
  - Odds and the 2% edge are shown before every bet, and the session's net result is shown, not just the balance.
  - Reveal effects scale with the real net result: no win fanfare for a payout below the stake.
  - No near-miss framing, no autoplay, no fake "someone won" tickers, no countdown pressure on bonuses.
  - Session limits and reality checks are on.
  - The history view says past rounds don't predict future ones.

If a request breaks one of these, say so before doing anything.

## Mechanics in one place

These must match across `backend/contracts`, `frontend/src/lib/` and any simulation:

```
round r:   start = genesisBlock + r*roundLength      open while block < start + bettingWindow
gameSeed   = keccak256(abi.encode(roundSeed bytes32, gameId uint8))
raw        = uint256(gameSeed) % range
outcome    = raw / (range / numOutcomes)
payoutBps  = numOutcomes * (10_000 - 200)            // 2% edge
payout     = amount * payoutBps / 10_000             // rounded down
```

| id | Game | range | outcomes | payoutBps |
|---|---|---|---|---|
| 0 | High / Low | 100 | 2 | 19,600 |
| 1 | Exact Digit | 10 | 10 | 98,000 |
| 2 | Block Race | 4 | 4 | 39,200 |

A reference backend draft exists in commit `b5587a5` (`git show b5587a5:backend/contracts/BlockCasino.sol`). The frontend was written against it.

## Commands

```bash
# backend: deps via npm (forge-std + Pyth SDK), then Foundry
cd backend && npm install && forge build && forge test
# read-only checks against real Pyth Entropy on Monad testnet (spends nothing)
cd backend && forge test --match-path "test/fork/*" --fork-url https://testnet-rpc.monad.xyz -vv
# translation loop: local chain + deploy + export for frontend + seam check + auto-settling keeper
cd backend && npm run dev                 # then: cp backend/exports/local/frontend.env frontend/.env
cd backend && npm run check-seam          # run before pushing any contract change
# deploy to Monad testnet (you type the keystore password; the key never goes in .env)
cd backend && npm run deploy:testnet      # exports to backend/exports/monad-testnet/ (commit it)
# frontend
cd frontend && npm install && npm run dev      # VITE_MODE=sim needs no backend
```

## Git workflow

- **Commit after each working step.** Keep commits small, with prefixes `feat:`, `fix:`, `test:`, `docs:`, `chore:`, `refactor:`. Run tests first.
- **Ask your human before `git push`.** Pull before you push. If both people touched `docs/TEAM_CONTEXT.md`, keep both sides' entries when merging.
- **Never commit secrets:** `.env` is git-ignored. Use `.env.example` with placeholders only.
- When you make a decision or finish a piece of work, run `/handoff` so the other chat knows.
