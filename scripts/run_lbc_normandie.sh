#!/usr/bin/env bash
# Run LBC scraping for Normandie with Gluetun proxy VPN (Plex unaffected)
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

echo "[run_lbc_normandie] LBC + Normandie + Gluetun proxy (Plex unaffected)"
echo "[run_lbc_normandie] Ensure Gluetun scraper is running: docker compose -f docker-compose.scraper-vpn.yml up -d"
echo ""

exec python3 -u scripts/pipeline.py --lbc-only
