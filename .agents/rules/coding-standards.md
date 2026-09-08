# Coding Standards (project rules)

Read before writing code in this repo. The laziest correct change wins.

1. **Smallest working diff.** Fewest files, shortest diff. No speculative
   abstractions (no interface with one implementation, no factory for one
   product, no config for a constant). No scaffolding "for later".
2. **Reuse first.** Check `src/lib/`, `src/components/os/`, and existing API
   routes before writing anything new. The `Runner` seam (`src/lib/runners.ts`)
   is how new AI CLIs plug in; `readJson`/`writeJson` (`src/lib/store.ts`) is
   how all JSON state persists.
3. **Reuse UI primitives.** `Card`, `Pill`, `SectionTitle`, `EmptyState`
   (`src/components/os/ui.tsx`), `AgentAvatar`, `renderMarkdown`
   (`src/components/chat/bits.tsx`). No new deps for what exists.
4. **Mobile is first-class.** Every page must fit 360px: `break-words` on all
   user content, `min-w-0` on truncated flex children, `flex-wrap` on rows,
   no fixed-pixel containers. Desktop (`md:`/`lg:`) must not regress.
5. **Verify like you mean it.** `tsc --noEmit` must be clean. Prefer live
   verification (curl the route, run the CLI) over reasoning. `npm run lint`
   is broken repo-wide (pre-existing) — don't chase it.
6. **Additive CSS only for fit fixes.** Wrap guards (`break-words`,
   `truncate`, `overflow-x-auto`) over layout restructuring.
7. **One runnable check for non-trivial logic.** Single `assert`-style
   self-check or one small test file. No frameworks unless asked.
8. **Never commit secrets.** `os.config.json`, `.agent_state/`,
   `.agent_brain/`, vaults, tokens, and `*.bak-*` stay out of git.
