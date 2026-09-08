import { spawn } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import { extractDelta, parseResult, CLAUDE_BIN, type ClaudeResultMeta } from "./claude";
import { loadConfigSync, providerBin } from "./config";
import { DATA_DIR } from "./store";

// NOTE: claude.ts imports getRunner from this module (used inside startAgentTask
// at runtime only). All cross-module uses here are likewise runtime-only, so the
// deferred ESM cycle is safe.

export interface ChatOpts {
  prompt: string;
  model?: string;
  systemPrompt?: string;
  resumeSessionId?: string;
  cwd?: string;
  signal?: AbortSignal;
  onDelta: (text: string) => void;
}

export interface RunMeta {
  sessionId: string | null;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  durationMs: number;
  isError: boolean;
  errorText: string | null;
}

export interface FinishInfo {
  rawOut: string;
  stderr: string;
  code: number | null;
  cwd: string;
  lastResult: RunMeta | null;
  startedAt: number;
}

export interface Runner {
  id: string;
  label: string;
  glyph: string;
  color: string;
  supportsStreaming: boolean;
  bin(): string;
  version(): Promise<string | null>;
  chat(opts: ChatOpts): Promise<RunMeta>;
  /** argv (excluding bin) for a detached fleet task */
  taskArgs(task: string, o: { model?: string; systemPrompt?: string; cwd: string }): string[];
  /** per-line parse for fleet logs; seen threads per-part state */
  parseTaskLine(line: string, seen: Map<string, string>): { delta?: string; result?: RunMeta };
  /** close-time resolution: usage files, whole-answer CLIs, DONE/ERROR synthesis */
  finishTask(info: FinishInfo): Promise<{ delta?: string; result?: RunMeta | null }>;
}

