#!/usr/bin/env bash
# Run only the 5 scrapers — assumes NordVPN containers are already running.
# Use this when "up" fails with permission denied (containers started with sudo).
#
# Usage: ./scripts/run_lbc_parallel_scrapers_only.sh

set -e
cd "$(dirname "$0")/.."

COMPOSE="${DOCKER_COMPOSE_CMD:-docker-compose}"
if ! command -v $COMPOSE &>/dev/null; then
    COMPOSE="docker compose"
fi

echo "[run] Starting 5 scrapers (VPN containers must already be running)..."

$COMPOSE -f docker-compose.nordvpn-parallel.yml run --rm scraper-1 &
$COMPOSE -f docker-compose.nordvpn-parallel.yml run --rm scraper-2 &
$COMPOSE -f docker-compose.nordvpn-parallel.yml run --rm scraper-3 &
$COMPOSE -f docker-compose.nordvpn-parallel.yml run --rm scraper-4 &
$COMPOSE -f docker-compose.nordvpn-parallel.yml run --rm scraper-5 &

wait
echo "[run] All 5 scrapers finished."
