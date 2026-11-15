# Team rules: working with two Claudes on one repo

For **humans**. Each of us has our own Claude, and the two Claudes **can't see each other's chats**. They share context only through files in this repo. These rules keep that working.

## How the sharing works

```
Your Claude ──/handoff──▶ docs/TEAM_CONTEXT.md ──▶ commit ──▶ push
                                                              │
Teammate's Claude ◀──/sync── reads TEAM_CONTEXT.md ◀── pull ◀─┘
```

| File | What it is | Who reads it |
|---|---|---|
| `CLAUDE.md` | Rules, ownership, game math. Loaded automatically in every Claude session. | Both Claudes |
| `docs/TEAM_CONTEXT.md` | Shared memory: current state, Inbox, Decisions, Open questions, Session log | Both Claudes, both humans |
| `frontend/INTEGRATION.md` | What the frontend needs from the backend | Both |
| `docs/TEAM_RULES.md` | This file | Humans |

**If it isn't written in the repo and pushed, the other Claude doesn't know it.**

## The 10 rules

1. **Start every session with `/sync`.** It pulls, then tells you what your teammate did and what's waiting in your Inbox.
2. **End every session with `/handoff`, then push.** It records your decisions and requests in `TEAM_CONTEXT.md`. Nothing reaches your teammate until you push.
3. **Stay in your lane.**
   - **Tabor** and **Lucas** own `frontend/`. Since you share it, tell each other which files you're working on so you don't edit the same ones at once.
   - **finkierstead** owns `backend/`.
   - Your Claude doesn't edit the other person's folder.
   - Shared files (`CLAUDE.md`, `docs/`, `.claude/`) can be edited by both. Add to them rather than rewriting.
4. **Ask through the Inbox.** If you need something from the other side, like a new contract function or a UI change, tell your Claude "put this in Tabor's inbox" (or finkierstead's). Don't edit their code yourself.
5. **Interface changes get announced.** Changing a contract function, event, game order, status enum, or outcome or payout math means updating `frontend/INTEGRATION.md` and leaving an Inbox note **in the same commit**.
6. **Decisions are append-only.** Never edit or delete an old Decision. Add a new dated one that says what it replaces.
7. **Pull before you push.** If `git push` is rejected, run `git pull`, then push again. If both people edited `TEAM_CONTEXT.md`, keep both sides' entries.
8. **Commit small and often.** One working step = one commit, with prefixes `feat:`, `fix:`, `test:`, `docs:`, `chore:`. Run tests before committing.
9. **Never commit secrets.** No private keys, seed phrases or RPC API keys. They go in a git-ignored `.env`, with only placeholders in `.env.example`. If a secret is ever pushed, tell your teammate right away and replace that key, because deleting the commit isn't enough.
10. **Talk directly for anything urgent.** The Inbox is asynchronous, so your teammate only sees it after they pull. For a quick live decision, message each other, then have one Claude record the result with `/handoff`.

## Project rules every Claude enforces

These come from the original README and are written out in `CLAUDE.md`. Your Claude will push back if a request breaks one:

- Testnet and play money only. No deposits, cash-out or chip purchases.
- Results come from a VRF, never from block data.
- The contract enforces betting deadlines.
- Honest UI: odds shown up front, net result shown, no fake win tickers, no near-miss tricks, no autoplay.

## Daily loop

```
open repo → /sync → work (Claude commits as it goes) → /handoff → push
```

## Setting up on a new computer or editor

1. Clone the repo (or, in an existing copy, run `git switch main`), then `git pull`.
2. Open the repo folder (the one containing `CLAUDE.md`) in VS Code, or start Claude Code from that folder.
3. Start a **new** Claude session. It loads `CLAUDE.md` and the shared files automatically.
4. Run `/sync`.
