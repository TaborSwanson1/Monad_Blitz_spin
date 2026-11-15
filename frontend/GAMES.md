# Games

Tabor's game lineup for the demo. Each section covers the rules, the math, how randomness works, and what the frontend needs.

All games use play chips only. The project rules in [CLAUDE.md](../CLAUDE.md#non-negotiables) apply to every game here.

> **Status: proposal.** Only High / Low is supported by the current contract design (game `0` in [CLAUDE.md](../CLAUDE.md#mechanics-in-one-place)). Crash, Beauty Contest, and Block Walk need backend changes. Those are requested in finkierstead's Inbox in [docs/TEAM_CONTEXT.md](../docs/TEAM_CONTEXT.md). Nothing here changes the integration seam until the backend agrees and [INTEGRATION.md](INTEGRATION.md) is updated.

| Game | Type | Who you play against | Contract support | Build order |
|---|---|---|---|---|
| High / Low | Fixed odds | The house | Yes, game `0` | 1st (built) |
| Crash | Fixed odds | The house | Needs a new game type. Built in sim mode. | 2nd |
| Beauty Contest | Skill | Other players | Needs commit and reveal | 3rd |
| Block Walk | Market (batch auction) | Other players | Needs an order book | 4th |

Exact Digit and Block Race (games `1` and `2`) are dropped from the lineup. They stay in the contract and the frontend until the backend is ready for the new games, so the game order doesn't change before then.

---

## Shared frontend parts

Every game uses these. Most already exist in `src/components/` and `src/hooks/`.

- **Round HUD** (`RoundHud`). Round number, stage, and a countdown in blocks and seconds.
- **Session bar** (`SessionBar`, `useSession`). Balance, session net, limits.
- **Bet confirmation.** Pending, confirmed, and failed states for every transaction.
- **Reveal** (`RevealOverlay`). Outcome, net result, and a link to the proof. Effects scale with the real net result.
- **History** (`History`). Past results, with the note that past rounds don't predict the next one.
- **Dialogs** (`Dialogs`). Reality checks and session limits.

---

## 1. High / Low

The starter game. Already built against game `0`.

### Rules

- A random number from 0 to 99 is drawn each round.
- Bet **Low** (0 to 49) or **High** (50 to 99).
- A win pays 1.96x your bet.

### Math

- Win chance: 50%.
- Expected return: 1.96 × 0.50 = 0.98. So the house edge is 2%.
- Contract form: `raw = uint256(gameSeed) % 100`, `outcome = raw / 50`, `payoutBps = 19,600`.

### Randomness

- One VRF seed per round, as in CLAUDE.md. `gameSeed = keccak256(roundSeed, 0)`.
- Betting closes at `start + bettingWindow`. The seed is requested after that, so nobody can read it before betting closes.

### Frontend

- Two big buttons: Low and High.
- A bet size picker with a few presets and a custom field.
- Win chance, payout, and house edge next to the buttons.
- A short, straight reveal. No staged near misses.

---

## 2. Crash

A multiplier climbs, and players try to cash out before it crashes.

### Rules

- Each round has a crash point, like 1.00x, 2.37x, or 14.80x.
- Before betting closes, each player sets an **auto cash-out target**, like 2.00x.
- If the crash point is at or above your target, you win your bet times the target. If it crashes first, you lose your bet.

### Math

- Crash point = 0.98 ÷ U, where U is a random number between 0 and 1. If that comes out below 1.00, the round crashes right away.
- The chance the crash point is at or above a target `m` is 0.98 ÷ m.
- So the expected return for any target is m × (0.98 ÷ m) = 0.98. The house edge is 2% at every target.

| Target | Win chance | Payout |
|---|---|---|
| 1.50x | 65.3% | 1.50x |
| 1.96x | 50.0% | 1.96x |
| 5.00x | 19.6% | 5.00x |
| 10.00x | 9.8% | 10.00x |

A 1.96x target is exactly a High / Low bet. Crash just lets each player pick their own point on the same curve.

### Fit with the contract

Built in sim mode as game `3` (2026-11-15). Hidden in chain mode until the contract supports it. The frontend math is in `src/lib/crash.ts`:

```
r          = uint256(gameSeed) % 2^52
crashX100  = 98 * 2^52 / (2^52 - r)        // hundredths, 237 = 2.37x
if crashX100 < 100: crashX100 = 100         // instant crash, about 2% of rounds
win        = crashX100 >= targetX100
payout     = amount * targetX100 / 100      // rounded down
```

A 400,000-round simulation of this code gave win rates within noise of 98 ÷ target and an expected return of about 0.98 at every target.

What the contract needs:

- **Same round seed.** `gameSeed = keccak256(roundSeed, 3)`. No extra VRF calls.
- **Targets come from a fixed ladder.** `choice` is a `uint8`, so it can't hold a target in hundredths (it tops out at 2.55x). Instead `choice` is an index into: 1.10, 1.25, 1.50, 2.00, 3.00, 5.00, 10, 20, 50x. That also caps the max payout at 50x.
- **`IGame` doesn't fit as is.** It assumes exactly one winning outcome per round and one `payoutBps`. In Crash, every target at or below the crash point wins, and each pays a different amount. The contract needs something like `wins(seed, choice)` and `payoutBps(choice)`, or a Crash-specific path in `claim`. That's the backend's call.

### Why auto cash-out instead of a live button

1. **The crash point would be public.** Once the seed is on-chain, anyone can work out the crash point.
2. **Lag.** A live cash-out is a transaction. If it lands a block late, the player loses even though they clicked in time.

With auto cash-out, targets lock before the seed is requested. The climb is an animation, and settlement uses the crash point and each player's target. It also removes the compulsive clicking that makes crash one of the most addictive formats.

The replay follows the same curve every round (about 2x at 1.4 s, 10x at 3.9 s, 100x at 6 s), and the chart's axes never depend on the crash point. If the speed or scale came from the crash point, a player could read the result off the chart before it finished. The net result, the win effects, and the screen shake all wait until the replay ends.

### Frontend

- **Target picker.** A slider or input, with win chance and payout shown live as it moves.
- **Multiplier display.** A big number and a rising curve. Animation only. The result is already settled.
- **Player list.** Each player's target, and whether they made it.
- **History.** Past crash points, with the "doesn't predict the next one" note.
- No auto-rebet and no instant next round.

---

## 3. Beauty Contest

A skill game. No randomness needed.

### Rules

- Every player pays a fixed entry fee into a pot.
- Each player picks a whole number from 0 to 100.
- The target is **two-thirds of the average** of all guesses.
- Whoever is closest to the target wins the pot, minus a 2% fee. Ties split it.
- A round needs at least 3 players. If it doesn't fill, entries are refunded.

### Why it's interesting

If everyone guessed at random, the average would be around 50, so you'd guess 33. But if everyone thinks that, you'd guess 22. And so on down toward 0. Real groups usually land in the teens or twenties. The game is about guessing how many steps ahead everyone else is thinking. Keynes used this idea to describe the stock market.

### Commit and reveal

Everything on-chain is public. If guesses went in plainly, the last player could read them all and pick the winner. So guesses go in two stages:

1. **Commit.** Each player submits a hash of their guess plus a secret salt.
2. **Reveal.** After commits close, each player sends their guess and salt. The contract checks it matches the hash.

Players who don't reveal lose their entry. The frontend stores the salt locally and reveals for the player.

### Fit with the contract

This doesn't fit `BlockCasino`'s round model. It has no seed, a pot instead of house payouts, and two phases. It's probably its own small contract with `commit`, `reveal`, and `settle`, timed by blocks.

### Frontend

- A number picker from 0 to 100.
- Stage display: commit, reveal, result.
- A reminder if the player hasn't revealed yet.
- **Result chart.** A dot plot of every guess, with the average and the two-thirds target marked.
- Past rounds showing where the target landed. Useful here since it's a skill game.

---

## 4. Block Walk

Players trade YES and NO shares on where a random walk ends up, and prices move as the walk plays out.

### Rules

- A marker starts at 0.
- Each step, it moves up 1 or down 1 with equal odds.
- A walk has **21 steps**. An odd number means it can't end on 0, so there are no ties.
- **YES** pays 100 chips if the marker ends above 0. **NO** pays 100 chips if it ends below 0.
- Players can trade at every step until the last one.

### Shares

- Any player can pay 100 chips to create a pair: 1 YES and 1 NO. One of them always pays 100, so a pair is always worth 100.
- Players trade those shares with each other. A YES price of 63 means the market thinks there's a 63% chance the walk ends above 0.
- Prices go from 1 to 99.

### Batch auction

Orders are collected during each step and cleared all at once, at one price.

- During a step, players submit buy and sell orders with a price and quantity.
- When the step ends, the contract finds the price where the most shares trade. Everyone who trades pays or gets that price.
- Unmatched orders can stay on for the next step or be canceled.

Why batch: the block leader picks the order of transactions inside a block. In a continuous market, getting in first is an edge. In a batch, it isn't. Budish, Cramton, and Shim (2015) make this argument for real stock markets.

### Fair value

If the marker is at `x` with `k` steps left, the fair YES price is the chance a `k`-step walk ends above `-x`. That's a binomial probability. So the game is mostly math and reading other players. A **learning mode** toggle can show the fair value line next to the market price.

### Randomness

Each step needs a random draw nobody knows ahead of time. The casino already makes one VRF seed per round, so **each walk step can be one casino round**:

- Step `k` uses `keccak256(roundSeed of round r + k, walkGameId)`. Up or down is that value mod 2.
- No extra VRF requests, and it keeps the "one seed per round" decision.
- A walk lasts 21 rounds. How long that takes depends on `roundLength`, which is still an open question.

### Fit with the contract

This is the biggest backend change: share minting, an order book, batch clearing, and settlement. It's probably its own contract that reads round seeds from `BlockCasino`.

### Frontend

- **Walk chart.** A live line of the marker's position, with the 0 line marked.
- **Price chart.** YES price over time. Learning mode adds the fair value line.
- **Order panel.** Buy or sell, YES or NO, price, quantity, and a cost preview.
- **Order book.** Open bids and asks at each price.
- **Clearing chart.** A supply and demand chart for each step showing where the price cleared.
- **Position panel.** Shares held, average cost, and current value.

### Edge cases

- No trades at a step. Price carries over.
- Thin markets. A house bot that quotes near fair value can fill the book. Label it clearly as a bot.

---

## Build order

1. **High / Low.** Done.
2. **Crash.** Closest to the existing round model. New parts are a game type on the backend, and the target picker and animation on the frontend.
3. **Beauty Contest.** Its own small contract with commit and reveal.
4. **Block Walk.** The biggest build: shares, order book, and batch clearing.

The frontend can build each game in sim mode first (`VITE_MODE=sim`) while the backend catches up.
