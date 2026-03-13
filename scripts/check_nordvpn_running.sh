#!/usr/bin/env bash
# Check if NordVPN Docker containers are running
#
# Usage: ./scripts/check_nordvpn_running.sh

cd "$(dirname "$0")/.."

echo "NordVPN containers status:"
echo ""

RUNNING=0
for i in 1 2 3 4 5; do
  name="nordvpn-worker-$i"
  if docker ps --format '{{.Names}}' | grep -q "^${name}$"; then
    echo "  [RUNNING] $name"
    ((RUNNING++))
  elif docker ps -a --format '{{.Names}} {{.Status}}' | grep -q "^${name} "; then
    status=$(docker ps -a --filter "name=^${name}$" --format '{{.Status}}')
    echo "  [STOPPED] $name ($status)"
  else
    echo "  [----]    $name (not found)"
  fi
done

echo ""
if [[ $RUNNING -gt 0 ]]; then
  echo "$RUNNING NordVPN container(s) running."
else
  echo "No NordVPN containers running."
fi
