#!/usr/bin/env bash
# Show logs from the 5 scraper workers (pipeline output: +X listings, progress, etc.)
# Scrapers run via NordVPN; this shows the scraper logs, not VPN logs.
#
# Usage:
#   ./scripts/logs_parallel.sh          # last 50 lines from each worker
#   ./scripts/logs_parallel.sh -f       # follow live (all 5 streams)
#   ./scripts/logs_parallel.sh -n 200   # 200 lines per worker
#   ./scripts/logs_parallel.sh 2        # worker 2 only

cd "$(dirname "$0")/.."
FOLLOW=""
LINES="50"
WORKERS=""

while [[ $# -gt 0 ]]; do
    case $1 in
        -f|--follow) FOLLOW="-f"; shift ;;
        -n) LINES="$2"; shift 2 ;;
        [1-5]) WORKERS="$WORKERS $1"; shift ;;
        *) shift ;;
    esac
done

# Find scraper run containers (scraper-1 through scraper-5)
# Names like: immo-cashflow-analyzer_scraper-1_run_xxx
get_containers() {
    for i in ${WORKERS:-1 2 3 4 5}; do
        docker ps --format '{{.Names}} {{.ID}}' | grep -E "scraper-${i}_run" | awk '{print $2}' | head -1
    done
}
CONTAINERS=($(get_containers))

if [[ ${#CONTAINERS[@]} -eq 0 ]]; then
    echo "No scraper workers running. Start with: ./scripts/run_lbc_parallel.sh"
    exit 0
fi

echo "Scraper logs (${#CONTAINERS[@]} workers) — tail=$LINES"
echo ""

if [[ -n "$FOLLOW" ]]; then
    i=1
    for c in "${CONTAINERS[@]}"; do
        [[ -n "$c" ]] || continue
        docker logs -f --tail="$LINES" "$c" 2>&1 | sed "s/^/[worker$i] /" &
        ((i++))
    done
    echo "Following scraper logs (Ctrl+C to stop)"
    wait
else
    i=1
    for c in "${CONTAINERS[@]}"; do
        [[ -n "$c" ]] || continue
        echo "========== Worker $i =========="
        docker logs --tail="$LINES" "$c" 2>&1
        echo ""
        ((i++))
    done
fi
