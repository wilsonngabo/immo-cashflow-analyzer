#!/usr/bin/env bash
# Start the Next.js app on the server. For production, use PM2 or systemd (see SERVER_SETUP.md)
#
# Usage: ./scripts/start_server.sh
# Or:    PORT=3000 ./scripts/start_server.sh

cd "$(dirname "$0")/.."
PORT="${PORT:-3000}"

if command -v pnpm &>/dev/null; then
    RUNNER="pnpm"
elif command -v npm &>/dev/null; then
    RUNNER="npm"
else
    echo "[start_server] Error: pnpm or npm required"
    exit 1
fi

echo "[start_server] Using $RUNNER, port $PORT"
echo "[start_server] Run '${RUNNER} run build' first if not already built."
echo "[start_server] Starting... (Ctrl+C to stop)"
exec $RUNNER run start
