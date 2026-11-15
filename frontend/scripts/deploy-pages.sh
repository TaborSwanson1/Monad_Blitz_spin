#!/bin/sh
# Builds the sim-mode demo and publishes it to the gh-pages branch, which GitHub
# Pages serves at https://taborswanson1.github.io/Monad_blitz_gamble/
#
# Sim mode only: no wallet, no contracts, play chips in the browser.
# Run from frontend/:  npm run deploy:pages
set -eu

cd "$(dirname "$0")/.."

REMOTE_URL=$(git remote get-url origin)
COMMIT=$(git rev-parse --short HEAD)

# Relative asset paths so the site works under /Monad_blitz_gamble/.
# VITE_MODE=sim wins over any local .env, so a chain-mode .env can't leak in.
VITE_MODE=sim npx vite build --base=./ --outDir dist-pages --emptyOutDir

# Pages runs Jekyll by default, which skips some files. This turns it off.
touch dist-pages/.nojekyll

TMP=$(mktemp -d)
cp -R dist-pages/. "$TMP"
rm -rf dist-pages

cd "$TMP"
git init -q
git checkout -q -b gh-pages
git add -A
git -c user.name="$(git -C "$OLDPWD" config user.name)" -c user.email="$(git -C "$OLDPWD" config user.email)" \
  commit -q -m "Deploy sim demo from main@$COMMIT"
git push -q -f "$REMOTE_URL" gh-pages
cd - >/dev/null
rm -rf "$TMP"

echo "Deployed main@$COMMIT to gh-pages. Live in about a minute:"
echo "https://taborswanson1.github.io/Monad_blitz_gamble/"
