#!/usr/bin/env bash
# Run LBC scraping for Normandie with Gluetun proxy VPN (Plex unaffected)
# NEVER uses personal IP — all traffic via VPN proxy
#
# Prerequisites:
#   1. cp .env.example .env && fill NORDVPN_USER, NORDVPN_PASSWORD
#   2. docker compose -f docker-compose.scraper-vpn.yml up -d
#   3. Wait for Gluetun to connect (~30s)
#
# Usage: ./scripts/run_lbc_normandie.sh

cd "$(dirname "$0")/.." || exit 1
export PYTHONUNBUFFERED=1
export SCRAPER_VPN_PROXY_MODE=1
export PIPELINE_REGION=Normandie
export PIPELINE_MODE=buy

PROXY="${SCRAPER_VPN_PROXY:-http://localhost:8888}"

echo "[run_lbc_normandie] LBC + Normandie + Gluetun proxy (never uses personal IP)"
echo "[run_lbc_normandie] Ensuring proxy is reachable..."

if ! curl -sf --connect-timeout 5 -x "$PROXY" https://api.ipify.org >/dev/null 2>&1; then
    echo "[!] FATAL: Proxy $PROXY not reachable. Start it first:"
    echo "    docker compose -f docker-compose.scraper-vpn.yml up -d"
    echo "    (wait ~30s for VPN to connect)"
    exit 1
fi

exec python3 -u scripts/pipeline.py --lbc-only
