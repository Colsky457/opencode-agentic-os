#!/bin/sh
# ◈ AgenticOS one-command setup:  git clone <repo> && cd <repo> && ./setup.sh
# POSIX sh. Installs deps, builds, and launches. The web wizard (/setup)
# handles providers, vault path, and host/port on first run.
set -e

say() { printf '◈ %s\n' "$1"; }
die() { printf '✗ %s\n' "$1" >&2; exit 1; }

command -v node >/dev/null 2>&1 || die "node 20+ required — https://nodejs.org"
NODE_MAJOR=$(node -p "process.versions.node.split('.')[0]")
[ "$NODE_MAJOR" -ge 20 ] || die "node 20+ required (found $(node --version))"

if command -v bun >/dev/null 2>&1; then
  PM="bun"
elif command -v npm >/dev/null 2>&1; then
  PM="npm"
else
  die "need bun or npm — https://bun.sh or https://nodejs.org"
fi
RUN="$PM run"

say "package manager: $PM ($(command -v $PM))"

if [ ! -d node_modules ]; then
  say "installing dependencies…"
  INSTALLED=0
  if [ "$PM" = "bun" ]; then
    (bun install && touch .install-ok) || say "bun install stumbled — falling back to npm…"
    if [ -f .install-ok ]; then INSTALLED=1; else PM="npm"; RUN="npm run"; fi
    rm -f .install-ok
  fi
  if [ "$INSTALLED" -eq 0 ]; then
    npm install || die "dependency install failed"
  fi
  say "installed via $PM"
else
  say "dependencies present, skipping install"
fi

if [ ! -d .next ]; then
  say "building (one-time, a few minutes on small machines)…"
  $RUN build || die "build failed — ensure network access for fonts, then retry"
else
  say "build present, skipping (delete .next to rebuild)"
fi

if [ -f os.config.json ]; then
  say "os.config.json found — launching"
else
  say "no os.config.json — the setup wizard will appear on first open"
fi

say "starting… (Ctrl+C to stop)"
exec $RUN start
