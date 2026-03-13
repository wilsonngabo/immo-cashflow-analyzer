#!/usr/bin/env bash
# Show logs from the 5 NordVPN containers
#
# Usage:
#   ./scripts/logs_nordvpn.sh          # last 50 lines from each
#   ./scripts/logs_nordvpn.sh -f       # follow in real time
#   ./scripts/logs_nordvpn.sh -n 100   # 100 lines per container
#   ./scripts/logs_nordvpn.sh 3        # logs from worker 3 only

cd "$(dirname "$0")/.."

FOLLOW=""
LINES="50"
WORKERS="1 2 3 4 5"

while [[ $# -gt 0 ]]; do
    case $1 in
        -f|--follow) FOLLOW="-f"; shift ;;
        -n) LINES="$2"; shift 2 ;;
        [1-5]) WORKERS="$1"; shift ;;
        *) shift ;;
    esac
done

if [[ -n "$FOLLOW" ]]; then
    # Follow: stream all workers in parallel with prefix
    for i in $WORKERS; do
        name="nordvpn-worker-$i"
        if docker ps -a --format '{{.Names}}' | grep -q "^${name}$"; then
            docker logs -f --tail="$LINES" "$name" 2>&1 | sed "s/^/[vpn$i] /" &
        fi
    done
    echo "Following NordVPN logs — Ctrl+C to stop"
    wait
else
    for i in $WORKERS; do
        name="nordvpn-worker-$i"
        if ! docker ps -a --format '{{.Names}}' | grep -q "^${name}$"; then
            echo "[skip] $name (container not found)"
            continue
        fi
        echo "========== $name =========="
        docker logs --tail="$LINES" "$name" 2>&1
        echo ""
    done
fi
