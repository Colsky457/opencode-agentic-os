import { NextResponse } from "next/server";
import { getTasks, saveTasks, type BgTask } from "@/lib/store";
import { runTaskLoop } from "@/lib/tasks";
import { listSkills, renderSkill } from "@/lib/skills";
import { uid } from "@/lib/utils";

export async function GET() {
  return NextResponse.json({ skills: listSkills() });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const rendered = renderSkill(String(body.id ?? ""));
  if (!rendered) return NextResponse.json({ error: "unknown skill" }, { status: 404 });

  const now = Date.now();
  const task: BgTask = {
    id: uid("task"),
    title: rendered.title,
    agentId: null,
    provider: rendered.provider,
    steps: [{ id: uid("st"), label: rendered.title, prompt: rendered.steps, sensitive: false, done: false, ok: null }],
    status: "in_progress",
    currentStep: 0,
    pendingStep: null,
    approvedSteps: [],
    requiresApproval: false,
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
