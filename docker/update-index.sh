#!/bin/bash
# Daily Zoekt index update script
# Add to crontab: 0 2 * * * /path/to/update-index.sh >> /var/log/zoekt-update.log 2>&1

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=== Zoekt Index Update $(date) ==="

# Run mirror to update repos
echo "Mirroring repositories..."
docker compose -f docker-compose.prod.yml --profile mirror run --rm zoekt-mirror

# Run indexer
echo "Re-indexing repositories..."
docker compose -f docker-compose.prod.yml --profile index run --rm zoekt-indexer

# Restart webserver to pick up new index
echo "Restarting webserver..."
docker compose -f docker-compose.prod.yml restart zoekt-webserver

echo "=== Index update complete $(date) ==="
