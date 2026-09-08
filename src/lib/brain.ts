import { promises as fs } from "fs";
import path from "path";
import { loadConfigSync, resolvePath } from "./config";
import type { ChatSession } from "./store";

/**
 * Second-brain engine. Markdown vault layout:
 *
 *   <brain>/Agentic OS/
 *     Chats/<YYYY-MM-DD>/<HH-MM>-<slug>.md   — one file per chat, grouped by day
 *     Goals.md                               — checkbox task lists (Active/Done/Archived)
 *     Journal/<YYYY-MM-DD>.md                — entries appended under ## HH:MM
 *
 * Brain root resolution: BRAIN_DIR env > <project>/brain (symlink → ~/brain).
 * All writes are fire-and-forget safe: they never throw to callers.
 */

export function brainRoot(): string {
  return resolvePath(loadConfigSync().paths.brain);
}

export function osDir(): string {
  return path.join(brainRoot(), "Agentic OS");
}

export function slugify(s: string, max = 48): string {
  const slug =
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, max) || "untitled";
  return slug;
}

export function dayStamp(ts = Date.now()): string {
  const d = new Date(ts);
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function timeStamp(ts = Date.now()): string {
  const d = new Date(ts);
  const h = `${d.getHours()}`.padStart(2, "0");
  const m = `${d.getMinutes()}`.padStart(2, "0");
  return `${h}-${m}`;
}

async function writeFileSafe(rel: string, content: string): Promise<string | null> {
  try {
    const full = path.join(osDir(), rel);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, content, "utf8");
    return full;
  } catch {
    return null;
  }
}

async function removeSafe(rel: string) {
  try {
    await fs.unlink(path.join(osDir(), rel));
  } catch {}
}

// ---------- Chats: one file per chat, inside a daily folder ----------
export async function saveChatToBrain(session: ChatSession, agentName?: string): Promise<string | null> {
  const day = dayStamp(session.createdAt);
  const file = `${timeStamp(session.createdAt)}-${slugify(session.title)}.md`;
  const lines = [
    "---",
    `title: "${session.title.replace(/"/g, "'")}"`,
    `date: ${new Date(session.createdAt).toISOString()}`,
    `agent: ${agentName ?? "Claude"}`,
    `model: ${session.model}`,
    `session: ${session.id}`,
    "type: chat",
    "---",
    "",
    `# ${session.title}`,
    "",
    `*${new Date(session.createdAt).toLocaleString()} · with ${agentName ?? "Claude"} · ${session.model}*`,
    "",
  ];
  for (const m of session.messages) {
    if (m.role === "system") continue;
    const who = m.role === "user" ? "🧑 You" : `✦ ${agentName ?? "Claude"}`;
    const clock = new Date(m.ts).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    lines.push(`## ${who} · ${clock}`, "", m.content, "");
  }
  return writeFileSafe(path.join("Chats", day, file), lines.join("\n"));
}

// ---------- Goals: single checkbox task-list file (Obsidian Tasks friendly) ----------
export interface BrainGoal {
  id: string;
  title: string;
  notes: string;
  status: "active" | "done" | "archived";
  due?: string;
  createdAt: number;
  updatedAt: number;
}

function goalLines(g: BrainGoal): string[] {
  const box = g.status === "done" || g.status === "archived" ? "x" : " ";
  const due = g.due ? ` 📅 ${g.due}` : "";
  const head = `- [${box}] ${g.title}${due} <!-- goal:${g.id} -->`;
  if (!g.notes.trim()) return [head];
  const subs = g.notes
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => `  - ${l}`);
  return [head, ...subs];
}

/** Rewrite Goals.md from the full goal list. Canonical vault file for goals. */
export async function syncGoalsIndex(goals: BrainGoal[]): Promise<string | null> {
  const active = goals.filter((g) => g.status === "active");
  const done = goals.filter((g) => g.status === "done");
  const archived = goals.filter((g) => g.status === "archived");
  const section = (title: string, list: BrainGoal[]) =>
    [`## ${title}`, ...(list.length ? list.flatMap(goalLines) : ["_None_"]), ""];
  const content = [
    "---",
    "type: goals",
    `updated: ${new Date().toISOString()}`,
    "---",
    "",
    "# Goals",
    "",
    ...section("Active", active),
    ...section("Done", done),
    ...section("Archived", archived),
  ].join("\n");
  return writeFileSafe("Goals.md", content);
}

export async function saveGoalToBrain(g: BrainGoal): Promise<string | null> {
  const box = g.status === "done" ? "x" : " ";
  const content = [
    "---",
    `title: "${g.title.replace(/"/g, "'")}"`,
    `status: ${g.status}`,
    ...(g.due ? [`due: ${g.due}`] : []),
    `updated: ${new Date(g.updatedAt).toISOString()}`,
    `goal_id: ${g.id}`,
    "type: goal",
    "---",
    "",
    `# [${box}] ${g.title}`,
    "",
    g.notes || "_No notes yet._",
    "",
  ].join("\n");
  return writeFileSafe(path.join("Goals", `${slugify(g.title)}-${g.id.slice(-6)}.md`), content);
}

export async function removeGoalFromBrain(g: BrainGoal) {
  await removeSafe(path.join("Goals", `${slugify(g.title)}-${g.id.slice(-6)}.md`));
}

// ---------- Journal: entries appended to the daily file ----------
export async function appendJournalToBrain(entry: { title: string; body: string; ts: number; mood?: string }): Promise<string | null> {
  try {
    const day = dayStamp(entry.ts);
    const rel = path.join("Journal", `${day}.md`);
    const full = path.join(osDir(), rel);
    await fs.mkdir(path.dirname(full), { recursive: true });
    let existing = "";
    try {
      existing = await fs.readFile(full, "utf8");
    } catch {
      existing = `# Journal · ${day}\n\n`;
    }
    const clock = new Date(entry.ts).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
    const mood = entry.mood ? ` ${entry.mood}` : "";
    const block = `## ${clock} — ${entry.title}${mood}\n\n${entry.body}\n\n`;
    await fs.writeFile(full, existing.replace(/\s+$/, "\n\n") + block, "utf8");
    return full;
  } catch {
    return null;
  }
}

export async function removeJournalDay(day: string) {
  await removeSafe(path.join("Journal", `${day}.md`));
}

// ---------- Daily digest: one note per day, written by Hermes (or fallback) ----------
export interface DigestNoteMeta {
  provider: string;
  fallback: boolean;
  counts: { chats: number; goals: number; journal: number };
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export async function writeDigestNote(day: string, body: string, meta: DigestNoteMeta): Promise<string | null> {
  const noteDir = loadConfigSync().digest?.noteDir || "Daily Notes";
  const content = [
    "---",
    `date: ${day}`,
    "type: daily-note",
    `author: ${meta.provider}${meta.fallback ? " (fallback)" : ""}`,
    `chats: ${meta.counts.chats}`,
    `goals: ${meta.counts.goals}`,
    `journal: ${meta.counts.journal}`,
    `tokens: ${meta.inputTokens}+${meta.outputTokens}`,
    `cost_usd: ${meta.costUsd.toFixed(4)}`,
    `generated: ${new Date().toISOString()}`,
    "---",
    "",
    `# 🌙 ${day}`,
    "",
    body.trim(),
    "",
  ].join("\n");
  return writeFileSafe(path.join(noteDir, `${day}.md`), content);
}

// ---------- Guide: the build-your-own manual, mirrored to the vault ----------
export async function exportGuideToBrain(markdown: string, vaultPath: string): Promise<string | null> {
  return writeFileSafe(vaultPath, markdown);
}
