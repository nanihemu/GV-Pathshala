#!/usr/bin/env bash
# Update the running site: pull the latest code from GitHub and rebuild.
# Run from the project folder on the server:   bash scripts/deploy.sh
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f .env ] || { echo "Missing .env. Create it with: cp .env.prod.example .env"; exit 1; }
git pull --ff-only
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps
