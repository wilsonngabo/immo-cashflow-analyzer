#!/usr/bin/env bash
# Show how many listings have been scraped so far
# Usage: ./scripts/scrape_count.sh
cd "$(dirname "$0")/.."
exec python3 scripts/scrape_count.py
