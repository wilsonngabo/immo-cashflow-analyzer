#!/usr/bin/env bash
# Run 5 parallel LBC scrapers — always via VPN. Stops existing containers, then fresh start.
# Requires NORDVPN_WIREGUARD_TOKEN in .env
# Usage: ./scripts/run_lbc_parallel.sh

set -e
cd "$(dirname "$0")/.."

if ! grep -q "NORDVPN_WIREGUARD_TOKEN" .env 2>/dev/null; then
    echo "[!] Add NORDVPN_WIREGUARD_TOKEN to .env"
    echo "    Get it: https://my.nordaccount.com/dashboard/nordvpn/ → Generate new token"
    exit 1
fi

COMPOSE="${DOCKER_COMPOSE_CMD:-docker-compose}"
if ! command -v $COMPOSE &>/dev/null; then
    COMPOSE="docker compose"
fi

echo "[run] Stopping existing NordVPN + scraper containers..."
$COMPOSE -f docker-compose.nordvpn-parallel.yml down

echo "[run] Starting 5 NordVPN workers (fresh) + parallel scrapers..."
$COMPOSE -f docker-compose.nordvpn-parallel.yml up -d nordvpn-1 nordvpn-2 nordvpn-3 nordvpn-4 nordvpn-5

echo "[run] Waiting 50s for VPN connections..."
sleep 50

# Run 5 scrapers in parallel (each connects to its nordvpn via network_mode: service)
$COMPOSE -f docker-compose.nordvpn-parallel.yml run --rm scraper-1 &
$COMPOSE -f docker-compose.nordvpn-parallel.yml run --rm scraper-2 &
$COMPOSE -f docker-compose.nordvpn-parallel.yml run --rm scraper-3 &
$COMPOSE -f docker-compose.nordvpn-parallel.yml run --rm scraper-4 &
$COMPOSE -f docker-compose.nordvpn-parallel.yml run --rm scraper-5 &

wait
echo "[run] All 5 scrapers finished."
echo "[run] Stopping NordVPN containers..."
$COMPOSE -f docker-compose.nordvpn-parallel.yml down
echo "[run] Done."
