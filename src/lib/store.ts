import { promises as fs } from "fs";
import path from "path";

import { loadConfigSync, resolvePath } from "./config";

/** Resolved per call so the setup wizard can rewrite paths at runtime. */
export function DATA_DIR(): string {
  return resolvePath(loadConfigSync().paths.data);
}
export function WORKSPACES_DIR(): string {
  return resolvePath(loadConfigSync().paths.workspaces);
}

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(path.join(DATA_DIR(), file), "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJson(file: string, value: unknown) {
  await ensureDir(DATA_DIR());
  await fs.writeFile(path.join(DATA_DIR(), file), JSON.stringify(value, null, 2), "utf8");
}

// ---------- Types ----------
export type AgentStatus = "idle" | "running" | "error";

export interface Agent {
  id: string;
  name: string;
  persona: string;
  systemPrompt: string;
  model: string;
  color: string;
  avatarSeed: number;
  provider: string;
  status: AgentStatus;
  pid: number | null;
  lastTask: string;
  createdAt: number;
  updatedAt: number;
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  ts: number;
  tokens?: number;
}

export interface ChatSession {
  id: string;
  title: string;
  agentId: string | null;
  model: string;
  messages: ChatMessage[];
  claudeSessionId: string | null;
  provider: string;
  providerSessions: Record<string, string>;
  autoRouted?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface PromptTemplate {
  id: string;
  title: string;
  body: string;
  tags: string[];
  uses: number;
  createdAt: number;
}

export interface UsageEvent {
  id: string;
  ts: number;
  agentId: string | null;
  sessionId: string | null;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  durationMs: number;
  ok: boolean;
  error?: string;
  provider?: string;
}

export interface GraphNode {
  id: string;
  label: string;
  type: "agent" | "chat" | "prompt" | "file" | "idea";
  detail?: string;
}
export interface GraphEdge {
  from: string;
  to: string;
  label?: string;
}

// ---------- Stores ----------
export async function getAgents(): Promise<Agent[]> {
  const agents = await readJson<Agent[]>("agents.json", []);
  let dirty = false;
  for (const a of agents) {
    if (typeof (a as Partial<Agent>).provider !== "string" || !(a as Partial<Agent>).provider) {
      a.provider = "claude";
      dirty = true;
    }
  }
  if (dirty) await saveAgents(agents);
  return agents;
}
export async function saveAgents(agents: Agent[]) {
  await writeJson("agents.json", agents);
}

export async function getSessions(): Promise<ChatSession[]> {
  const sessions = await readJson<ChatSession[]>("sessions.json", []);
  let dirty = false;
  for (const s of sessions) {
    const p = s as Partial<ChatSession>;
    if (typeof p.provider !== "string" || !p.provider) {
      s.provider = "claude";
      dirty = true;
    }
    if (!p.providerSessions || typeof p.providerSessions !== "object") {
      s.providerSessions = s.claudeSessionId ? { claude: s.claudeSessionId } : {};
      dirty = true;
    }
  }
  if (dirty) await saveSessions(sessions);
  return sessions;
}
export async function saveSessions(s: ChatSession[]) {
  await writeJson("sessions.json", s);
}

export async function getPrompts(): Promise<PromptTemplate[]> {
  const existing = await readJson<PromptTemplate[]>("prompts.json", []);
  if (existing.length > 0) return existing;
  const seed: PromptTemplate[] = [
    {
      id: "seed_deep_debug",
      title: "Deep Bug Hunt",
      body: "You are a senior systems debugger. Reproduce the issue, isolate the smallest failing case, explain root cause, then propose the minimal fix with tests. Think step by step.",
      tags: ["debug", "engineering"],
      uses: 0,
      createdAt: Date.now(),
    },
    {
      id: "seed_mission_brief",
      title: "Mission Brief",
      body: "Summarize the current mission state: goal, progress, blockers, next 3 actions. Be terse, use bullets, end with one sharp question.",
      tags: ["planning"],
      uses: 0,
      createdAt: Date.now(),
    },
    {
      id: "seed_code_review",
      title: "Ruthless Code Review",
      body: "Review the attached code like a principal engineer. Flag correctness, security, and performance issues. Rate each finding P0-P3. No flattery.",
      tags: ["review", "engineering"],
      uses: 0,
      createdAt: Date.now(),
    },
    {
      id: "seed_idea_forge",
      title: "Idea Forge",
      body: "Generate 10 bold ideas for the given topic. Then pick the 2 most non-obvious winners and steelman each in 3 sentences.",
      tags: ["creativity"],
      uses: 0,
      createdAt: Date.now(),
    },
  ];
  await writeJson("prompts.json", seed);
  return seed;
}
export async function savePrompts(p: PromptTemplate[]) {
  await writeJson("prompts.json", p);
}

export async function getUsage(): Promise<UsageEvent[]> {
  return readJson<UsageEvent[]>("usage.json", []);
}
export async function logUsage(e: UsageEvent) {
  const all = await getUsage();
  all.push(e);
  // cap at 2000 events
  await writeJson("usage.json", all.slice(-2000));
}

export async function getGraph(): Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }> {
  const g = await readJson<{ nodes: GraphNode[]; edges: GraphEdge[] }>("graph.json", {
    nodes: [],
    edges: [],
  });
  if (g.nodes.length > 0) return g;
  const seed = {
    nodes: [
      { id: "n_mission", label: "Mission Control", type: "idea", detail: "Local Claude OS" },
      { id: "n_claude", label: "Claude Code CLI", type: "agent", detail: "Local bridge" },
    ] as GraphNode[],
    edges: [{ from: "n_mission", to: "n_claude", label: "powered by" }] as GraphEdge[],
  };
  await writeJson("graph.json", seed);
  return seed;
}
export async function saveGraph(g: { nodes: GraphNode[]; edges: GraphEdge[] }) {
  await writeJson("graph.json", g);
}

