#!/bin/bash
# Daily Zoekt index update: mirror + re-index the configured GITHUB_ORGS (and
# GHE_ORGS on GHE_URL, if set), then reload the webserver so searches see fresh code.
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

# Retried because most failures are transient GitHub API errors (EOF, TLS handshake timeout)
# that a fresh attempt minutes later gets past; a run that fails every attempt still skips
# the re-index.
MIRROR_ATTEMPTS=3
MIRROR_RETRY_DELAY="${MIRROR_RETRY_DELAY:-120}"
# A host that accepts the connection but never answers would otherwise hold the run,
# and its lock, indefinitely.
MIRROR_TIMEOUT="${MIRROR_TIMEOUT:-10800}"
GHE_MIRROR_TIMEOUT="${GHE_MIRROR_TIMEOUT:-$MIRROR_TIMEOUT}"

# mirror PROFILE SERVICE TIMEOUT: run a mirror service, retrying until it succeeds or
# MIRROR_ATTEMPTS run out. An attempt still running after TIMEOUT s is stopped.
mirror() {
  local attempt=1 name pid watchdog rc
  while :; do
    name="$2-run-$$-$attempt"
    $COMPOSE --profile "$1" run --rm -T --name "$name" "$2" </dev/null &
    pid=$!
    # Chained with && rather than relying on set -e, which bash ignores under `if ! mirror`:
    # ending the sleep early must end the watchdog without a stop. stderr is dropped so
    # that ending it doesn't log a "Terminated" notice.
    {
      sleep "$3" && {
        echo "$2 attempt $attempt still running after $3 s; stopping it"
        docker stop "$name" >/dev/null
      }
    } 2>/dev/null &
    watchdog=$!
    rc=0
    wait "$pid" || rc=$?
    pkill -x -P "$watchdog" sleep 2>/dev/null || true
    wait "$watchdog" 2>/dev/null || true
    if [ "$rc" -eq 0 ]; then
      return 0
    fi
    if [ "$attempt" -ge "$MIRROR_ATTEMPTS" ]; then
      return 1
    fi
    echo "$2 attempt $attempt failed; retrying in $((attempt * MIRROR_RETRY_DELAY)) s..."
    sleep $((attempt * MIRROR_RETRY_DELAY))
    attempt=$((attempt + 1))
  done
}

echo "Mirroring repositories..."
if ! mirror mirror zoekt-mirror "$MIRROR_TIMEOUT"; then
  echo "ERROR: mirror failed $MIRROR_ATTEMPTS times (expired token / no network?); skipping re-index so we don't rebuild from a stale checkout." >&2
  exit 1
fi

# A GHE host may only be reachable over VPN, which is often down overnight. Its
# failure must not cost github.com its re-index; GHE repos re-index from their last fetch.
echo "Mirroring GitHub Enterprise repositories..."
if ! mirror mirror-ghe zoekt-mirror-ghe "$GHE_MIRROR_TIMEOUT"; then
  echo "WARN: GitHub Enterprise mirror failed $MIRROR_ATTEMPTS times (VPN down / expired token?); indexing its last fetch." >&2
fi

echo "Re-indexing repositories..."
$COMPOSE --profile index run --rm zoekt-indexer

echo "Restarting webserver to pick up the new index..."
$COMPOSE restart zoekt-webserver

echo "=== Index update complete $(date) ==="
