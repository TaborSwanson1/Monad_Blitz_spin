# @block-casino/wallet

Wallet connection and every casino action, for any frontend. No UI and no framework: you get state you can subscribe to, and async actions that throw readable errors. It's built for the lobby (Zander) and the game screens (Tabor, Lucas).

- **Finds every installed wallet** (EIP-6963: MetaMask, Rabby, Phantom, Coinbase…), plus a `window.ethereum` fallback.
- **Connects and switches the wallet to Monad Testnet**, adding the network to the wallet if it doesn't know it.
- **Follows the wallet:** account switches, network switches and disconnects update the state.
- **Reconnects silently** on page load if the player connected before.
- **Casino actions:** free chips, approve, bet, request settlement, claim, refund, plus reads for balances, rounds and the player's bets.
- **Typed from the real contract ABIs** (`backend/exports/abis.ts`).

Tested end to end against the real contracts on a local chain (`cd backend && npm run test:wallet`).

## Install (frontend)

```jsonc
// frontend/package.json
"dependencies": {
  "@block-casino/wallet": "file:../backend/wallet"
}
```

```ts
// frontend/vite.config.ts: use one copy of viem for the app and the SDK
export default defineConfig({ plugins: [react()], resolve: { dedupe: ['viem'] } })
```

`dist/` is committed, so `npm install` is enough. You don't need a backend build. If the backend changes the SDK, `git pull` and `npm install` again.

## Setup

```ts
import { createWalletSession } from '@block-casino/wallet'

const session = createWalletSession({
  deployment: {
    chainId: Number(import.meta.env.VITE_CHAIN_ID),     // 10143 testnet, 31337 local
    rpc: import.meta.env.VITE_RPC_HTTP,
    contracts: {
      blockCasino: import.meta.env.VITE_CASINO_ADDRESS,
      chipToken: import.meta.env.VITE_CHIP_ADDRESS,
    },
  },
})
```

The values come from `backend/exports/<network>/frontend.env`:

- **Local, available now:** `cd backend && FUND=0xYourAddress npm run dev`, then `cp backend/exports/local/frontend.env frontend/.env`. MetaMask needs network `http://127.0.0.1:8545`, chain `31337`. `FUND` gives your address local MON for gas.
- **Testnet, after the first deploy:** `backend/exports/monad-testnet/frontend.env` will be committed.

## Connect in one call

```ts
try {
  const { address } = await session.connectWallet()
} catch (e) {
  if (e.code === 'CHOOSE_WALLET') showPicker(e.wallets)  // several wallets installed
  else showToast(e.message)                               // e.g. "No wallet found. Install…"
}
```

`connectWallet()` does the whole flow:

1. **Already connected on the right chain?** Returns at once.
2. **Connected before?** Reconnects silently to the last-used wallet. No popup.
3. **Otherwise** it picks a wallet: `prefer`, then the last-used one, then the only one installed. If there are several, it calls your `pick()`, or throws `CHOOSE_WALLET` with `e.wallets`. Then it opens the wallet's popup and switches or adds Monad Testnet.

Options, all optional:

```ts
await session.connectWallet({
  prefer: 'io.metamask',                         // use this wallet if installed
  pick: async (wallets) => await openPicker(wallets),  // your picker; return null to cancel
  wallets,                                        // skip discovery if you already have the list
  discoveryMs: 400,                               // how long to wait for wallets to announce
})
```

The same call works on page load (silent reconnect) and on a "Connect wallet" button click. Use the step-by-step flow below only if you want full control.

## Connect flow, step by step

```ts
import { watchWallets, type DiscoveredWallet } from '@block-casino/wallet'

// 1. List wallets for a picker. Updates as wallets announce themselves.
const stop = watchWallets((wallets: DiscoveredWallet[]) => render(wallets))
//    each: wallet.info.name, wallet.info.icon (data URI for <img>), wallet.info.rdns

// 2. On page load, try a silent reconnect (no popup).
await session.reconnect(wallets)

// 3. When the player clicks a wallet:
try {
  await session.connect(wallet)     // popup → account → switches/adds Monad Testnet
} catch (e) {
  showToast(e.message)              // e is a WalletError, message is player-ready
}

// 4. Keep the UI in sync.
const unsubscribe = session.subscribe((s) => {
  s.status    // 'disconnected' | 'connecting' | 'connected' | 'wrong-network'
  s.address   // 0x… or null
  s.wallet    // { name, icon, rdns } of the wallet in use
  s.chainId   // the wallet's chain right now
})

// 5. Wrong network (the player switched in their wallet): offer a button.
await session.switchNetwork()

// 6. Log out of the site.
session.disconnect()
```

