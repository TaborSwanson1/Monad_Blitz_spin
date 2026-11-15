# Front end

React + Vite + viem. A sci-fi console where live Monad blocks are the main stage.

```
npm install
cp .env.example .env
npm run dev
```

Game rules and the planned lineup are in [GAMES.md](GAMES.md).

## Modes

- `VITE_MODE=sim` (default): fake blocks every 400 ms, in-browser chips. Labeled
  SIMULATOR in the UI. Uses the same outcome math as the contract.
- `VITE_MODE=chain`: real Monad testnet. Needs the deployed `BlockCasino` and
  `ChipToken` addresses and a browser wallet.

## Layout

```
src/
├── lib/          games, round timing, outcome math, formatting (shared, pure)
├── client/       CasinoClient interface + sim and chain implementations
├── hooks/        useCasino (blocks, bets, settlement), useSession (net, limits)
└── components/   BlockStream, RoundHud, BetPanel, RevealOverlay, ...
```

Everything in the UI goes through `CasinoClient`, so sim and chain look the same.

## Design rules (from the root README)

- Odds, payout and the 2% house edge show before every bet.
- The session bar shows net result, not only balance.
- Reveal effects scale with the real net result. A losing round gets no fanfare.
- No near-miss framing, no autoplay, no fake win tickers.
- Session time and loss limits are on by default. Reality checks pop up every 15 minutes.
- History says plainly that past rounds don't predict the next one.
