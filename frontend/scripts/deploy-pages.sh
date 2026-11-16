#!/bin/sh
# Builds the demo and publishes it to the gh-pages branch, which GitHub Pages serves at
# https://taborswanson1.github.io/Monad_Blitz_spin/
#
# Two versions, linked to each other from the top bar:
#   /       the real app on Monad testnet: MetaMask, the deployed contracts, Pyth results.
#           Players pay their own gas and Pyth fee. Chips are free play chips.
#   /sim/   the simulator: no wallet, play chips in the browser.
# The on-chain version reads its addresses from backend/exports/monad-testnet/frontend.env
# (committed by `npm run deploy:testnet`), never from your local .env.
# Run from frontend/:  npm run deploy:pages
set -eu

cd "$(dirname "$0")/.."

REMOTE_URL=$(git remote get-url origin)
COMMIT=$(git rev-parse --short HEAD)
TESTNET_ENV=../backend/exports/monad-testnet/frontend.env
[ -f "$TESTNET_ENV" ] || { echo "Missing $TESTNET_ENV. Deploy to testnet first (cd backend && npm run deploy:testnet)."; exit 1; }

rm -rf dist-pages

# On-chain version at the root. Variables set here win over any local .env.
(
  set -a
  . "$TESTNET_ENV"
  set +a
  VITE_MODE=chain VITE_OTHER_MODE_URL=./sim/ npx vite build --base=./ --outDir dist-pages --emptyOutDir
)

# Simulator at /sim/. Same addresses, so a connected wallet still shows its balances.
(
  set -a
  . "$TESTNET_ENV"
  set +a
  VITE_MODE=sim VITE_OTHER_MODE_URL=../ npx vite build --base=./ --outDir dist-pages/sim --emptyOutDir
)

# Pages runs Jekyll by default, which skips some files. This turns it off.
touch dist-pages/.nojekyll

if [ "${PAGES_DRY_RUN:-}" = "1" ]; then
  echo "Dry run: built into frontend/dist-pages, nothing published."
  exit 0
fi

TMP=$(mktemp -d)
cp -R dist-pages/. "$TMP"
rm -rf dist-pages

cd "$TMP"
git init -q
git checkout -q -b gh-pages
git add -A
git -c user.name="$(git -C "$OLDPWD" config user.name)" -c user.email="$(git -C "$OLDPWD" config user.email)" \
  commit -q -m "Deploy on-chain app and simulator from main@$COMMIT"
git push -q -f "$REMOTE_URL" gh-pages
cd - >/dev/null
rm -rf "$TMP"

echo "Deployed main@$COMMIT to gh-pages. Live in about a minute:"
echo "  On Monad testnet: https://taborswanson1.github.io/Monad_Blitz_spin/"
echo "  Simulator:        https://taborswanson1.github.io/Monad_Blitz_spin/sim/"
