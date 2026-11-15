# CLAUDE.md

Guidance for Claude Code (and humans) working in this repo. Read `README.md` for the full pitch; this file holds the rules that must not drift.

## What this is

**Block Casino Demo**: a hackathon project. It's a play-money casino on **Monad testnet** where rounds are timed by Monad blocks and a live block visualizer is the main show. It's a learning and portfolio project, not a gambling service.

## Non-negotiables

- **Testnet and play money only.** Chips are a free-faucet ERC-20 with no value. Never add deposits, real-currency withdrawals, chip purchases, or mainnet deploy config.
- **Results come from a VRF, never from block data.** Block properties (tx count, gas used, base fee, hash, timestamp) can be manipulated by users or the block leader. Blocks are the *clock and the theme*, not the source of randomness. First choice for randomness: Pyth Entropy (confirm it supports Monad testnet).
- **The contract enforces timing.** Bets after the lock block (`N + L`) must revert on-chain no matter what the frontend shows.
- **Honest UI** (from the README design principles):
  - Show odds and house edge before every bet. Show the session's net result, not just the balance.
  - Space rounds out (every `R` blocks) to build anticipation.
  - Support session time and loss limits, and show periodic reality checks.
  - Don't celebrate a "win" that pays back less than the stake. Don't design near misses on purpose. No autoplay, no fake "someone just won" tickers, no countdown pressure on bonuses.
  - The history view says past rounds don't predict future ones.

If a request conflicts with these rules, point out the conflict before doing anything.

## Games and payouts

| Game | Bet | Payout | Edge |
|---|---|---|---|
| High / Low | Result above/below 50 (0–99) | 1.96x | 2% |
| Exact Digit | Last digit of the result (0–9) | 9.8x | 2% |
| Block Race | Which of 4 lanes wins | 3.92x | 2% |

Keep payout math in one place in the contracts and test it directly.

## Stack and layout

- **Contracts:** Solidity with Foundry → `contracts/`, tests in `test/`, deploy scripts in `script/`
- **Frontend:** `frontend/` (likely React + viem; not decided yet)
- **Chain:** Monad testnet. Look up chain ID, RPC URLs and provider addresses in the current Monad and Pyth docs before deploying. Never hardcode values from memory.

## Commands

```bash
forge install   # deps
forge build
forge test      # run before every commit that touches contracts
forge fmt       # format Solidity
```

Add frontend commands here once `frontend/` exists.

## Secrets

Never commit private keys, mnemonics or RPC keys. Use a git-ignored `.env`, and keep `.env.example` with placeholder values only.

## Git workflow: commit regularly

- **Commit after every working step:** a contract compiles, a test passes, or a UI piece renders. Don't let a session build up a large uncommitted diff.
- Keep commits small and focused, one logical change each. Use conventional prefixes: `feat:`, `fix:`, `test:`, `chore:`, `docs:`, `refactor:`.
- Run `forge test` (and frontend checks once they exist) before committing. Don't commit failing tests unless the message says so (`test: failing case for …`).
- Work on feature branches (`feat/round-contract`) and merge to `main` through PRs.
- **Don't push or open PRs without asking the user first.** Local commits are fine at any time.
- Update the README roadmap checkboxes when a roadmap item lands.

## Design reference

An early visual prototype (a dark neon slot-reel look, purple and amber) is on the Claude canvas at https://claude.ai/artifact/4ko5VrCR2hpUyMqHHKFvKN. Use it **only for visual style**. Its mechanics (betting on block properties, a fake live-bets feed, whale alerts, countdown pressure) break the rules above. Don't port those mechanics.
