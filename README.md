# ◈ AgenticOS — Mission Control

[![Next.js](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org/)
[![Tailwind](https://img.shields.io/badge/Tailwind-v4-38bdf8)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)

Beautiful local operating system for managing **AI CLIs** (Hermes, Antigravity, opencode, Claude Code…) + an AI agent fleet.
Next.js 16 · Tailwind v4 · Framer Motion · localhost only.

## Screenshots

> Coming soon — PRs with screenshots/GIFs welcome.

## One-command start

```bash
git clone https://github.com/Colsky457/opencode-agentic-os.git && cd opencode-agentic-os
./setup.sh
# → opens at http://127.0.0.1:3000 (or your configured host:port)
```

`setup.sh` checks node 20+, installs deps (bun → npm fallback), builds once,
and launches. On first open the **setup wizard** appears: it auto-detects
installed AI CLIs, asks for your vault path (default `~/brain`), and checks
your host/port. Windows: `.\setup.ps1`.

Prerequisites: **node 20+** and at least one AI CLI (e.g. `npm install -g
@anthropic-ai/claude-code`). No CLI? The wizard lets you continue into
**demo mode** — the whole OS stays explorable with zero quota burn.

## Configuration

Everything lives in **`os.config.json`** (created by the wizard; gitignored —
share `os.config.example.json` instead). Env vars override the file:

| Setting | File key | Env |
|---|---|---|
| Host / port | `server.host`, `server.port` | `OS_HOST`, `OS_PORT` |
| Brain vault | `paths.brain` | `BRAIN_DIR` |
| Data / workspaces | `paths.data`, `paths.workspaces` | — |
| Default provider + bins | `providers.*` | `CLAUDE_BIN` |
| Chat models, permission mode | `chat.*` | — |
| Theme, demo mode | `ui.*` | — |

Re-run the wizard anytime: Settings → **re-run setup**.

## AI providers

The wizard probes for `claude`, `codex`, `gemini`, `opencode`, `hermes`,
and `agy` (Antigravity) (`--version` check) and shows install hints for
missing ones. Fully driven today (chat + fleet runs + usage ledger):

| CLI | Mode | Notes |
|---|---|---|
| ✦ Claude Code | `claude -p … --output-format stream-json` | live token streaming, session resume |
| ⬡ opencode | `opencode run … --format json` | live JSON-event streaming, session continue |
| ☿ Hermes | `hermes -z … --usage-file` | one-shot: thinks whole, then answers; tokens/cost from usage report |
| ◈ Antigravity | `agy -p … --output-format stream-json` | deep-research specialist, session resume |

`codex` / `gemini` are detected but stubbed ("support coming soon") until a
runner ships (`src/lib/runners.ts` is the seam — implement `Runner` + register).

## What's inside

| App | Route | What it does |
|---|---|---|
| Command | `/` | Mission overview, fleet status, spend |
| AI Chat | `/chat` | Streams your default provider, history, personas, model picker |
| Agents | `/agents` | Avatar grid → per-agent sections (`/agents/[id]`: overview, console, files, settings) + **real local processes** (run/stop, pid, live log console, isolated `workspaces/<id>/`) |
| Goals | `/goals` | Missions with status/due/notes — auto-saved to brain |
| Journal | `/journal` | Daily log with moods — auto-saved to brain |
| Memory Graph | `/graph` | Shared memory nodes, keyword auto-link, chats feed it automatically |
| Prompts | `/prompts` | Template library, 1-click copy → chat |
| Files | `/files` | Workspace browser + editor, jailed to `workspaces/` |
| Usage | `/usage` | Token/cost charts + call ledger |
| Hermes Board | `/hermesdash` | Embedded Hermes web console (`:9119`) with start/stop |
| Router | `/router` | Embedded 9router gateway dashboard (`:20128`) — models, keys, routing |
| Guide | `/guide` | 📖 Build-your-own manual: fast track + 6-lesson course, mirrored to vault |
| Digest | `/digest` | 🌙 Nightly note: 8pm Hermes summary of chats/goals/journal → vault |
| Settings | `/settings` | Provider detection, CLI health, theme, demo mode, re-run setup |

OS chrome: boot sequence, ⌘K command palette, logo nav drawer, desktop dock, particle field, dark/light.

Every agent gets a **generative SVG avatar** (deterministic from its id —
gradient anchored on its color, 6 geometric motifs + initial; 🎲 shuffle in
agent Settings). Avatars appear in the fleet, chat bubbles, session rail,
persona switcher, palette, and command deck.

Chat is messenger-grade: URL-synced threads (`/chat?s=…&agent=…`), grouped
bubbles with timestamps + date dividers, typing indicator, auto-growing
composer (↵ send / ⇧↵ newline), copy / regenerate / save-as-prompt actions,
scroll-to-latest FAB, and per-agent side channels.

**Voice dictation** 🎙 — every text field has a mic button powered by the
browser's built-in Web Speech API: **no API keys, no server, no cost**.
Tap → speak → words stream in as text (live interim caption, tap again to
stop). Invisible on browsers without speech recognition (e.g. Firefox).
Requires a secure context — `http://127.0.0.1` qualifies, so local use works.

## 🧠 Second brain (auto-save)

The wizard asks where your vault lives (default `~/brain`). Everything lands
in `<vault>/Agentic OS/` as plain markdown (Obsidian-friendly, frontmatter included):

- **Chats** → `Chats/YYYY-MM-DD/HH-MM-<title>.md` — one file per chat, rewritten
  after every exchange with the full transcript
- **Goals** → `Goals.md` — `- [ ]` / `- [x]` checkbox task lists grouped
  Active / Done / Archived, due dates included (Obsidian Tasks compatible),
  re-synced on every change
- **Journal** → `Journal/YYYY-MM-DD.md` — entries appended under `## HH:MM`
- **Daily Notes** → `Daily Notes/YYYY-MM-DD.md` — nightly digest (see below)

## 🌙 Nightly Digest (8pm, written by Hermes)

Every day at 8pm device-local time, Hermes reads the day's chats, goals, and
journal and writes one note to `<vault>/Agentic OS/Daily Notes/YYYY-MM-DD.md`
(Highlights / Chats / Goals / Journal / Tomorrow, ~400 words).

- **Trigger**: a Hermes cron job (`agentic-digest`, `0 20 * * *`) that pokes
  `POST /api/digest/run`. Install it from the Digest page (`/digest` →
  "Install 8pm schedule") — it writes `~/.hermes/scripts/nightly-digest.sh`
  and creates the job. Pause/resume/fire-now live there too.
- **Reliability**: Hermes is retried 3× with backoff, then the fallback provider writes the
  note instead (marked `author: <provider> (fallback)`). Same date rewrites the
  same file — never duplicates. Run history in `data/digest.json`.
- **Tuning**: `os.config.json` → `digest: { enabled, time, noteDir, maxChars, retries, fallback }`.
- **Caveat**: if the phone dozes at 8pm, Hermes fires the tick late — the note
  still lands, just timestamped late.

## How the provider bridge works

Each AI CLI gets a `Runner` in `src/lib/runners.ts` (e.g. `claude -p "<prompt>"
--output-format stream-json`, `agy -p … --output-format stream-json`,
`hermes -z … --usage-file`). Streaming CLIs pipe stdout lines to the browser
as SSE; the final event yields session + token/cost usage, which is logged
and graphed. One-shot CLIs (Hermes) think whole, then answer.

Agents reuse the same bridge as detached processes with per-agent `cwd` +
`agent.log`. Stop = SIGTERM (then SIGKILL fallback).

## Troubleshooting

- **No os.config.json / fresh clone** → the app redirects to `/setup` automatically.
- **Port in use** → wizard checks availability; or set another port and restart.
- **Provider API errors (e.g. 402 quota)** → surfaced inline in chat with a
  one-tap demo-mode fallback; top up the budget pool to resume live inference.
- **Mic missing** → needs Chrome/Edge/Safari + secure context (`127.0.0.1` OK).
- **Android/Termux** → use `bun`, builds force `--webpack` (Turbopack has no
  android/arm64 bindings) — already wired into `npm run build`.

## Stack

Next.js 16 · React 19 · Tailwind v4 · Framer Motion · Zustand · Recharts · `react-force-graph-2d`

## Contributing

Issues and PRs welcome. Run `npm run lint` before pushing.

## License

MIT — see [LICENSE](./LICENSE).

## Safety

Localhost-bound by default, files jailed to `workspaces/` (403 on `..`
escapes), memory in `./data/*.json`. Agents run as your user — review tasks
before deploying.
