#!/usr/bin/env bash
# Run Bienveo scraper with unbuffered output — run directly in terminal to see logs.
# Usage: ./scripts/run_bienveo.sh  or  bash scripts/run_bienveo.sh

cd "$(dirname "$0")/.." || exit 1
export PYTHONUNBUFFERED=1
export PIPELINE_MODE="${PIPELINE_MODE:-buy}"

echo "[run_bienveo] Starting Bienveo scraper (PIPELINE_MODE=$PIPELINE_MODE)..."
echo "[run_bienveo] Output will stream below. Press Ctrl+C to stop."
echo ""

exec python3 -u scripts/pipeline.py --bienveo-only --no-vpn
