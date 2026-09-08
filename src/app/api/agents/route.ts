import { NextResponse } from "next/server";
import { isAgentRunning, runningPids } from "@/lib/claude";
import { getAgents, saveAgents, type Agent } from "@/lib/store";
import { uid } from "@/lib/utils";
import { detectProviders } from "@/lib/providers";
import { allRunners, getRunner } from "@/lib/runners";

const PALETTE = ["#ff6b1a", "#8b5cf6", "#22e6c8", "#ffd166", "#ff4d6d", "#4da6ff"];

export async function GET() {
  const agents = await getAgents();
  const pids = runningPids();
  // reconcile: mark running if pid alive, else idle (unless error)
  let changed = false;
  for (const a of agents) {
    if (typeof a.avatarSeed !== "number") {
      a.avatarSeed = 0;
      changed = true;
    }
    const alive = pids[a.id] != null && isAgentRunning(a.id);
    if (alive && a.status !== "running") {
      a.status = "running";
      a.pid = pids[a.id];
      changed = true;
    } else if (!alive && a.status === "running") {
      a.status = "idle";
      a.pid = null;
      changed = true;
    }
  }
  if (changed) await saveAgents(agents);
  // auto-provision one fleet agent per installed+supported provider CLI
  try {
    const found = await detectProviders();
    let added = false;
    for (const p of found) {
      if (!p.installed || !p.supported) continue;
      if (agents.some((a) => a.provider === p.id)) continue;
      const runner = getRunner(p.id);
      const now = Date.now();
      agents.push({
        id: uid("ag"),
        name: runner.label,
        persona: `${runner.label} CLI operator`,
        systemPrompt: `You are ${runner.label}, an AI coding operator running inside ClaudeOS. Be terse, act decisively, report results.`,
        model: "",
        color: runner.color,
        avatarSeed: 0,
        provider: p.id,
        status: "idle",
        pid: null,
        lastTask: "",
        createdAt: now,
        updatedAt: now,
      });
      added = true;
    }
    if (added) await saveAgents(agents);
  } catch {}
  return NextResponse.json({ agents });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const agents = await getAgents();
  const now = Date.now();
  const agent: Agent = {
    id: uid("ag"),
    name: String(body.name ?? "New Agent").slice(0, 60),
    persona: String(body.persona ?? "Autonomous operator").slice(0, 200),
    systemPrompt: String(body.systemPrompt ?? "You are a sharp, loyal AI operator. Be terse, act decisively, report results.").slice(0, 4000),
    model: String(body.model ?? "") || "",
    color: String(body.color ?? PALETTE[agents.length % PALETTE.length]),
    avatarSeed: typeof body.avatarSeed === "number" ? body.avatarSeed : 0,
    provider: typeof body.provider === "string" && allRunners().some((r) => r.id === body.provider) ? body.provider : "claude",
    status: "idle",
    pid: null,
    lastTask: "",
    createdAt: now,
    updatedAt: now,
  };
  // seed defaults on first run
  if (agents.length === 0 && !body.name) {
    const seeds: Agent[] = [
      {
        id: uid("ag"),
        name: "Scout",
        persona: "Recon specialist",
        systemPrompt: "You are Scout, a recon specialist. Explore fast, summarize findings in bullets, flag risks.",
        model: "",
        color: PALETTE[0],
        avatarSeed: 0,
        provider: "claude",
        status: "idle",
        pid: null,
        lastTask: "",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: uid("ag"),
        name: "Forge",
        persona: "Build engineer",
        systemPrompt: "You are Forge, a build engineer. Write clean, tested code. Explain each change briefly.",
        model: "",
        color: PALETTE[1],
        avatarSeed: 0,
        provider: "claude",
        status: "idle",
        pid: null,
        lastTask: "",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: uid("ag"),
        name: "Oracle",
        persona: "Research analyst",
        systemPrompt: "You are Oracle, a research analyst. Answer with sources, trade-offs, and a recommendation.",
        model: "",
        color: PALETTE[2],
        avatarSeed: 0,
        provider: "claude",
        status: "idle",
        pid: null,
        lastTask: "",
        createdAt: now,
        updatedAt: now,
      },
    ];
    await saveAgents(seeds);
    return NextResponse.json({ agents: seeds });
  }
  agents.unshift(agent);
  await saveAgents(agents);
  return NextResponse.json({ agent });
}

export async function PATCH(req: Request) {
  const body = await req.json().catch(() => ({}));
  const agents = await getAgents();
  const a = agents.find((x) => x.id === body.id);
  if (!a) return NextResponse.json({ error: "not found" }, { status: 404 });
  for (const k of ["name", "persona", "systemPrompt", "model", "color"] as const) {
    if (typeof body[k] === "string") (a as unknown as Record<string, unknown>)[k] = String(body[k]).slice(0, 4000);
  }
  if (typeof body.avatarSeed === "number") a.avatarSeed = body.avatarSeed;
  if (typeof body.provider === "string" && body.provider) {
    if (allRunners().some((r) => r.id === body.provider)) a.provider = body.provider;
  }
  a.updatedAt = Date.now();
  await saveAgents(agents);
  return NextResponse.json({ agent: a });
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const agents = await getAgents();
  await saveAgents(agents.filter((a) => a.id !== id));
  return NextResponse.json({ ok: true });
}
