#!/usr/bin/env bash
# Sample server run: dev server accessible from other devices on the network.
# For production, use PM2 or systemd (see SERVER_SETUP.md)
#
# Usage: ./scripts/start_server.sh
# Or:    PORT=3000 ./scripts/start_server.sh

cd "$(dirname "$0")/.."
PORT="${PORT:-3000}"
export HOSTNAME=0.0.0.0

# Load nvm/fnm if node not in PATH
if ! command -v node &>/dev/null; then
    [[ -s "$HOME/.nvm/nvm.sh" ]] && source "$HOME/.nvm/nvm.sh"
    [[ -s "$HOME/.local/share/fnm/fnm" ]] && eval "$("$HOME/.local/share/fnm/fnm" env)"
    [[ -d "$HOME/.fnm" ]] && export PATH="$HOME/.fnm/aliases/default/bin:$PATH"
fi

if ! command -v node &>/dev/null; then
    echo "[start_server] Error: Node.js not found. Install it:"
    echo "  - nvm: curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash"
    echo "  - or:  sudo apt install nodejs npm"
    exit 1
fi

if command -v pnpm &>/dev/null; then
    RUNNER="pnpm"
elif command -v npm &>/dev/null; then
    RUNNER="npm"
else
    echo "[start_server] Error: pnpm or npm required (npm run npm install -g pnpm)"
    exit 1
fi

echo "[start_server] Sample run — network accessible"
echo "[start_server] Using $RUNNER, port $PORT"
echo "[start_server] Access from this machine: http://localhost:$PORT"
echo "[start_server] Access from other devices: http://$(hostname -I 2>/dev/null | awk '{print $1}'):$PORT"
echo "[start_server] Starting dev server... (Ctrl+C to stop)"
exec $RUNNER run dev:sample
