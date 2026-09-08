import { promises as fs } from "fs";
import { NextResponse } from "next/server";
import { getAgents, getTasks, saveTasks, type BgTask, type TaskColumn } from "@/lib/store";
import { readTaskLog, runTaskLoop, taskLogPath } from "@/lib/tasks";
import { uid } from "@/lib/utils";

const COLUMNS: TaskColumn[] = ["todo", "in_progress", "awaiting_approval", "completed"];

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const logId = searchParams.get("log");
  if (logId) {
    return NextResponse.json({ log: await readTaskLog(logId) });
  }
  const tasks = await getTasks();
  // resume anything left in_progress (e.g. after a server restart); loop is guarded
  for (const t of tasks) {
    if (t.status === "in_progress") void runTaskLoop(t.id);
  }
  return NextResponse.json({
    tasks: tasks.map((t) => ({
      ...t,
      progress: t.steps.length ? t.steps.filter((s) => s.done).length / t.steps.length : 0,
    })),
  });
}

function parseSteps(raw: unknown): BgTask["steps"] {
  const lines = Array.isArray(raw) ? raw.map(String) : String(raw ?? "").split("\n");
  return lines
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l, i) => {
      const sensitive = l.startsWith("!");
      const label = (sensitive ? l.slice(1) : l).trim().slice(0, 160) || `Step ${i + 1}`;
      return { id: uid("st"), label, prompt: (sensitive ? l.slice(1) : l).trim(), sensitive, done: false, ok: null };
    });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const title = String(body.title ?? "").trim().slice(0, 120);
  if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });
  const steps = parseSteps(body.steps);
  if (!steps.length) return NextResponse.json({ error: "at least one step required" }, { status: 400 });

  const agents = await getAgents();
  const agent = agents.find((a) => a.id === body.agentId) ?? null;
  const provider =
    typeof body.provider === "string" && body.provider ? body.provider : (agent?.provider ?? "claude");

  const now = Date.now();
  const task: BgTask = {
    id: uid("task"),
    title,
    agentId: agent?.id ?? null,
    provider,
    steps,
    status: "in_progress",
    currentStep: 0,
    pendingStep: null,
    approvedSteps: [],
    requiresApproval: Boolean(body.requiresApproval),
    error: null,
    createdAt: now,
    updatedAt: now,
  };
  const tasks = await getTasks();
  tasks.unshift(task);
  await saveTasks(tasks);
  void runTaskLoop(task.id);
  return NextResponse.json({ task });
}

export async function PATCH(req: Request) {
  const body = await req.json().catch(() => ({}));
  const tasks = await getTasks();
  const task = tasks.find((t) => t.id === body.id);
  if (!task) return NextResponse.json({ error: "not found" }, { status: 404 });

  if (typeof body.title === "string" && body.title.trim()) task.title = body.title.trim().slice(0, 120);
  if (typeof body.status === "string" && (COLUMNS as string[]).includes(body.status)) {
    if (body.status === "completed") {
      task.status = "completed";
      task.pendingStep = null;
    } else if (body.status === "todo") {
      task.status = "todo";
      task.pendingStep = null;
    } else if (body.status === "in_progress") {
      if (task.status === "completed" || task.status === "failed") {
        // restart from scratch
        task.steps.forEach((s) => {
          s.done = false;
          s.ok = null;
        });
        task.currentStep = 0;
        task.approvedSteps = [];
        task.error = null;
      }
      task.status = "in_progress";
      task.pendingStep = null;
    } else if (body.status === "awaiting_approval") {
      task.status = "awaiting_approval";
      if (task.pendingStep == null) task.pendingStep = task.currentStep;
    }
  }
  task.updatedAt = Date.now();
  await saveTasks(tasks);
  if (task.status === "in_progress") void runTaskLoop(task.id);
  return NextResponse.json({ task });
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const tasks = await getTasks();
  await saveTasks(tasks.filter((t) => t.id !== id));
  if (id) {
    try {
      await fs.unlink(taskLogPath(id));
    } catch {}
  }
  return NextResponse.json({ ok: true });
}

