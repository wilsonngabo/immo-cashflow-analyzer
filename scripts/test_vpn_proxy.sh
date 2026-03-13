#!/usr/bin/env bash
# Quick test: VPN proxy connectivity
# Run after: docker compose -f docker-compose.scraper-vpn.yml up -d
PROXY="http://127.0.0.1:8888"
echo "=== VPN Proxy Test ==="
echo "[1] Gluetun: $(docker ps --filter name=gluetun-scraper --format '{{.Status}}' 2>/dev/null || echo 'not running')"
echo "[2] Your IP (no proxy): $(curl -s --connect-timeout 5 https://api.ipify.org 2>/dev/null || echo '?')"
echo "[3] IP via proxy: $(curl -s --connect-timeout 10 -x "$PROXY" https://api.ipify.org 2>/dev/null || echo 'FAILED')"
echo "=== Done ==="