function versionOf(bin: string): Promise<string | null> {
  return new Promise((resolve) => {
    const p = spawn(bin, ["--version"], { timeout: 15000, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    p.stdout.on("data", (d) => (out += d.toString()));
    p.on("error", () => resolve(null));
    p.on("close", () => resolve(out.trim().split("\n")[0].slice(0, 60) || null));
  });
}

function toRunMeta(m: ClaudeResultMeta): RunMeta {
  return { ...m };
}

function emptyMeta(): RunMeta {
  return { sessionId: null, inputTokens: 0, outputTokens: 0, costUsd: 0, durationMs: 0, isError: false, errorText: null };
}

export function exitLabel(code: number | null): string {
  return code === null ? "stopped" : `exited with code ${code}`;
}

// ---------------- Claude ----------------
const claudeRunner: Runner = {
  id: "claude",
  label: "Claude Code",
  glyph: "✦",
  color: "#ff6b1a",
  supportsStreaming: true,
  bin: () => CLAUDE_BIN(),
  version: () => versionOf(CLAUDE_BIN()),
  chat(opts) {
    return new Promise<RunMeta>((resolve, reject) => {
      const startedAt = Date.now();
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
      opts.signal?.addEventListener("abort", () => { try { child.kill("SIGTERM"); } catch {} }, { once: true });

      child.stdout.on("data", (d) => {
        buffer += d.toString();
        const parts = buffer.split("\n");
        buffer = parts.pop() ?? "";
        for (const line of parts) {
          const t = line.trim();
          if (!t) continue;
          const delta = extractDelta(t);
          if (delta) opts.onDelta(delta);
          const r = parseResult(t);
          if (r) lastResult = r;
        }
      });
      child.stderr.on("data", (d) => (stderr += d.toString()));
      child.on("error", (err) => reject(new Error(`Failed to launch Claude CLI: ${err.message}`)));
      child.on("close", (code) => {
        if (buffer.trim()) {
          const delta = extractDelta(buffer.trim());
          if (delta) opts.onDelta(delta);
          const r = parseResult(buffer.trim());
          if (r) lastResult = r;
        }
        const durationMs = Date.now() - startedAt;
        if (lastResult) return resolve({ ...toRunMeta(lastResult), durationMs: lastResult.durationMs || durationMs });
        if (code !== 0) {
          return resolve({ ...emptyMeta(), durationMs, isError: true, errorText: stderr.slice(0, 500) || `Claude exited with code ${code}` });
        }
        resolve({ ...emptyMeta(), durationMs });
      });
    });
  },
  taskArgs(task, o) {
    const args = ["-p", task, "--output-format", "stream-json", "--verbose"];
    if (o.model) args.push("--model", o.model);
    if (o.systemPrompt) args.push("--append-system-prompt", o.systemPrompt);
    args.push("--permission-mode", loadConfigSync().chat.permissionMode || "dontAsk");
    return args;
  },
  parseTaskLine(line, _seen) {
    const delta = extractDelta(line) || undefined;
    const r = parseResult(line);
    return { delta, result: r ? toRunMeta(r) : undefined };
  },
  async finishTask(info) {
    if (info.lastResult) return { result: info.lastResult };
    if (info.code !== 0) {
      return { result: { ...emptyMeta(), durationMs: Date.now() - info.startedAt, isError: true, errorText: info.stderr.slice(0, 500) || `Claude ${exitLabel(info.code)}` } };
    }
    return { result: null };
  },
};

// ---------------- opencode ----------------
function opencodeDelta(line: string, seen: Map<string, string>): string {
  try {
    const evt = JSON.parse(line);
    if (evt.type === "text" && evt.part?.text !== undefined) {
      const id = String(evt.part.id ?? "default");
      const text = String(evt.part.text ?? "");
      const prev = seen.get(id) ?? "";
      if (text.length > prev.length && text.startsWith(prev)) {
        seen.set(id, text);
        return text.slice(prev.length);
      }
      if (text !== prev) {
        seen.set(id, text);
        return text;
      }
    }
    return "";
  } catch {
    return "";
  }
}

function opencodeResult(line: string, startedAt: number): RunMeta | null {
  try {
    const evt = JSON.parse(line);
    if (evt.type !== "step_finish") return null;
    const tokens = evt.part?.tokens ?? {};
    return {
      sessionId: evt.sessionID ?? evt.part?.sessionID ?? null,
      inputTokens: tokens.input ?? 0,
      outputTokens: tokens.output ?? 0,
      costUsd: Number(evt.part?.cost ?? evt.cost ?? 0) || 0,
      durationMs: Date.now() - startedAt,
      isError: false,
      errorText: null,
    };
  } catch {
    return null;
  }
}

const opencodeRunner: Runner = {
  id: "opencode",
  label: "opencode",
  glyph: "⬡",
  color: "#22e6c8",
  supportsStreaming: true,
  bin() {
    return providerBin(loadConfigSync(), "opencode");
  },
  version() {
    return versionOf(this.bin());
  },
  chat(opts) {
    return new Promise<RunMeta>((resolve, reject) => {
      const startedAt = Date.now();
      const args = ["run", opts.prompt, "--format", "json"];
      if (opts.model) args.push("--model", opts.model);
      if (opts.resumeSessionId) args.push("--session", opts.resumeSessionId);

      const child = spawn(this.bin(), args, {
        cwd: opts.cwd ?? process.cwd(),
        env: { ...process.env, TERM: "dumb", NO_COLOR: "1" },
        stdio: ["ignore", "pipe", "pipe"],
      });

      let buffer = "";
      let stderr = "";
      let sessionId: string | null = null;
      let lastResult: RunMeta | null = null;
      const seen = new Map<string, string>();
      let settled = false;
      const settle = (m: RunMeta) => { if (!settled) { settled = true; clearTimeout(timer); resolve(m); } };
      opts.signal?.addEventListener("abort", () => { try { child.kill("SIGTERM"); } catch {} }, { once: true });
      const timer = setTimeout(() => {
        try { child.kill("SIGKILL"); } catch {}
        settle({ ...emptyMeta(), durationMs: Date.now() - startedAt, sessionId, isError: true, errorText: "opencode timed out after 5 minutes" });
      }, 5 * 60 * 1000);

      const sniffSession = (line: string) => {
        try {
          const evt = JSON.parse(line);
          if (typeof evt.sessionID === "string") sessionId = evt.sessionID;
        } catch {}
      };

      child.stdout.on("data", (d) => {
        buffer += d.toString();
        const parts = buffer.split("\n");
        buffer = parts.pop() ?? "";
        for (const line of parts) {
          const t = line.trim();
          if (!t) continue;
          sniffSession(t);
          const delta = opencodeDelta(t, seen);
          if (delta) opts.onDelta(delta);
          const r = opencodeResult(t, startedAt);
          if (r) {
            if (!r.sessionId) r.sessionId = sessionId;
            lastResult = r;
          }
        }
      });
      child.stderr.on("data", (d) => (stderr += d.toString()));
      child.on("error", (err) => { clearTimeout(timer); reject(new Error(`Failed to launch opencode CLI: ${err.message}`)); });
      child.on("close", (code) => {
        if (settled) return;
        if (buffer.trim()) {
          const t = buffer.trim();
          sniffSession(t);
          const delta = opencodeDelta(t, seen);
          if (delta) opts.onDelta(delta);
          const r = opencodeResult(t, startedAt);
          if (r) {
            if (!r.sessionId) r.sessionId = sessionId;
            lastResult = r;
          }
        }
        const durationMs = Date.now() - startedAt;
        if (lastResult) return settle({ ...lastResult, durationMs });
        if (code !== 0) {
          return settle({ ...emptyMeta(), durationMs, sessionId, isError: true, errorText: stderr.slice(0, 500) || `opencode ${exitLabel(code)}` });
        }
        settle({ ...emptyMeta(), durationMs, sessionId });
      });
    });
  },
  taskArgs(task, o) {
    // opencode run has no system-prompt flag: fold persona into the message
    const msg = o.systemPrompt ? `${o.systemPrompt}\n\n${task}` : task;
    const args = ["run", msg, "--format", "json"];
    if (o.model) args.push("--model", o.model);
    return args;
  },
  parseTaskLine(line, seen) {
    return { delta: opencodeDelta(line, seen) || undefined, result: opencodeResult(line, Date.now()) ?? undefined };
  },
  async finishTask(info) {
    if (info.lastResult) return { result: info.lastResult };
    if (info.code !== 0) {
      return { result: { ...emptyMeta(), durationMs: Date.now() - info.startedAt, isError: true, errorText: info.stderr.slice(0, 500) || `opencode ${exitLabel(info.code)}` } };
    }
    return { result: null };
  },
};

// ---------------- Hermes ----------------
const HERMES_USAGE = "hermes-usage.json";

async function readHermesUsage(cwd: string): Promise<Partial<{ input_tokens: number; output_tokens: number; estimated_cost_usd: number; session_id: string; completed: boolean; failed: boolean }>> {
  try {
    const raw = await fs.readFile(path.join(cwd, HERMES_USAGE), "utf8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

const hermesRunner: Runner = {
  id: "hermes",
  label: "Hermes",
  glyph: "☿",
  color: "#c084fc",
  supportsStreaming: false,
  bin() {
    return providerBin(loadConfigSync(), "hermes");
  },
  version() {
    return versionOf(this.bin());
  },
  async chat(opts) {
    // agent-less chats run in a scratch dir so usage files never touch the repo
    const cwd = opts.cwd ?? path.join(DATA_DIR(), "tmp");
    await fs.mkdir(cwd, { recursive: true }).catch(() => {});
    return new Promise<RunMeta>((resolve, reject) => {
      const startedAt = Date.now();
      const args = ["-z", opts.prompt, "--usage-file", path.join(cwd, HERMES_USAGE)];
      if (opts.model) args.push("--model", opts.model);
      if (opts.resumeSessionId) args.push("--resume", opts.resumeSessionId);

      const child = spawn(this.bin(), args, {
        cwd,
        env: { ...process.env, TERM: "dumb", NO_COLOR: "1" },
        stdio: ["ignore", "pipe", "pipe"],
      });

      let stdout = "";
      let stderr = "";
      let settled = false;
      const settle = (m: RunMeta) => { if (!settled) { settled = true; clearTimeout(timer); resolve(m); } };
      opts.signal?.addEventListener("abort", () => { try { child.kill("SIGTERM"); } catch {} }, { once: true });
      const timer = setTimeout(() => {
        try { child.kill("SIGKILL"); } catch {}
        settle({ ...emptyMeta(), durationMs: Date.now() - startedAt, isError: true, errorText: "Hermes timed out after 5 minutes" });
      }, 5 * 60 * 1000);
      child.stdout.on("data", (d) => (stdout += d.toString()));
      child.stderr.on("data", (d) => (stderr += d.toString()));
      child.on("error", (err) => { clearTimeout(timer); reject(new Error(`Failed to launch Hermes CLI: ${err.message}`)); });
      child.on("close", async () => {
        if (settled) return;
        const durationMs = Date.now() - startedAt;
        const usage = await readHermesUsage(cwd);
        const text = stdout.trim();
        if (usage.failed || (!usage.completed && !text)) {
          return settle({
            ...emptyMeta(),
            durationMs,
            sessionId: typeof usage.session_id === "string" ? usage.session_id : null,
            isError: true,
            errorText: (stderr.trim() || text || "Hermes run failed").slice(0, 500),
          });
        }
        if (text) opts.onDelta(text);
        settle({
          sessionId: typeof usage.session_id === "string" ? usage.session_id : null,
          inputTokens: Number(usage.input_tokens) || 0,
          outputTokens: Number(usage.output_tokens) || 0,
          costUsd: Number(usage.estimated_cost_usd) || 0,
          durationMs,
          isError: false,
          errorText: null,
        });
      });
    });
  },
  taskArgs(task, o) {
    const msg = o.systemPrompt ? `${o.systemPrompt}\n\n${task}` : task;
    const args = ["-z", msg, "--usage-file", HERMES_USAGE];
    if (o.model) args.push("--model", o.model);
    return args;
  },
  parseTaskLine(_line, _seen) {
    // one-shot CLI: nothing meaningful streams; resolved at finish
    return {};
  },
  async finishTask(info) {
    const usage = await readHermesUsage(info.cwd);
    const text = info.rawOut.trim();
    const durationMs = Date.now() - info.startedAt;
    if (usage.failed || (!usage.completed && !text && (info.code !== 0 && info.code !== null))) {
      return {
        result: {
          ...emptyMeta(),
          durationMs,
          sessionId: typeof usage.session_id === "string" ? usage.session_id : null,
          isError: true,
          errorText: (info.stderr.trim() || text || "Hermes run failed").slice(0, 500),
        },
      };
    }
    return {
      delta: text || undefined,
      result: {
        sessionId: typeof usage.session_id === "string" ? usage.session_id : null,
        inputTokens: Number(usage.input_tokens) || 0,
        outputTokens: Number(usage.output_tokens) || 0,
        costUsd: Number(usage.estimated_cost_usd) || 0,
        durationMs,
        isError: false,
        errorText: null,
      },
    };
  },
};

// ---------------- registry ----------------
const REGISTRY: Record<string, Runner> = {
  claude: claudeRunner,
  opencode: opencodeRunner,
  hermes: hermesRunner,
};

export function getRunner(id?: string | null): Runner {
  if (id && REGISTRY[id]) return REGISTRY[id];
  try {
    const cfg = loadConfigSync();
    const d = cfg.providers.default;
    if (typeof d === "string" && REGISTRY[d]) return REGISTRY[d];
  } catch {}
  return REGISTRY.claude;
}

export function allRunners(): Runner[] {
  return Object.values(REGISTRY);
}

export function formatDoneLine(r: RunMeta): string {
  return `\n[DONE in ${(r.durationMs / 1000).toFixed(1)}s · ${r.inputTokens}+${r.outputTokens} tokens · $${r.costUsd.toFixed(4)}]`;
}
