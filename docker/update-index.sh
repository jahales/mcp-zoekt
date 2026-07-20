#!/bin/bash
# Daily Zoekt index update: mirror + re-index the configured GITHUB_ORGS, then
# reload the webserver so searches see fresh code.
#
# Scheduled via a launchd agent (see com.zoekt.index-update.plist.example) rather
# than cron: launchd runs the job on the next wake if the Mac was asleep at the
# scheduled time, which cron does not do.

set -eu -o pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# launchd starts jobs with a minimal PATH; make sure docker is resolvable.
export PATH="/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin:${PATH:-}"

# Prevent overlapping runs (a slow mirror must not collide with the next fire).
LOCK_DIR="/tmp/zoekt-update.lock"
if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  echo "=== Zoekt Index Update $(date): another run holds $LOCK_DIR; skipping ==="
  exit 0
fi
trap 'rmdir "$LOCK_DIR" 2>/dev/null || true' EXIT

echo "=== Zoekt Index Update $(date) ==="

# On wake, Docker Desktop may still be starting; wait up to ~5 min for the daemon.
echo "Waiting for Docker daemon..."
for i in $(seq 1 60); do
  if docker info >/dev/null 2>&1; then
    break
  fi
  if [ "$i" -eq 60 ]; then
    echo "ERROR: Docker daemon not available after 5 min; aborting." >&2
    exit 1
  fi
  sleep 5
done

# -p docker pins the compose project so we reuse the existing zoekt-data volume
# and the already-running webserver.
COMPOSE="docker compose -p docker -f docker-compose.prod.yml"

echo "Mirroring repositories..."
if ! $COMPOSE --profile mirror run --rm zoekt-mirror; then
  echo "ERROR: mirror failed (expired token / no network?); skipping re-index so we don't rebuild from a stale checkout." >&2
  exit 1
fi

echo "Re-indexing repositories..."
$COMPOSE --profile index run --rm zoekt-indexer

echo "Restarting webserver to pick up the new index..."
$COMPOSE restart zoekt-webserver

echo "=== Index update complete $(date) ==="
