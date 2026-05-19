#!/bin/bash
# Push current branch to origin using $GITHUB_TOKEN (set via .claude/settings.local.json).
# Usage: bash .claude/push.sh [branch]
set -e

if [[ -z "$GITHUB_TOKEN" ]]; then
  echo "Error: GITHUB_TOKEN is not set. Add it to .claude/settings.local.json." >&2
  exit 1
fi

BRANCH="${1:-$(git rev-parse --abbrev-ref HEAD)}"
REPO="aneeq101/matchday_v3"

git remote set-url origin "https://${GITHUB_TOKEN}@github.com/${REPO}.git"
git push -u origin "$BRANCH"
git remote set-url origin "https://github.com/${REPO}.git"

echo "Pushed '$BRANCH' and cleared token from remote URL."
