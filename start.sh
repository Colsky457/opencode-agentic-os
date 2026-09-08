#!/bin/sh
# ◈ AgenticOS quick start:  ./start.sh
# Production server only — no install, no rebuild. First run: ./setup.sh
# Also ensures machine services are up: 9router (:20128, localhost-only),
# Hermes gateway (default profile), Hermes dashboard (:9119).
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
LOGDIR="$ROOT/logs"
# Overridable device paths:
NINE_ROUTER_BIN="${NINE_ROUTER_BIN:-/data/data/com.termux/files/usr/lib/node_modules/9router/cli.js}"
HERMES_BIN="${HERMES_BIN:-hermes}"

say() { printf '◈ %s\n' "$1"; }
warn() { printf '⚠ %s (continuing anyway)\n' "$1"; }
die() { printf '✗ %s\n' "$1" >&2; exit 1; }

[ -d "$ROOT/node_modules" ] || die "no node_modules — run ./setup.sh first"
[ -d "$ROOT/.next" ] || die "no build found — run ./setup.sh first"
mkdir -p "$LOGDIR"

if command -v bun >/dev/null 2>&1; then
  PM="bun"
elif command -v npm >/dev/null 2>&1; then
  PM="npm"
else
  die "need bun or npm"
fi

# poll $1 (url) until it answers or $2 seconds pass
wait_for() {
  i=0
  while [ "$i" -lt "$2" ]; do
    if curl -sf -m 5 -o /dev/null "$1" 2>/dev/null; then return 0; fi
    sleep 5
    i=$((i + 5))
  done
  return 1
}

ensure_9router() {
  if curl -sf -m 5 -o /dev/null http://127.0.0.1:20128/dashboard 2>/dev/null; then
    say "9router already running"
    return 0
  fi
  say "starting 9router (localhost-only)…"
  setsid nohup node "$NINE_ROUTER_BIN" --tray --skip-update -p 20128 --host 127.0.0.1 \
    >>"$LOGDIR/9router.log" 2>&1 < /dev/null &
  if wait_for http://127.0.0.1:20128/dashboard 60; then
    say "9router is up"
  else
    warn "9router did not answer within 60s — it boots slowly, check /router later"
  fi
}

ensure_gateway() {
  out=$(timeout 30 "$HERMES_BIN" gateway status 2>&1 || true)
  case "$out" in
    *"is not running"*) ;;
    *) say "gateway already running (or status unclear — leaving alone)"; return 0 ;;
  esac
  say "starting Hermes gateway (default profile)…"
  setsid nohup "$HERMES_BIN" gateway run \
    >>"$HOME/.hermes/logs/gateway.log" 2>&1 < /dev/null &
  sleep 15
  out=$(timeout 30 "$HERMES_BIN" gateway status 2>&1 || true)
  case "$out" in
    *"is not running"*) warn "gateway still down — see ~/.hermes/logs/gateway.log" ;;
    *) say "gateway is up" ;;
  esac
}

ensure_dashboard() {
  if ! timeout 30 "$HERMES_BIN" dashboard --status 2>&1 | grep -q "No hermes dashboard"; then
    say "Hermes dashboard already running"
    return 0
  fi
  say "starting Hermes dashboard (warms up slowly — watch /hermesdash)…"
  setsid nohup "$HERMES_BIN" dashboard --no-open \
    >>"$LOGDIR/hermes-dashboard.log" 2>&1 < /dev/null &
}

ensure_9router
ensure_gateway
ensure_dashboard

say "starting OS… (Ctrl+C stops the OS only; services keep running — see ./stop.sh)"
exec $PM run start
