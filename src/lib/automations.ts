import { spawn } from "child_process";
import { agentWorkspace } from "./claude";
import { runDigest } from "./digest";
import { resolveSystemPrompt } from "./platforms";
import { getRunner } from "./runners";
import { gateTool } from "./tools";
import {
  DATA_DIR,
  getAgents,
  getAutomations,
  getPrompts,
  logUsage,
  saveAutomations,
  type Automation,
  type BgTask,
} from "./store";
import { uid } from "./utils";

/**
 * Cron expressions we support (local time):
 *  "daily HH:MM" | "hourly" | "every Nm" | "every Nh" | "M H * * *" (minute+hour, rest must be *)
 */
export function parseCronish(expr: string): { kind: string; minute?: number; hour?: number; everyMs?: number; error?: string } {
  const e = expr.trim();
  let m = /^daily\s+(\d{1,2}):(\d{2})$/.exec(e);
  if (m) {
    const hour = Number(m[1]);
    const minute = Number(m[2]);
    if (hour > 23 || minute > 59) return { kind: "invalid", error: "hour 0-23, minute 00-59" };
    return { kind: "daily", hour, minute };
  }
  if (/^hourly$/.test(e)) return { kind: "hourly" };
  m = /^every\s+(\d+)\s*([mh])$/.exec(e);
  if (m) {
    const n = Number(m[1]);
    if (n < 1) return { kind: "invalid", error: "interval must be ≥ 1" };
    return { kind: "interval", everyMs: n * (m[2] === "h" ? 3600000 : 60000) };
  }
  m = /^(\*|\d{1,2})\s+(\*|\d{1,2})\s+\*\s+\*\s+\*$/.exec(e);
  if (m) {
    const minute = m[1] === "*" ? undefined : Number(m[1]);
    const hour = m[2] === "*" ? undefined : Number(m[2]);
    if ((minute !== undefined && minute > 59) || (hour !== undefined && hour > 23)) {
      return { kind: "invalid", error: "minute 0-59, hour 0-23" };
    }
    return { kind: "raw", minute, hour };
  }
  return { kind: "invalid", error: 'use "daily HH:MM", "hourly", "every Nm/Nh", or "M H * * *"' };
}

function startOfHour(ts: number) {
  const d = new Date(ts);
  d.setMinutes(0, 0, 0);
  return d.getTime();
}

function occurrenceToday(hour: number, minute: number, now: number): number {
  const d = new Date(now);
  d.setHours(hour, minute, 0, 0);
  return d.getTime();
}

/** Most recent scheduled boundary at or before now. Null if none yet today/period. */
export function lastBoundary(expr: string, now: number): number | null {
  const p = parseCronish(expr);
  if (p.kind === "daily" && p.hour !== undefined && p.minute !== undefined) {
    const t = occurrenceToday(p.hour, p.minute, now);
    if (t <= now) return t;
    const y = new Date(t);
    y.setDate(y.getDate() - 1);
    return y.getTime();
  }
  if (p.kind === "hourly") {
    const t = startOfHour(now);
    return t <= now ? t : null;
  }
  if (p.kind === "raw") {
    // minute/hour exact-or-wildcard, daily recurrence
    const hours = p.hour !== undefined ? [p.hour] : Array.from({ length: 24 }, (_, h) => h);
    const minutes = p.minute !== undefined ? [p.minute] : [0];
    let best: number | null = null;
    for (let back = 0; back < 2; back++) {
      for (const h of hours) {
        for (const min of minutes) {
          const d = new Date(now);
          d.setDate(d.getDate() - back);
          d.setHours(h, min, 0, 0);
          const t = d.getTime();
          if (t <= now && (best === null || t > best)) best = t;
        }
      }
      if (best !== null) break;
    }
    return best;
  }
  return null;
}

/** Due when a scheduled boundary passed since lastRun (or ever, if never run). */
export function isDue(expr: string, lastRun: number | null, now: number): boolean {
  const p = parseCronish(expr);
  if (p.kind === "invalid") return false;
  if (p.kind === "interval" && p.everyMs) {
    if (lastRun == null) return true;
    return now - lastRun >= p.everyMs;
  }
  const b = lastBoundary(expr, now);
  if (b === null) return false;
  if (lastRun == null) return true;
  return lastRun < b;
}

export function describeTrigger(a: { trigger: Automation["trigger"] }): string {
  const t = a.trigger;
  if (t.kind === "git") {
    const repo = t.repo?.trim() || "any repo";
    const branch = t.branch?.trim() || "any branch";
    return `On git commit · ${repo} · ${branch}`;
  }
  const p = parseCronish(t.expr);
  if (p.kind === "invalid") return `Invalid schedule`;
  if (t.expr.startsWith("daily")) return `Daily at ${t.expr.slice(6)}`;
  if (t.expr === "hourly") return "Every hour";
  if (p.kind === "interval" && p.everyMs) {
    const mins = Math.round(p.everyMs / 60000);
    return mins >= 60 && mins % 60 === 0 ? `Every ${mins / 60}h` : `Every ${mins}m`;
  }
  return `Cron ${t.expr}`;
}

export function describeAction(a: { action: Automation["action"] }): string {
  const x = a.action;
  if (x.kind === "digest") return "Nightly journal digest";
  if (x.kind === "script") return `Script: ${x.script.slice(0, 80)}`;
  return x.promptId ? `Prompt template` : `Custom prompt: ${(x.body ?? "").slice(0, 80)}`;
}

const running = new Set<string>();

