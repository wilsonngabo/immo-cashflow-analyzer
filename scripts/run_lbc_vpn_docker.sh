#!/usr/bin/env bash
# Run LBC pipeline through NordVPN using tmknight/docker-nordvpn
# Requires NORDVPN_WIREGUARD_TOKEN in .env (from Nord Account → Generate new token)
# Plex unaffected — scraper runs in isolated container
#
# Usage: ./scripts/run_lbc_vpn_docker.sh

cd "$(dirname "$0")/.." || exit 1

if ! grep -q "NORDVPN_WIREGUARD_TOKEN" .env 2>/dev/null; then
    echo "[!] Add NORDVPN_WIREGUARD_TOKEN to .env"
    echo "    Get it: https://my.nordaccount.com/dashboard/nordvpn/ → Generate new token"
    exit 1
fi

echo "[run] Starting NordVPN + pipeline (Normandie)..."
docker-compose -f docker-compose.nordvpn.yml run --rm scraper
