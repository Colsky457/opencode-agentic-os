#Requires -Version 5.1
# ◈ AgenticOS one-command setup (Windows):  git clone <repo>; cd <repo>; .\setup.ps1
$ErrorActionPreference = "Stop"

function Say($m) { Write-Host "◈ $m" }

if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw "node 20+ required — https://nodejs.org" }
$major = [int](node -p "process.versions.node.split('.')[0]")
if ($major -lt 20) { throw "node 20+ required (found $(node --version))" }

if (Get-Command bun -ErrorAction SilentlyContinue) { $pm = "bun" }
elseif (Get-Command npm -ErrorAction SilentlyContinue) { $pm = "npm" }
else { throw "need bun or npm" }
Say "package manager: $pm"

if (-not (Test-Path node_modules)) { Say "installing dependencies…"; & $pm install }
else { Say "dependencies present, skipping install" }

if (-not (Test-Path .next)) { Say "building…"; & $pm run build }
else { Say "build present, skipping (delete .next to rebuild)" }

if (Test-Path os.config.json) { Say "os.config.json found — launching" }
else { Say "no os.config.json — the setup wizard will appear on first open" }

Say "starting… (Ctrl+C to stop)"
& $pm run start
