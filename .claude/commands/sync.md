---
description: Pull the latest work and catch up on what the other teammate's Claude did
---

Catch this session up with the rest of the team.

1. Run `git status`. If there are uncommitted changes, tell the user and stop. Don't stash or discard anything.
2. Run `git pull` on the current branch.
3. Read `docs/TEAM_CONTEXT.md` again. It may have changed since this session loaded it.
4. Run `git log --oneline -20` and `git diff --stat ORIG_HEAD HEAD`, if the pull brought in commits.
5. Report to the user in under 15 lines:
   - what the other person changed since the last pull (by area: frontend, backend or shared docs)
   - any **Inbox** items addressed to this user, and any not marked `[done]`
   - new **Decisions** or **Open questions**
   - anything that touches the integration seam (`frontend/INTEGRATION.md`'s sync items) and needs a matching change on this user's side
6. Suggest the single most useful next step for this user.
