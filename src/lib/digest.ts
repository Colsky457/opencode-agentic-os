import { dayStamp, writeDigestNote } from "./brain";
import { loadConfigSync } from "./config";
import { getRunner, type RunMeta } from "./runners";
import {
  getGoals,
  getJournal,
  getSessions,
  getUsage,
  logUsage,
  saveDigestRun,
  type DigestRun,
} from "./store";
import { uid } from "./utils";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function sameDay(ts: number, day: string): boolean {
  return dayStamp(ts) === day;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + `\n…(trimmed ${s.length - max} chars)`;
}

/** Assemble the day's raw material, newest-first, capped by config.digest.maxChars. */
export async function gatherDay(day: string): Promise<{ context: string; counts: { chats: number; goals: number; journal: number } }> {
  const max = loadConfigSync().digest?.maxChars ?? 12000;
  const [sessions, goals, journal, usage] = await Promise.all([
    getSessions(),
    getGoals(),
    getJournal(),
    getUsage(),
  ]);

  const chats = sessions
    .filter((s) => sameDay(s.updatedAt, day) || sameDay(s.createdAt, day))
    .sort((a, b) => b.updatedAt - a.updatedAt);
  const entries = journal.filter((j) => sameDay(j.ts, day)).sort((a, b) => a.ts - b.ts);
  const dayUsage = usage.filter((u) => sameDay(u.ts, day));
  const inTok = dayUsage.reduce((n, u) => n + (u.inputTokens || 0), 0);
  const outTok = dayUsage.reduce((n, u) => n + (u.outputTokens || 0), 0);
  const cost = dayUsage.reduce((n, u) => n + (u.costUsd || 0), 0);

  const parts: string[] = [];
  parts.push(`# Raw material for ${day}\n`);

  parts.push(`## Goals (${goals.length} total)`);
  for (const g of goals) {
    const box = g.status === "done" || g.status === "archived" ? "x" : " ";
    parts.push(`- [${box}] ${g.title}${g.due ? ` (due ${g.due})` : ""} [${g.status}]`);
    if (g.notes.trim()) parts.push(`  ${g.notes.split("\n").map((l) => l.trim()).filter(Boolean).join(" / ").slice(0, 300)}`);
  }

  parts.push(`\n## Journal (${entries.length} entries)`);
  for (const j of entries) {
    const clock = new Date(j.ts).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    parts.push(`### ${clock} — ${j.title}${j.mood ? ` ${j.mood}` : ""}\n${j.body}`);
  }
  if (!entries.length) parts.push("_No journal entries today._");

  parts.push(`\n## Chats (${chats.length} sessions)`);
  for (const s of chats) {
    parts.push(`### ${s.title} (via ${s.provider || "ai"})`);
    for (const m of s.messages) {
      if (m.role === "system") continue;
      const who = m.role === "user" ? "You" : "AI";
      parts.push(`**${who}:** ${m.content}`);
    }
  }
  if (!chats.length) parts.push("_No chats today._");

  parts.push(`\n## Usage\n${dayUsage.length} calls · ${inTok} in / ${outTok} out tokens · $${cost.toFixed(4)}`);

  const full = parts.join("\n");
  // newest-first truncation keeps today's freshest context; goals/journal head is structural
  return {
    context: truncate(full, max),
    counts: { chats: chats.length, goals: goals.length, journal: entries.length },
  };
}

function digestPrompt(day: string, context: string): string {
  return [
    `Write tonight's daily note for ${day}. Warm, concise, second person.`,
    `Sections (markdown): ## ✨ Highlights (3-6 bullets, the day's wins and threads),`,
    `## 💬 Chats (one line each: what was asked, what came out of it),`,
    `## ◎ Goals (status changes worth noting; nudge the most important open one),`,
    `## ❝ Journal (echo the mood, one line per entry),`,
    `## 🌅 Tomorrow (2-3 suggested next steps grounded in the above).`,
    `Keep the whole note under ~400 words. No preamble, no sign-off.`,
    ``,
    `--- DAY'S RAW MATERIAL ---`,
    context,
  ].join("\n");
}