React, in a few lines:

```tsx
function useWalletState(session: WalletSession) {
  return useSyncExternalStore(session.subscribe, session.getState)
}
```

## Reads (no wallet needed, except your own balances and bets)

| Call | Returns |
|---|---|
| `session.config()` | `{ genesisBlock, roundLength, bettingWindow, settleTimeout, minBet, maxBet }` |
| `session.balances()` | `{ mon, chips, allowance }`, all bigint with 18 decimals. `mon` pays for gas. |
| `session.faucetAvailableAt()` | Unix seconds when free chips are available again (`0n` = now) |
| `session.round(roundId)` | `{ status: 'none' \| 'requested' \| 'settled' \| 'expired', seed, totalStaked }` |
| `session.myBets(roundId)` | The player's bets in a round, to restore them after a reload |
| `session.settlementFee()` | VRF fee in MON wei (≈0.124 MON on testnet) |

## Actions (each opens the wallet)

| Call | What it does |
|---|---|
| `session.getChips()` | Free 1,000 CHIP, once a day |
| `session.placeBet(gameId, choice, amount)` | Bets on the current round. Asks for approval first, the first time only (an extra popup). Returns `{ hash, roundId, betIndex }`, read from the contract's event. |
| `session.requestSettlement(roundId)` | Asks Pyth for the round's random result. The caller pays the fee. A keeper will normally do this. |
| `session.claim(roundId, betIndex)` | Pays out a settled bet. Returns `{ won, payout }`. Losing bets close with 0. |
| `session.refund(roundId, betIndex)` | Returns the stake if the round never got its result within the timeout |
| `session.approveChips()` | Explicit approve, if you want it as its own step |

Amounts are bigint with 18 decimals: use `parseEther('10')` from viem for 10 CHIP.

## Errors

Everything throws `WalletError`. `e.message` can be shown to players as is, and `e.code` is for logic:

| `code` | When |
|---|---|
| `NO_WALLET` | Not connected, or (from `connectWallet`) no wallet installed |
| `CHOOSE_WALLET` | `connectWallet()` found several wallets and has no `pick`. `e.wallets` lists them for a picker. |
| `USER_REJECTED` | The player said no in their wallet. Usually show nothing, or a quiet note. |
| `WRONG_NETWORK` | The wallet is on another chain. Offer `switchNetwork()`. |
| `INSUFFICIENT_GAS` | Not enough MON. Link `MON_FAUCET_URL`. |
| `FAUCET_COOLDOWN` | Free chips already claimed today. `e.args[0]` is when they're available again. |
| `BETTING_CLOSED` | The round locked before the bet landed. The bet was **not** placed. |
| `BAD_BET` | Unknown game, bad choice, or amount outside min/max |
| `NOT_ENOUGH_CHIPS` | Chip balance too low |
| `NOT_SETTLED`, `NOT_LOCKED`, `NO_BETS`, `ALREADY_DONE`, `NOT_REFUNDABLE` | Round-timing cases for settle, claim and refund |
| `UNKNOWN` | Anything else. `e.cause` has the original error. |

Each action simulates the call first, so contract errors show up **before** the wallet popup, not after the player has signed.

## Rules that still apply (CLAUDE.md)

Testnet and play chips only. Show odds and the 2% edge before a bet, and show the session's net result. Results come from the VRF, never from block data.

## Developing the SDK (backend)

```bash
cd backend
npm run wallet:build     # src/ → dist/ (commit dist/)
npm run test:wallet      # builds, starts anvil on :8546, deploys, runs the e2e tests
```

`test:wallet` rewrites `deployments/31337.json`. `npm run dev` regenerates it on its next start.
