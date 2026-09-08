import { NextResponse } from "next/server";
import { getAgents } from "@/lib/store";
import { decideApproval, toolCatalog } from "@/lib/tools";
import { getToolPermissions, saveToolPermissions, type ToolLevel } from "@/lib/store";

const LEVELS: ToolLevel[] = ["allow", "ask", "disabled"];

export async function GET() {
  const [perms, agents] = await Promise.all([getToolPermissions(), getAgents()]);
  const tools = toolCatalog().map((t) => ({
    ...t,
    def: perms.defaults[t.id] ?? "allow",
    overrides: Object.fromEntries(
      Object.entries(perms.overrides)
        .filter(([, m]) => m[t.id])
        .map(([agentId, m]) => [agentId, m[t.id]])
    ),
  }));
  return NextResponse.json({
    tools,
    agents: agents.map((a) => ({ id: a.id, name: a.name })),
    approvals: [...perms.approvals].reverse().slice(0, 50),
  });
}

export async function PATCH(req: Request) {
  const body = await req.json().catch(() => ({}));
  const tool = String(body.tool ?? "");
  const level = body.level as ToolLevel;
  if (!toolCatalog().some((t) => t.id === tool)) return NextResponse.json({ error: "unknown tool" }, { status: 404 });
  const isAgentScope = typeof body.agentId === "string" && body.agentId;
  if (![...LEVELS, ...(isAgentScope ? ["inherit"] : [])].includes(level)) {
    return NextResponse.json({ error: "level must be allow|ask|disabled" + (isAgentScope ? "|inherit" : "") }, { status: 400 });
  }

  const perms = await getToolPermissions();
  if (typeof body.agentId === "string" && body.agentId) {
    const agents = await getAgents();
    if (!agents.some((a) => a.id === body.agentId)) return NextResponse.json({ error: "agent not found" }, { status: 404 });
    if (body.level === "inherit") {
      if (perms.overrides[body.agentId]) delete perms.overrides[body.agentId][tool];
      if (perms.overrides[body.agentId] && !Object.keys(perms.overrides[body.agentId]).length) {
        delete perms.overrides[body.agentId];
      }
    } else {
      perms.overrides[body.agentId] = { ...(perms.overrides[body.agentId] ?? {}), [tool]: level };
    }
  } else {
    perms.defaults[tool] = level;
  }
  await saveToolPermissions(perms);
  return NextResponse.json({ ok: true });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  if (!body.id || (body.decision !== "approve" && body.decision !== "deny")) {
    return NextResponse.json({ error: "id + decision (approve|deny) required" }, { status: 400 });
  }
  const ok = await decideApproval(body.id, body.decision === "approve");
  if (!ok) return NextResponse.json({ error: "request not found or already decided" }, { status: 409 });
  return NextResponse.json({ ok: true });
}
