#!/usr/bin/env bash
# Run the web server in Docker
# Usage: ./scripts/run_server_docker.sh

set -e
cd "$(dirname "$0")/.."

COMPOSE="${DOCKER_COMPOSE_CMD:-docker-compose}"
if ! command -v $COMPOSE &>/dev/null; then
    COMPOSE="docker compose"
fi

PORT="${PORT:-3000}"
echo "[run] Starting server on port $PORT..."
$COMPOSE -f docker-compose.server.yml up -d --build

echo "[run] Server: http://localhost:$PORT"
echo "[run] Logs: $COMPOSE -f docker-compose.server.yml logs -f"
