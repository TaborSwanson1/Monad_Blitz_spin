#!/usr/bin/env bash
# One command for a full local backend the frontend can play against:
#   cd backend && npm run dev
#   FUND=0xYourMetaMaskAddress npm run dev     also gives that address 1,000 local MON for gas
#
# Starts anvil (1 block/s) → deploys with MockRandomness → exports frontend.env + ABIs
# → checks the seam → runs the keeper that settles rounds. Ctrl+C stops everything.
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="$HOME/.foundry/bin:$PATH"
RPC=http://127.0.0.1:8545

command -v anvil >/dev/null || { echo "Foundry not found. Install it: https://getfoundry.sh"; exit 1; }
if cast chain-id --rpc-url "$RPC" >/dev/null 2>&1; then
  echo "Something is already running on $RPC. Stop it first (or close the other 'npm run dev')."
  exit 1
fi
[ -d node_modules ] || npm install --silent

echo "▸ starting anvil (1 block per second)"
anvil --block-time 1 > .anvil.log 2>&1 &
ANVIL_PID=$!
trap 'echo; echo "▸ stopping anvil"; kill $ANVIL_PID 2>/dev/null || true' EXIT INT TERM
for _ in $(seq 1 50); do cast chain-id --rpc-url "$RPC" >/dev/null 2>&1 && break; sleep 0.2; done

SENDER=$(cast rpc eth_accounts --rpc-url "$RPC" | node -e 'process.stdin.on("data",d=>console.log(JSON.parse(d)[0]))')

echo "▸ deploying (MockRandomness; rounds ${ROUND_LENGTH:-20} blocks, betting ${BETTING_WINDOW:-12})"
ROUND_LENGTH=${ROUND_LENGTH:-20} BETTING_WINDOW=${BETTING_WINDOW:-12} SETTLE_TIMEOUT=${SETTLE_TIMEOUT:-300} \
  forge script script/Deploy.s.sol --rpc-url "$RPC" --broadcast --unlocked --sender "$SENDER" --silent

for a in ${FUND//,/ }; do
  cast rpc anvil_setBalance "$a" 0x3635C9ADC5DEA00000 --rpc-url "$RPC" >/dev/null && echo "▸ funded $a with 1,000 local MON"
done

echo "▸ exporting for the frontend"
node scripts/export.mjs 31337
echo "▸ checking the frontend ↔ backend seam"
node scripts/check-seam.mjs || echo "  (drift above: the frontend may need an update. Note it in docs/TEAM_CONTEXT.md)"

cat <<EOF

────────────────────────────────────────────────────────────────────
 Local backend is up. To play against it from the frontend:
   cp backend/exports/local/frontend.env frontend/.env
   cd frontend && npm run dev
 MetaMask: add network  RPC http://127.0.0.1:8545  chain ID 31337  symbol MON
 (Start with FUND=0xYourAddress npm run dev to get local MON for gas.)
────────────────────────────────────────────────────────────────────
EOF
node scripts/local-keeper.mjs
