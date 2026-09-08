import { spawn, type ChildProcess } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import { WORKSPACES_DIR } from "./store";
import { loadConfigSync, providerBin } from "./config";
// NOTE: runtime-only import (used inside startAgentTask); runners.ts likewise
// only uses this module's pure functions at runtime. Deferred cycle is safe.
import { formatDoneLine, getRunner, type RunMeta } from "./runners";

export function CLAUDE_BIN(): string {
  const cfg = loadConfigSync();
  return providerBin(cfg, "claude");
}

export async function claudeVersion(): Promise<string | null> {
  return new Promise((resolve) => {
    const p = spawn(CLAUDE_BIN(), ["--version"], { timeout: 15000, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    p.stdout.on("data", (d) => (out += d.toString()));
    p.on("error", () => resolve(null));
    p.on("close", () => resolve(out.trim().slice(0, 60) || null));
  });
}

export interface ClaudeRunOptions {
  prompt: string;
  model?: string;
  systemPrompt?: string;
  resumeSessionId?: string;
  cwd?: string;
  signal?: AbortSignal;
  onLine?: (line: string) => void;
}

/** Extract incremental assistant text from a stream-json line. */
export function extractDelta(line: string): string {
  try {
    const evt = JSON.parse(line);
    if (evt.type === "assistant" && evt.message?.content) {
      let text = "";
      for (const block of evt.message.content) {
        if (block.type === "text_delta" && typeof block.text === "string") text += block.text;
        else if (block.type === "text" && typeof block.text === "string") {
          // full-content re-emits: caller dedupes by tracking length; safest to ignore here
        }
      }
      return text;
    }
    // content_block_delta shape
    if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta") {
      return evt.delta.text ?? "";
    }
    return "";
  } catch {
    return "";
  }
}

export interface ClaudeResultMeta {
  sessionId: string | null;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  durationMs: number;
  isError: boolean;
  errorText: string | null;
}

/** Parse the final `result` event line. */
export function parseResult(line: string): ClaudeResultMeta | null {
  try {
    const evt = JSON.parse(line);
    if (evt.type !== "result") return null;
    const usage = evt.usage ?? {};
    return {
      sessionId: evt.session_id ?? null,
      inputTokens: usage.input_tokens ?? 0,
      outputTokens: usage.output_tokens ?? 0,
      costUsd: evt.total_cost_usd ?? 0,
      durationMs: evt.duration_ms ?? 0,
      isError: Boolean(evt.is_error),
      errorText: evt.is_error ? String(evt.result ?? "Claude error").slice(0, 500) : null,
    };
  } catch {
    return null;
  }
}

/**
 * Spawn `claude -p` in stream-json mode. Resolves with result metadata.
 * Streams raw lines to onLine for SSE forwarding.
 */
export function runClaudeStream(opts: ClaudeRunOptions): Promise<ClaudeResultMeta> {
  return new Promise((resolve, reject) => {
    const args = ["-p", opts.prompt, "--output-format", "stream-json", "--verbose"];
    if (opts.model) args.push("--model", opts.model);
    if (opts.systemPrompt) args.push("--append-system-prompt", opts.systemPrompt);
    if (opts.resumeSessionId) args.push("--resume", opts.resumeSessionId);
    args.push("--permission-mode", loadConfigSync().chat.permissionMode || "dontAsk");
    args.push("--include-partial-messages");

    const child = spawn(CLAUDE_BIN(), args, {
      cwd: opts.cwd ?? process.cwd(),
      env: { ...process.env, TERM: "dumb", NO_COLOR: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let buffer = "";
    let lastResult: ClaudeResultMeta | null = null;
    let stderr = "";

    const kill = () => {
      try {
        child.kill("SIGTERM");
      } catch {}
    };
    opts.signal?.addEventListener("abort", kill, { once: true });

    child.stdout.on("data", (d) => {
      buffer += d.toString();
      const parts = buffer.split("\n");
      buffer = parts.pop() ?? "";
      for (const line of parts) {
        const t = line.trim();
        if (!t) continue;
        opts.onLine?.(t);
        const r = parseResult(t);
        if (r) lastResult = r;
      }
    });
    child.stderr.on("data", (d) => (stderr += d.toString()));

    child.on("error", (err) => {
      reject(new Error(`Failed to launch Claude CLI: ${err.message}`));
    });
    child.on("close", (code) => {
      if (buffer.trim()) {
        opts.onLine?.(buffer.trim());
        const r = parseResult(buffer.trim());
        if (r) lastResult = r;
      }
      if (lastResult) return resolve(lastResult);
      if (code !== 0) {
        return resolve({
          sessionId: null,
          inputTokens: 0,
          outputTokens: 0,
          costUsd: 0,
          durationMs: 0,
          isError: true,
          errorText: stderr.slice(0, 500) || `Claude exited with code ${code}`,
        });
      }
      resolve({
        sessionId: null,
        inputTokens: 0,
        outputTokens: 0,
        costUsd: 0,
        durationMs: 0,
        isError: false,
        errorText: null,
      });
    });
  });
}

// ---------- Agent process registry (in-memory + log files) ----------
interface RunningAgent {
  proc: ChildProcess;
  startedAt: number;
  task: string;
}

const running = new Map<string, RunningAgent>();

export function agentWorkspace(id: string) {
  const dir = path.join(WORKSPACES_DIR(), id);
  return dir;
}

export async function appendLog(agentId: string, text: string) {
  const dir = agentWorkspace(agentId);
  await fs.mkdir(dir, { recursive: true });
  await fs.appendFile(path.join(dir, "agent.log"), text + "\n", "utf8");
}

export async function readLog(agentId: string, maxBytes = 20000): Promise<string> {
  try {
    const p = path.join(agentWorkspace(agentId), "agent.log");
    const stat = await fs.stat(p);
    const start = Math.max(0, stat.size - maxBytes);
    const fh = await fs.open(p, "r");
    const buf = Buffer.alloc(stat.size - start);
    await fh.read(buf, 0, buf.length, start);
    await fh.close();
    return buf.toString("utf8");
  } catch {
    return "";
  }
}

export function isAgentRunning(id: string) {
  const r = running.get(id);
  return r ? !r.proc.killed && r.proc.exitCode === null : false;
}

export function runningPids(): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  for (const [id, r] of running) out[id] = r.proc.pid ?? null;
  return out;
}

export async function startAgentTask(agent: {
  id: string;
  name: string;
  systemPrompt?: string;
  model?: string;
  task: string;
  provider?: string;
}): Promise<{ pid: number | null }> {
  if (isAgentRunning(agent.id)) throw new Error("Agent already running");
  const runner = getRunner(agent.provider);
  const cwd = agentWorkspace(agent.id);
  await fs.mkdir(cwd, { recursive: true });
  await appendLog(agent.id, `\n━━━ [${new Date().toLocaleTimeString()}] ${agent.name} (${runner.label}): ${agent.task} ━━━`);

  const args = runner.taskArgs(agent.task, { model: agent.model, systemPrompt: agent.systemPrompt, cwd });

  const proc = spawn(runner.bin(), args, {
    cwd,
    env: { ...process.env, TERM: "dumb", NO_COLOR: "1" },
    stdio: ["ignore", "pipe", "pipe"],
    detached: false,
  });

  running.set(agent.id, { proc, startedAt: Date.now(), task: agent.task });
  const startedAt = Date.now();
  const seen = new Map<string, string>();
  let rawOut = "";
  let stderr = "";
  let lastResult: RunMeta | null = null;
  let errorLogged = false;

  proc.stdout.on("data", async (d) => {
    const text = d.toString();
    rawOut += text;
    for (const line of text.split("\n")) {
      const t = line.trim();
      if (!t) continue;
      const { delta, result } = runner.parseTaskLine(t, seen);
      if (delta) await appendLog(agent.id, delta);
      if (result) {
        lastResult = result;
        if (result.isError && result.errorText && !errorLogged) {
          errorLogged = true;
          await appendLog(agent.id, `\n[ERROR] ${result.errorText}`);
        }
      }
    }
  });
  proc.stderr.on("data", async (d) => {
    stderr += d.toString();
    await appendLog(agent.id, `[stderr] ${d.toString().slice(0, 500)}`);
  });
  proc.on("close", async (code) => {
    running.delete(agent.id);
    try {
      const fin = await runner.finishTask({ rawOut, stderr, code, cwd, lastResult, startedAt });
      if (fin.delta) await appendLog(agent.id, fin.delta);
      const final = fin.result ?? lastResult;
      if (final) {
        if (final.isError) {
          if (!errorLogged && final.errorText) await appendLog(agent.id, `\n[ERROR] ${final.errorText}`);
        } else {
          if (!final.durationMs) final.durationMs = Date.now() - startedAt;
          await appendLog(agent.id, formatDoneLine(final));
        }
      } else {
        await appendLog(agent.id, `\n[${code === null ? "stopped" : `process exited code=${code}`}]`);
      }
    } catch {
      await appendLog(agent.id, `\n[${code === null ? "stopped" : `process exited code=${code}`}]`);
    }
  });

  return { pid: proc.pid ?? null };
}

export async function stopAgentTask(agentId: string): Promise<boolean> {
  const r = running.get(agentId);
  if (!r) return false;
  try {
    r.proc.kill("SIGTERM");
    await appendLog(agentId, "\n[stopped by operator]");
    setTimeout(() => {
      try {
        if (r.proc.exitCode === null) r.proc.kill("SIGKILL");
      } catch {}
    }, 4000);
    running.delete(agentId);
    return true;
  } catch {
    return false;
  }
}
