# `.agents/` — Procedural Memory (Tier 4)

Project-level rules and skills for every agent working in this repo.
Mirrors §6 of the AgentOS-FS design (`ProceduralDB`).

```
.agents/
├── README.md                  ← this map
├── rules/                     ← always-on constraints (read before acting)
│   ├── coding-standards.md
│   └── security-policies.md
└── skills/                    ← one-click background skills (source of truth)
    └── vault-cleanup/SKILL.md     served by GET /api/skills, run via POST /api/skills
```

## Paper → project map

| Paper (§6)                     | Here                                                        |
|--------------------------------|-------------------------------------------------------------|
| `.agents/rules/`               | this dir (global + project rules)                           |
| `.agents/skills/*/SKILL.md`    | skill registry — parsed live by `src/lib/skills.ts`         |
| `.agent_state/`                | kernel state (JSON stores, task logs, `a_fs.db`, `branches/`) |
| `.agent_brain/`                | vault root **and** episodic store (`<sessionId>/transcripts`) |
| `workspaces/`                  | Tier 3 WorkspacePool (per-agent isolated cwd)               |

## SKILL.md format

```md
---
name: Vault cleanup
icon: 🧹
blurb: Dedupe + organize brain vault
provider: hermes
---
<body — the single self-contained step prompt. {brain} = vault root.>
```

One step per skill: task steps run as isolated CLI calls with no shared
context, so the body must be fully self-contained.