/** Link a new memory node using cheap keyword overlap (v1 auto-link). */
export function autoLink(
  label: string,
  nodes: GraphNode[],
  edges: GraphEdge[],
  newId: string,
  maxLinks = 3
) {
  const words = new Set(label.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3));
  const scored = nodes
    .filter((n) => n.id !== newId)
    .map((n) => {
      const nw = new Set(n.label.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3));
      let overlap = 0;
      for (const w of words) if (nw.has(w)) overlap++;
      return { n, overlap };
    })
    .filter((s) => s.overlap > 0)
    .sort((a, b) => b.overlap - a.overlap)
    .slice(0, maxLinks);
  for (const s of scored) edges.push({ from: newId, to: s.n.id, label: "related" });
  return edges;
}

export interface Goal {
  id: string;
  title: string;
  notes: string;
  status: "active" | "done" | "archived";
  due: string;
  createdAt: number;
  updatedAt: number;
}

export async function getGoals(): Promise<Goal[]> {
  return readJson<Goal[]>("goals.json", []);
}
export async function saveGoals(g: Goal[]) {
  await writeJson("goals.json", g);
}

export interface JournalEntry {
  id: string;
  title: string;
  body: string;
  mood: string;
  ts: number;
}

export async function getJournal(): Promise<JournalEntry[]> {
  return readJson<JournalEntry[]>("journal.json", []);
}
export async function saveJournal(j: JournalEntry[]) {
  await writeJson("journal.json", j.slice(-1000));
}

export async function getGuideDone(): Promise<number[]> {
  return readJson<number[]>("guide.json", []);
}
export async function saveGuideDone(done: number[]) {
  await writeJson("guide.json", [...new Set(done)].sort());
}

export interface DigestRun {
  date: string;
  ts: number;
  provider: string;
  fallback: boolean;
  attempts: number;
  ok: boolean;
  notePath: string | null;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  error?: string;
}

