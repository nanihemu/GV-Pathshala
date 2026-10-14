#!/usr/bin/env bash
# Creates a PRIVATE repository under your GitHub account and pushes this project to it.
# Usage:  ./scripts/push-to-github.sh [repo-name]
set -euo pipefail

OWNER="nanihemu"
REPO="${1:-gv-pathshala}"
cd "$(dirname "$0")/.."

if [ ! -d .git ]; then
  git init -b main
fi
git add -A
if ! git rev-parse HEAD >/dev/null 2>&1; then
  git commit -m "Initial commit: GV Pathshala LMS with AI tutor, generators, analyzer and recommendations"
fi

if command -v gh >/dev/null 2>&1; then
  # Needs a one-time login first:  gh auth login
  gh repo create "$OWNER/$REPO" --private --source=. --remote=origin --push
  echo "Done: https://github.com/$OWNER/$REPO"
else
  cat <<MSG
The GitHub CLI (gh) is not installed. Do this instead:

  1. Open https://github.com/new
  2. Owner: $OWNER   Repository name: $REPO   Visibility: Private
     Leave "Add a README", .gitignore and license UNCHECKED
  3. Then run:

     git remote add origin https://github.com/$OWNER/$REPO.git
     git push -u origin main

Git will ask you to sign in. Use a personal access token as the password if you have two-factor sign-in on.
MSG
fi
