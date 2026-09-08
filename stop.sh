#!/bin/sh
# ◈ AgenticOS stop:  ./stop.sh
# Halts the OS production server plus the machine services start.sh manages.
# Reverse order of start.sh: OS → dashboard → gateway → 9router.
# Kills are scoped (repo cwd / exact argv) so other projects' servers survive.
ROOT="$(cd "$(dirname "$0")" && pwd)"
HERMES_BIN="${HERMES_BIN:-hermes}"
NINE_ROUTER_HOME="${NINE_ROUTER_HOME:-/data/data/com.termux/files/usr/lib/node_modules/9router/app}"

say() { printf '◈ %s\n' "$1"; }
warn() { printf '⚠ %s\n' "$1"; }

# kill PIDs from pgrep whose /proc cwd equals $1 (empty $1 = no cwd check)
kill_matching() { # $1=pattern $2=cwd-or-empty
  n=0
  for pid in $(pgrep -f "$1" 2>/dev/null); do
    if [ -n "$2" ]; then
      [ "$(readlink "/proc/$pid/cwd" 2>/dev/null)" = "$2" ] || continue
    fi
    if kill "$pid" 2>/dev/null; then n=$((n + 1)); fi
  done
  echo "$n"
}

# 1. OS production server (Next workers rooted here + the run.mjs wrapper)
n=$(kill_matching "next-server" "$ROOT")
n2=$(kill_matching "scripts/run.mjs start" "$ROOT")
say "os server: stopped $((n + n2)) process(es)"

# 2. Hermes dashboard (owns its own pids)
if timeout 60 "$HERMES_BIN" dashboard --stop >/dev/null 2>&1; then
  say "hermes dashboard: stopped"
else
  warn "hermes dashboard: stop command failed (maybe already down — check :9119)"
fi

# 3. Hermes gateway, default profile
if timeout 60 "$HERMES_BIN" gateway stop >/dev/null 2>&1; then
  say "hermes gateway: stopped"
else
  warn "hermes gateway: stop command failed (check \`hermes gateway status\`)"
fi

# 4. 9router tray + any orphaned inner server (scoped by argv/cwd)
n=$(kill_matching "9router/cli.js" "")
sleep 3
n2=$(kill_matching "next-server" "$NINE_ROUTER_HOME")
say "9router: stopped $((n + n2)) process(es)"

say "all quiet."