async function recordRun(id: string, ok: boolean, summary: string) {
  const all = await getAutomations();
  const a = all.find((x) => x.id === id);
  if (!a) return;
  a.lastRun = Date.now();
  a.lastStatus = ok ? "ok" : "error";
  a.lastError = ok ? null : summary.slice(0, 500);
  a.runCount += 1;
  a.updatedAt = Date.now();
  a.history.push({ ts: Date.now(), ok, summary: summary.slice(0, 300) });
  a.history = a.history.slice(-10);
  await saveAutomations(all);
}

function runScript(cmd: string): Promise<{ ok: boolean; out: string }> {
  return new Promise((resolve) => {
    const p = spawn("sh", ["-c", cmd], {
      cwd: DATA_DIR(),
      env: { ...process.env, TERM: "dumb", NO_COLOR: "1" },
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 120000,
    });
    let out = "";
    p.stdout.on("data", (d) => (out += d.toString()));
    p.stderr.on("data", (d) => (out += d.toString()));
    p.on("error", (e) => resolve({ ok: false, out: e.message.slice(0, 2000) }));
    p.on("close", (code) => resolve({ ok: code === 0, out: out.slice(-2000) || `(exit ${code})` }));
  });
}

export async function executeAutomation(id: string, reason = "manual"): Promise<{ ok: boolean; summary: string }> {
  if (running.has(id)) return { ok: false, summary: "already running" };
  running.add(id);
  try {
    const all = await getAutomations();
    const a = all.find((x) => x.id === id);
    if (!a) return { ok: false, summary: "not found" };
    if (!a.enabled) return { ok: false, summary: "disabled" };

    let ok = false;
    let summary = "";
    const act = a.action;
    if (act.kind === "digest") {
      const r = await runDigest();
      ok = r.ok;
      summary = r.ok ? `Digest written → ${r.notePath} (via ${r.provider})` : `Digest failed: ${r.error ?? "unknown"}`;
    } else if (act.kind === "script") {
      const blocked = await gateTool("shell", null, `Automation "${a.name}": ${act.script.slice(0, 120)}`);
      if (blocked) {
        await recordRun(id, false, blocked.message);
        return { ok: false, summary: blocked.message };
      }
      const r = await runScript(act.script);
      ok = r.ok;
      summary = r.ok ? `Script ok: ${r.out.slice(0, 200)}` : `Script failed: ${r.out.slice(0, 300)}`;
    } else {
      // prompt → run through agent (or default provider)
      const agents = await getAgents();
      const agent = agents.find((x) => x.id === act.agentId) ?? null;
      let body = (act.body ?? "").trim();
      if (!body && act.promptId) {
        const prompts = await getPrompts();
        body = prompts.find((p) => p.id === act.promptId)?.body.trim() ?? "";
      }
      if (!body) {
        await recordRun(id, false, "empty prompt (template missing?)");
        return { ok: false, summary: "empty prompt (template missing?)" };
      }
      const { getRunner } = await import("./runners");
      const runner = getRunner(agent?.provider ?? act.provider);
      const agentPart = agent ? `You are ${agent.name}. ${agent.persona}. ${agent.systemPrompt}` : undefined;
      let text = "";
      try {
        const blocked = await gateTool(`cli:${runner.id}`, agent?.id ?? null, `Automation "${a.name}"`);
        if (blocked) throw blocked;
        const meta = await runner.chat({
          prompt: body,
          model: agent?.model || undefined,
          systemPrompt: resolveSystemPrompt(runner.id, agentPart) || undefined,
          cwd: agent ? agentWorkspace(agent.id) : undefined,
          onDelta: (t) => {
            text += t;
          },
        });
        if (meta.isError) throw new Error(meta.errorText ?? "provider error");
        await logUsage({
          id: uid("u"),
          ts: Date.now(),
          agentId: agent?.id ?? null,
          sessionId: null,
          inputTokens: meta.inputTokens,
          outputTokens: meta.outputTokens,
          costUsd: meta.costUsd,
          durationMs: meta.durationMs,
          ok: true,
          provider: runner.id,
        });
        ok = true;
        summary = `Ran via ${runner.label} (${meta.inputTokens}+${meta.outputTokens} tok): ${text.slice(0, 200)}`;
      } catch (e) {
        summary = e instanceof Error ? e.message.slice(0, 300) : "prompt run failed";
      }
    }

    await recordRun(id, ok, `[${reason}] ${summary}`);
    return { ok, summary };
  } finally {
    running.delete(id);
  }
}

let timer: ReturnType<typeof setInterval> | null = null;

async function tick() {
  try {
    const all = await getAutomations();
    const now = Date.now();
    for (const a of all) {
      if (!a.enabled || a.trigger.kind !== "cron") continue;
      if (!isDue(a.trigger.expr, a.lastRun, now)) continue;
      // claim the slot before executing so overlapping ticks don't double-fire
      const fresh = await getAutomations();
      const cur = fresh.find((x) => x.id === a.id);
      if (!cur || !cur.enabled || !isDue(cur.trigger.kind === "cron" ? cur.trigger.expr : "", cur.lastRun, Date.now())) continue;
      cur.lastRun = Date.now();
      await saveAutomations(fresh);
      void executeAutomation(a.id, "schedule").catch(() => {});
    }
  } catch {}
}

/** Idempotent: safe to call from every API route entry. */
export function ensureScheduler() {
  if (timer) return;
  timer = setInterval(tick, 60 * 1000);
  // don't keep the process alive just for the scheduler in scripts/tests
  if (typeof timer === "object" && "unref" in timer) (timer as unknown as { unref(): void }).unref();
}
