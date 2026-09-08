import { promises as fs } from "fs";
import path from "path";
import { loadConfigSync, resolvePath } from "./config";
import type { ChatMessage, ChatSession } from "./store";

// AgentOS-FS §6 Tier 1: Episodic Execution Trace.
// `.agent_brain/<sessionId>/{transcript.jsonl (compact), transcript_full.jsonl (raw)}`

function brainRoot(): string {
  try {
    return resolvePath(loadConfigSync().paths.brain);
  } catch {
    return resolvePath("./.agent_brain");
  }
}

export function sessionDir(id: string): string {
  return path.join(brainRoot(), id);
}

function compact(content: string): string {
  return content.length > 2000 ? `${content.slice(0, 2000)}…[truncated ${content.length - 2000} chars]` : content;
}

function headerEvent(s: ChatSession) {
  return {
    kind: "session",
    id: s.id,
    title: s.title,
    agentId: s.agentId,
    model: s.model,
    provider: s.provider,
    createdAt: s.createdAt,
  };
}

/** Append one message to both transcript files (creates dir + header on first use). */
export async function appendTranscriptEvent(s: ChatSession, m: ChatMessage): Promise<void> {
  try {
    const dir = sessionDir(s.id);
    await fs.mkdir(path.join(dir, "artifacts"), { recursive: true });
    await fs.mkdir(path.join(dir, "scratch"), { recursive: true });
    const base = { ts: m.ts, role: m.role, kind: "message", tokens: m.tokens ?? null };
    const tPath = path.join(dir, "transcript.jsonl");
    try {
      await fs.stat(tPath);
    } catch {
      await fs.writeFile(tPath, `${JSON.stringify(headerEvent(s))}\n`, "utf8");
      await fs.writeFile(
        path.join(dir, "transcript_full.jsonl"),
        `${JSON.stringify(headerEvent(s))}\n`,
        "utf8"
      );
    }
    await fs.appendFile(tPath, `${JSON.stringify({ ...base, content: compact(m.content) })}\n`, "utf8");
    await fs.appendFile(
      path.join(dir, "transcript_full.jsonl"),
      `${JSON.stringify({ ...base, content: m.content })}\n`,
      "utf8"
    );
  } catch {}
}
