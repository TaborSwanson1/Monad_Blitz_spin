# Monad_blitz_gamble
stim stim stim 

Block Casino Demo
A play-money casino demo built on the Monad testnet. Players bet on rounds that are timed by Monad blocks, and they watch the chain live while each round plays out.

This is a demo. It runs on testnet only and uses play money with no real-world value. There are no deposits, no withdrawals to real currency, and no way to buy chips. It's a portfolio and learning project about smart contracts, on-chain randomness, and interface design.

What it does
Rounds open and close on a fixed block schedule.
Players place bets with free testnet chips.
Each round's result comes from verifiable randomness, so anyone can check it was fair.
A live visualizer shows Monad blocks as they're produced, so the chain itself is part of the show.
Why the outcome doesn't come straight from block data
The first version of this idea was to bet directly on properties of the next block, like its transaction count or the last digit of its hash. That turns out to be easy to cheat.

Block property	Who can influence it	How
Transaction count	Any user	Send a bunch of cheap transactions to push it over a line
Gas used	Any user	Same as above
Base fee up or down	Any user	It follows gas used, so same problem
Block hash	The block leader	Reorder transactions until the hash comes out the way they want
Timestamp	The block leader	Set it anywhere inside the allowed range
If a payout is worth more than the cost of cheating, someone will cheat. So this demo uses blocks as the clock and the theme, and gets the actual random result from a verifiable random function (VRF).

How a round works
Open. A round opens at block N. Players can place bets.
Lock. Betting closes at block N + L. The contract rejects any bet after that, no matter what the front end shows.
Request. The contract asks the randomness provider for a random number.
Settle. The random number arrives, the contract works out the result, and winners get paid in play chips.
Verify. Anyone can check the random number's proof and the payout math on-chain.
Rounds run every R blocks instead of every block. Monad blocks come in under a second, which is too fast to follow, and a short wait builds anticipation.

Games
These are the planned games. Each one maps a random number to an outcome with stated odds.

Game	What you bet on	Payout	House edge
High / Low	Result is above or below 50 (out of 0 to 99)	1.96x	2%
Exact Digit	Last digit of the result (0 to 9)	9.8x	2%
Block Race	Which of 4 colored lanes "wins" the round	3.92x	2%
The odds and house edge are shown on screen before every bet. Since it's play money, the house edge is there to make the demo realistic.

Design principles
The interface is meant to be exciting without using the tricks that make real gambling products harmful.

What we do

Show odds and house edge plainly.
Show net result for the session, not just current balance.
Use a live block visualizer as the main source of excitement.
Space rounds out so each one has a build-up.
Let players set a session time limit and a chip loss limit.
Show a reality check every so often with time played and net result.
What we avoid

Celebrating a "win" that pays back less than the bet.
Designing near misses on purpose.
Autoplay.
Fake "someone just won" tickers.
Countdown pressure on bonuses.
Hiding the result history's lack of meaning. Past rounds don't predict future ones, and the UI says so.
Tech stack
Part	Tool
Chain	Monad testnet
Contracts	Solidity, Foundry for building and testing
Randomness	A VRF provider that supports Monad testnet (Pyth Entropy is the first one to check)
Front end	TBD (React and viem are a likely fit)
Chips	A plain ERC-20 with a free faucet. No real value and no way to buy it.
Check Monad's and the randomness provider's docs for current chain IDs, RPC URLs, and contract addresses before deploying. Those change.

Project layout
block-casino-demo/
├── contracts/        # Solidity contracts (rounds, games, chip token)
├── test/             # Foundry tests
├── script/           # Deploy scripts
├── frontend/         # Web app and block visualizer
└── README.md
Getting started
Placeholder. This fills in once the contracts and front end exist.

git clone <repo-url>
cd block-casino-demo
forge install
forge test
You'll need:

Foundry
A wallet set up for Monad testnet
Testnet MON from a faucet to pay gas
Roadmap
 Chip token and faucet
 Round contract with open, lock, and settle stages
 VRF integration
 High / Low game
 Tests for timing, settlement, and payout math
 Live block visualizer
 Session limits and reality checks
 Exact Digit and Block Race games
Disclaimer
This project is for learning and demonstration only. It runs on testnet with play money that can't be bought, sold, or cashed out. It isn't a gambling service, and nothing here should be deployed with real funds.

License
TBD. MIT is a common choice for a demo like this.


