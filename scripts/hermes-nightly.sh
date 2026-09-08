#!/bin/sh
# agentic-digest trigger — invoked by `hermes cron` at 20:00 daily (--no-agent).
# Install: cp scripts/hermes-nightly.sh ~/.hermes/scripts/nightly-digest.sh
#   hermes cron create "0 20 * * *" --name agentic-digest \
#     --script nightly-digest.sh --no-agent
# All real logic lives in POST /api/digest/run (gather → Hermes → Claude fallback → vault).
set -e

HOST="${OS_HOST:-127.0.0.1}"
PORT="${OS_PORT:-3000}"

# allow os.config.json to override when reachable
if command -v node >/dev/null 2>&1; then
  CFG_HOST=$(node -e "try{console.log(require('./os.config.json').server.host)}catch(e){}" 2>/dev/null || true)
  CFG_PORT=$(node -e "try{console.log(require('./os.config.json').server.port)}catch(e){}" 2>/dev/null || true)
  [ -n "$CFG_HOST" ] && [ "$CFG_HOST" != "undefined" ] && HOST="$CFG_HOST"
  [ -n "$CFG_PORT" ] && [ "$CFG_PORT" != "undefined" ] && PORT="$CFG_PORT"
fi

curl -sf -m 570 -X POST "http://$HOST:$PORT/api/digest/run" \
  -H 'Content-Type: application/json' -d '{}' || echo "digest trigger failed (server down?)"
