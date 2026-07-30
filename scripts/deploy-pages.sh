#!/usr/bin/env bash
# Deploy the static export to GitHub Pages (gh-pages branch).
#
# Uses whatever GitHub auth already exists (gh CLI / credential helper).
# It never reads, prints or stores a token.
#
#   ./scripts/deploy-pages.sh
set -euo pipefail

REPO_SLUG="${REPO_SLUG:-deepusnath/techmyrmidons-web}"
BASE_PATH="${BASE_PATH:-/techmyrmidons-web}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$ROOT"

echo "→ validating content"
node scripts/validate-content.ts

echo "→ building with basePath=${BASE_PATH}"
NEXT_PUBLIC_BASE_PATH="$BASE_PATH" npx next build

# GitHub Pages runs Jekyll by default, which ignores _next/.
touch out/.nojekyll

SHA="$(git rev-parse --short HEAD)"
BRANCH="$(git rev-parse --abbrev-ref HEAD)"

echo "→ publishing out/ to gh-pages"
cd out
rm -rf .git
git init -q -b gh-pages
git add -A
git commit -q -m "deploy: TechMyrmidons pilot preview

Static export of ${BRANCH} @ ${SHA}.
Generated artifact — source lives on the ${BRANCH} branch."
git remote add origin "https://github.com/${REPO_SLUG}.git"
git push -q --force origin gh-pages

echo "✓ deployed → https://${REPO_SLUG%%/*}.github.io/${REPO_SLUG##*/}/"