export async function getDigestRuns(): Promise<DigestRun[]> {
  return readJson<DigestRun[]>("digest.json", []);
}
export async function saveDigestRun(run: DigestRun) {
  const all = await getDigestRuns();
  const kept = all.filter((r) => r.date !== run.date);
  kept.push(run);
  await writeJson("digest.json", kept.slice(-60));
}

export async function recordHealth(patch: { lastOk?: number; lastError?: string; lastErrorTs?: number }) {
  const cur = await readJson("health.json", {} as Record<string, unknown>);
  await writeJson("health.json", { ...cur, ...patch });
}
export async function getHealth() {
  return readJson<{ lastOk?: number; lastError?: string; lastErrorTs?: number }>("health.json", {});
}

// ---------- Background tasks (Kanban queue) ----------
export type TaskStatus = "todo" | "in_progress" | "awaiting_approval" | "completed" | "failed";
export type TaskColumn = "todo" | "in_progress" | "awaiting_approval" | "completed";

export interface TaskStep {
  id: string;
  label: string;
  prompt: string;
  sensitive: boolean;
  done: boolean;
  ok: boolean | null;
}

export interface BgTask {
  id: string;
  title: string;
  agentId: string | null;
  provider: string;
  steps: TaskStep[];
  status: TaskStatus;
  currentStep: number;
  pendingStep: number | null;
  approvedSteps: string[];
  requiresApproval: boolean;
  error: string | null;
  createdAt: number;
  updatedAt: number;
}

export async function getTasks(): Promise<BgTask[]> {
  return readJson<BgTask[]>("tasks.json", []);
}
export async function saveTasks(tasks: BgTask[]) {
  await writeJson("tasks.json", tasks);
}

// ---------- Automations (scheduled + event workflows) ----------
export type AutomationTrigger =
  | { kind: "cron"; expr: string }
  | { kind: "git"; repo?: string; branch?: string };

export type AutomationAction =
  | { kind: "prompt"; promptId?: string; body?: string; agentId?: string | null; provider?: string }
  | { kind: "digest" }
  | { kind: "script"; script: string };

export interface AutomationRun {
  ts: number;
  ok: boolean;
  summary: string;
}

export interface Automation {
  id: string;
  name: string;
  enabled: boolean;
  trigger: AutomationTrigger;
  action: AutomationAction;
  lastRun: number | null;
  lastStatus: "ok" | "error" | null;
  lastError: string | null;
  runCount: number;
  history: AutomationRun[];
  createdAt: number;
  updatedAt: number;
}

export async function getAutomations(): Promise<Automation[]> {
  return readJson<Automation[]>("automations.json", []);
}
export async function saveAutomations(automations: Automation[]) {
  await writeJson("automations.json", automations);
}

// ---------- Tool registry permissions ----------
export type ToolLevel = "allow" | "ask" | "disabled";

export interface ToolApproval {
  id: string;
  tool: string;
  agentId: string | null;
  summary: string;
  status: "pending" | "approved" | "denied";
  consumed: boolean;
  createdAt: number;
  decidedAt: number | null;
}

export interface ToolPermissions {
  defaults: Record<string, ToolLevel>;
  overrides: Record<string, Record<string, ToolLevel>>;
  approvals: ToolApproval[];
}

export async function getToolPermissions(): Promise<ToolPermissions> {
  const p = await readJson<ToolPermissions>("tools.json", { defaults: {}, overrides: {}, approvals: [] });
  if (!p.defaults || !p.overrides || !p.approvals) return { defaults: {}, overrides: {}, approvals: [] };
  return p;
}
export async function saveToolPermissions(p: ToolPermissions) {
  await writeJson("tools.json", { defaults: p.defaults ?? {}, overrides: p.overrides ?? {}, approvals: (p.approvals ?? []).slice(-200) });
}

