#!/usr/bin/env bash
# Deploy the drafts-hidden production export to GitHub Pages (gh-pages branch).
#
# This is the only supported way to publish. It builds with drafts hidden and
# refuses to push an export that still contains the editorial review tooling.
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

# Always the drafts-hidden production build. A plain `next build` leaves
# NEXT_PUBLIC_SHOW_DRAFTS unset, which makes next.config.ts discover the
# preview-only editorial review routes and emit them — that is how /review and
# /review/priority came to be publicly readable on Pages.
echo "→ building drafts-hidden production export with basePath=${BASE_PATH}"
NEXT_PUBLIC_BASE_PATH="$BASE_PATH" npm run build:production

# The build flag is the intent; this is the proof. Nothing is pushed until the
# artifact itself is clean.
echo "→ checking the export carries no editorial review tooling"
node scripts/check-production-artifacts.ts

# GitHub Pages runs Jekyll by default, which ignores _next/.
touch out/.nojekyll

SHA="$(git rev-parse --short HEAD)"
BRANCH="$(git rev-parse --abbrev-ref HEAD)"

echo "→ publishing out/ to gh-pages"
cd out
rm -rf .git
git init -q -b gh-pages
git add -A
git commit -q -m "deploy: TechMyrmidons pilot (drafts hidden)

Drafts-hidden production export of ${BRANCH} @ ${SHA}.
Editorial review routes are preview-only and are not present here.
Generated artifact — source lives on the ${BRANCH} branch."
git remote add origin "https://github.com/${REPO_SLUG}.git"
git push -q --force origin gh-pages

# Leave out/ as a plain export again. The throwaway repo is never published —
# `git add -A` cannot stage the .git it lives in — but its reflog records the
# committer's name, which is one of the reviewer identities the artifact checks
# search for. Left behind it makes `npm run check:production` fail on the next
# run for a reason that has nothing to do with the export.
rm -rf .git

echo "✓ deployed → https://${REPO_SLUG%%/*}.github.io/${REPO_SLUG##*/}/"
