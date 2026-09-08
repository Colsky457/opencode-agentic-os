# Security Policies (project rules)

Hard boundaries. Never simplify these away.

1. **Localhost only.** Bind `127.0.0.1` by default. Nothing listens on LAN
   unless the operator explicitly forwards. No outbound calls except provider
   APIs and explicit user requests.
2. **Files API is jailed.** `src/app/api/files/route.ts` serves `workspaces/`
   only — `..` escapes return 403. Brain files go through
   `src/app/api/brain-file/route.ts`, jailed to the vault root, `.md`/`.txt`
   only. New file endpoints must copy the escape-guard pattern.
3. **Agents run as the operator's user.** Review tasks before deploying.
   Destructive skills default to approval gates (`requiresApproval`, `!`-steps
   pause in `/tasks`). Never auto-approve deletions of user content.
4. **Memory stays on this machine.** `./.agent_state/*.json`, transcripts,
   vault. Nothing leaves except provider API calls (prompts + usage ledger).
5. **Never touch the model gateway from the OS.** 9router (`:20128`) backs
   live provider traffic — no restart/stop controls, read-only embedding only.
6. **Vault writes are additive.** Chats rewrite their own file; journal
   appends; digests rewrite same-date files (never duplicates). Cleanup skills
   may merge/fix/organize but NEVER delete notes with real writing.
