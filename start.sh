#!/bin/sh
# ◈ AgenticOS quick start:  ./start.sh
# Production server only — no install, no rebuild. First run: ./setup.sh
set -e

say() { printf '◈ %s\n' "$1"; }
die() { printf '✗ %s\n' "$1" >&2; exit 1; }

[ -d node_modules ] || die "no node_modules — run ./setup.sh first"
[ -d .next ] || die "no build found — run ./setup.sh first"

if command -v bun >/dev/null 2>&1; then
  PM="bun"
elif command -v npm >/dev/null 2>&1; then
  PM="npm"
else
  die "need bun or npm"
fi

say "starting… (Ctrl+C to stop)"
exec $PM run start
