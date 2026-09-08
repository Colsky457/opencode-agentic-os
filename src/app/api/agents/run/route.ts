import { NextResponse } from "next/server";
import { readLog, startAgentTask, stopAgentTask } from "@/lib/claude";
import { resolveSystemPrompt } from "@/lib/platforms";
import { getAgents, saveAgents } from "@/lib/store";
import { gateTool } from "@/lib/tools";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const { agentId, task } = body as { agentId?: string; task?: string };
  if (!agentId) return NextResponse.json({ error: "agentId required" }, { status: 400 });
  const agents = await getAgents();
  const a = agents.find((x) => x.id === agentId);
  if (!a) return NextResponse.json({ error: "agent not found" }, { status: 404 });
  const blocked = await gateTool("fleet", a.id, `Start ${a.name}: ${String(task ?? "").slice(0, 120)}`);
  if (blocked) return NextResponse.json({ error: blocked.message }, { status: 403 });
  try {
    const { pid } = await startAgentTask({
      id: a.id,
      name: a.name,
      systemPrompt: resolveSystemPrompt(a.provider, `You are ${a.name}. ${a.persona}. ${a.systemPrompt}`) || undefined,
      model: a.model || undefined,
      task: String(task ?? "Report status and stand by for orders.").slice(0, 4000),
      provider: a.provider,
    });
    a.status = "running";
    a.pid = pid;
    a.lastTask = String(task ?? "").slice(0, 200);
    a.updatedAt = Date.now();
    await saveAgents(agents);
    return NextResponse.json({ ok: true, pid });
  } catch (e) {
    a.status = "error";
    a.updatedAt = Date.now();
    await saveAgents(agents);
    return NextResponse.json({ error: e instanceof Error ? e.message : "start failed" }, { status: 409 });
  }
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const agentId = searchParams.get("agentId");
  if (!agentId) return NextResponse.json({ error: "agentId required" }, { status: 400 });
  const ok = await stopAgentTask(agentId);
  const agents = await getAgents();
  const a = agents.find((x) => x.id === agentId);
  if (a) {
    a.status = "idle";
    a.pid = null;
    a.updatedAt = Date.now();
    await saveAgents(agents);
  }
  return NextResponse.json({ ok });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const agentId = searchParams.get("agentId");
  if (!agentId) return NextResponse.json({ error: "agentId required" }, { status: 400 });
  const log = await readLog(agentId);
  return NextResponse.json({ log });
}
