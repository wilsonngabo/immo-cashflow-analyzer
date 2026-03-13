#!/usr/bin/env bash
# Configure crontab to run the pipeline daily on the server.
# Uses GET /api/cron/pipeline so the Next.js app must be running.
#
# Usage: ./scripts/setup_schedule.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Default: call localhost (app runs on same machine)
BASE_URL="${PIPELINE_BASE_URL:-http://localhost:3000}"
SECRET="${CRON_SECRET:-}"

CRON_PATH="/api/cron/pipeline"
if [ -n "$SECRET" ]; then
    CRON_URL="${BASE_URL}${CRON_PATH}?secret=${SECRET}&mode=bienveo-only&no_vpn=1"
else
    CRON_URL="${BASE_URL}${CRON_PATH}?mode=bienveo-only&no_vpn=1"
    echo "[WARN] CRON_SECRET not set — cron will run without auth (only if app allows)"
fi

# Daily at 08:00
CRON_ENTRY="0 8 * * * curl -sf '${CRON_URL}' || true"

echo "Adding cron entry:"
echo "  $CRON_ENTRY"
echo ""

if crontab -l 2>/dev/null | grep -qF "$CRON_PATH"; then
    echo "[INFO] Cron entry for pipeline already exists."
    exit 0
fi

(crontab -l 2>/dev/null; echo "$CRON_ENTRY") | crontab -
echo "[OK] Cron configured. Ensure the Next.js app is running (pm2, systemd, or pnpm start)."
