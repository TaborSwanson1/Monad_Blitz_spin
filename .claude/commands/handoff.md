---
description: Record this session's decisions and work in TEAM_CONTEXT.md so the other teammate's Claude knows
argument-hint: "[optional note]"
---

Write this session's important context into the shared log so the other teammate's Claude can pick it up.

Extra note from the user: $ARGUMENTS

1. Run `git pull` first, so you edit the latest `docs/TEAM_CONTEXT.md`.
2. Update `docs/TEAM_CONTEXT.md`:
   - **Current state:** rewrite the lines for this user's area if they changed, and the "Last updated" line.
   - **Decisions:** add a dated entry at the top for each real decision made this session (a mechanic, an interface or a tool choice). Don't edit old entries. If a decision replaces an older one, say which.
   - **Inbox:** add requests or questions for the other person. Mark items this session completed as `[done]`.
   - **Open questions:** add or resolve.
   - **Session log:** add one line saying who, the date, what changed and the commit hashes.
3. If this session changed anything in the integration seam (signatures, events, game order, the status enum, outcome or payout math), check that `frontend/INTEGRATION.md` and the "Mechanics in one place" section of `CLAUDE.md` still match. If they don't, flag it, and fix whichever file this user owns.
4. Commit with `docs: handoff <short summary>`.
5. Show the user the diff summary and **ask before pushing**.
