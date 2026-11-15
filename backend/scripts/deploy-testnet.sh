#!/usr/bin/env bash
# Deploy to Monad testnet with real Pyth Entropy, then export for the frontend.
#   cd backend && npm run deploy:testnet
# Needs a funded keystore account (once):  cast wallet import monad-deployer --interactive
# Foundry asks for the keystore password in this terminal. The key never touches a file or the repo.
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="$HOME/.foundry/bin:$PATH"
RPC=${MONAD_TESTNET_RPC:-https://testnet-rpc.monad.xyz}
ACCOUNT=${DEPLOYER_ACCOUNT:-monad-deployer}

[ "$(cast chain-id --rpc-url "$RPC")" = "10143" ] || { echo "RPC $RPC is not Monad testnet (10143)"; exit 1; }
cast wallet list 2>/dev/null | grep -q "^$ACCOUNT" || {
  echo "No keystore account '$ACCOUNT'. Create it once with: cast wallet import $ACCOUNT --interactive"; exit 1; }

forge script script/Deploy.s.sol --rpc-url "$RPC" --account "$ACCOUNT" --broadcast
node scripts/export.mjs 10143
node scripts/check-seam.mjs || true
echo
echo "Commit backend/deployments/10143.json and backend/exports/monad-testnet/ so the frontend team gets the addresses."