function retryable(meta: RunMeta): boolean {
  if (!meta.isError) return false;
  return /429|rate.?limit|quota|budget|502|503|504|timeout|temporar/i.test(meta.errorText ?? "");
}

export interface DigestResult {
  ok: boolean;
  notePath: string | null;
  provider: string;
  fallback: boolean;
  attempts: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  error?: string;
}

/**
 * Run the nightly digest for a date (default today): gather → Hermes (retries)
  * → fallback provider → vault note. Idempotent per date.
 */
export async function runDigest(day: string = dayStamp()): Promise<DigestResult> {
  const cfg = loadConfigSync();
  const dcfg = cfg.digest ?? { enabled: true, time: "20:00", noteDir: "Daily Notes", maxChars: 12000, retries: 3, fallback: "hermes" };
  const { context, counts } = await gatherDay(day);
  const hermes = getRunner("hermes");
  const fallback = getRunner(dcfg.fallback || cfg.providers.default || "hermes");
  const prompt = digestPrompt(day, context);

  let attempts = 0;
  let meta: RunMeta | null = null;
  let text = "";
  let provider = "hermes";

  for (let i = 0; i < Math.max(1, dcfg.retries); i++) {
    attempts++;
    let acc = "";
    meta = await hermes.chat({ prompt, onDelta: (t) => (acc += t) }).catch(
      (e): RunMeta => ({
        sessionId: null, inputTokens: 0, outputTokens: 0, costUsd: 0, durationMs: 0,
        isError: true, errorText: e instanceof Error ? e.message : "hermes launch failed",
      })
    );
    if (!meta.isError) {
      text = acc.trim();
      break;
    }
    if (!retryable(meta) || i === Math.max(1, dcfg.retries) - 1) break;
    await sleep(15000 * (i + 1));
  }

  let fallbackUsed = false;
  if (!meta || meta.isError || !text) {
    attempts++;
    fallbackUsed = true;
    provider = fallback.id;
    let acc = "";
    meta = await fallback.chat({ prompt, onDelta: (t) => (acc += t) }).catch(
      (e): RunMeta => ({
        sessionId: null, inputTokens: 0, outputTokens: 0, costUsd: 0, durationMs: 0,
        isError: true, errorText: e instanceof Error ? e.message : "fallback launch failed",
      })
    );
    if (!meta.isError) text = acc.trim();
  }

  const ts = Date.now();
  if (!meta || meta.isError || !text) {
    const run: DigestRun = {
      date: day, ts, provider, fallback: fallbackUsed, attempts, ok: false, notePath: null,
      inputTokens: meta?.inputTokens ?? 0, outputTokens: meta?.outputTokens ?? 0, costUsd: meta?.costUsd ?? 0,
      error: meta?.errorText ?? "empty summary",
    };
    await saveDigestRun(run).catch(() => {});
    return { ok: false, notePath: null, provider, fallback: fallbackUsed, attempts, inputTokens: run.inputTokens, outputTokens: run.outputTokens, costUsd: run.costUsd, error: run.error };
  }

  const notePath = await writeDigestNote(day, text, {
    provider,
    fallback: fallbackUsed,
    counts,
    inputTokens: meta.inputTokens,
    outputTokens: meta.outputTokens,
    costUsd: meta.costUsd,
  });

  await logUsage({
    id: uid("u"), ts, agentId: null, sessionId: null,
    inputTokens: meta.inputTokens, outputTokens: meta.outputTokens,
    costUsd: meta.costUsd, durationMs: meta.durationMs, ok: true, provider,
  }).catch(() => {});

  const run: DigestRun = {
    date: day, ts, provider, fallback: fallbackUsed, attempts, ok: true, notePath,
    inputTokens: meta.inputTokens, outputTokens: meta.outputTokens, costUsd: meta.costUsd,
  };
  await saveDigestRun(run).catch(() => {});
  return { ok: true, notePath, provider, fallback: fallbackUsed, attempts, inputTokens: meta.inputTokens, outputTokens: meta.outputTokens, costUsd: meta.costUsd };
}
