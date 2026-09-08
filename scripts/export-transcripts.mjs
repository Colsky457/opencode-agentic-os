// One-shot export: sessions.json → .agent_brain/<id>/{transcript.jsonl, transcript_full.jsonl}.
// Re-runnable: rewrites both files purely from sessions.json. Run: node scripts/export-transcripts.mjs
import { promises as fs } from "fs";
import { readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function stateDir() {
  try {
    const cfg = JSON.parse(readFileSync(path.join(root, "os.config.json"), "utf8"));
    const p = cfg.paths?.data ?? "./.agent_state";
    return path.resolve(root, p.replace(/^~\//, process.env.HOME + "/"));
  } catch {
    return path.join(root, ".agent_state");
  }
}

function brainDir() {
  try {
    const cfg = JSON.parse(readFileSync(path.join(root, "os.config.json"), "utf8"));
    const p = cfg.paths?.brain ?? "./.agent_brain";
    return path.resolve(root, p.replace(/^~\//, (process.env.HOME ?? "~") + "/"));
  } catch {
    return path.join(root, ".agent_brain");
  }
}

const compact = (c) => (c.length > 2000 ? `${c.slice(0, 2000)}…[truncated ${c.length - 2000} chars]` : c);

const sessions = JSON.parse(await fs.readFile(path.join(stateDir(), "sessions.json"), "utf8").catch(() => "[]"));
let n = 0;
for (const s of sessions) {
  const dir = path.join(brainDir(), s.id);
  await fs.mkdir(path.join(dir, "artifacts"), { recursive: true });
  await fs.mkdir(path.join(dir, "scratch"), { recursive: true });
  const header = { kind: "session", id: s.id, title: s.title, agentId: s.agentId, model: s.model, provider: s.provider, createdAt: s.createdAt };
  const slim = [header];
  const full = [header];
  for (const m of s.messages ?? []) {
    if (m.role === "system") continue;
    const base = { ts: m.ts, role: m.role, kind: "message", tokens: m.tokens ?? null };
    slim.push({ ...base, content: compact(String(m.content ?? "")) });
    full.push({ ...base, content: String(m.content ?? "") });
  }
  await fs.writeFile(path.join(dir, "transcript.jsonl"), slim.map((o) => JSON.stringify(o)).join("\n") + "\n", "utf8");
  await fs.writeFile(path.join(dir, "transcript_full.jsonl"), full.map((o) => JSON.stringify(o)).join("\n") + "\n", "utf8");
  n++;
}
console.log(`exported ${n} sessions`);
