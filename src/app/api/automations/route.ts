import { NextResponse } from "next/server";
import {
  describeAction,
  describeTrigger,
  ensureScheduler,
  executeAutomation,
  parseCronish,
} from "@/lib/automations";
import {
  getAgents,
  getAutomations,
  getPrompts,
  saveAutomations,
  type Automation,
  type AutomationAction,
  type AutomationTrigger,
} from "@/lib/store";
import { allRunners } from "@/lib/runners";
import { uid } from "@/lib/utils";

function validProvider(p: unknown): p is string {
  return typeof p === "string" && allRunners().some((r) => r.id === p);
}

export async function GET() {
  ensureScheduler();
  let automations = await getAutomations();
  if (!automations.length) {
    const now = Date.now();
    automations = [
      {
        id: uid("auto"),
        name: "Morning mission brief",
        enabled: false,
        trigger: { kind: "cron", expr: "daily 08:00" },
        action: {
          kind: "prompt",
          body: "Summarize the current mission state: goal, progress, blockers, next 3 actions. Be terse, use bullets, end with one sharp question.",
          agentId: null,
        },
        lastRun: null,
        lastStatus: null,
        lastError: null,
        runCount: 0,
        history: [],
        createdAt: now,
        updatedAt: now,
      },
    ];
    await saveAutomations(automations);
  }
  return NextResponse.json({
    automations: automations.map((a) => ({
      ...a,
      triggerLabel: describeTrigger(a),
      actionLabel: describeAction(a),
    })),
  });
}

export async function POST(req: Request) {
  ensureScheduler();
  const body = await req.json().catch(() => ({}));
  if (body.id && body.runNow) {
    const r = await executeAutomation(body.id, "manual");
    return NextResponse.json(r, { status: r.ok ? 200 : 502 });
  }

  const name = String(body.name ?? "").trim().slice(0, 120);
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 });

  let trigger: AutomationTrigger;
  if (body.trigger?.kind === "git" || body.triggerKind === "git") {
    trigger = {
      kind: "git",
      repo: String(body.trigger?.repo ?? body.repo ?? "").slice(0, 200) || undefined,
      branch: String(body.trigger?.branch ?? body.branch ?? "").slice(0, 120) || undefined,
    };
  } else {
    const expr = String(body.trigger?.expr ?? body.expr ?? "daily 20:00").trim().slice(0, 40);
    const parsed = parseCronish(expr);
    if (parsed.kind === "invalid") return NextResponse.json({ error: parsed.error }, { status: 400 });
    trigger = { kind: "cron", expr };
  }

  let action: AutomationAction;
  const ak = body.action?.kind ?? body.actionKind ?? "prompt";
  if (ak === "digest") {
    action = { kind: "digest" };
  } else if (ak === "script") {
    const script = String(body.action?.script ?? body.script ?? "").trim().slice(0, 4000);
    if (!script) return NextResponse.json({ error: "script required" }, { status: 400 });
    action = { kind: "script", script };
  } else {
    const promptId = typeof (body.action?.promptId ?? body.promptId) === "string" ? body.action?.promptId ?? body.promptId : undefined;
    const rawBody = String(body.action?.body ?? body.body ?? "").trim().slice(0, 8000);
    if (!promptId && !rawBody) return NextResponse.json({ error: "prompt template or body required" }, { status: 400 });
    if (promptId) {
      const prompts = await getPrompts();
      if (!prompts.some((p) => p.id === promptId)) return NextResponse.json({ error: "prompt template not found" }, { status: 404 });
    }
    const agentId = typeof (body.action?.agentId ?? body.agentId) === "string" ? body.action?.agentId ?? body.agentId : null;
    if (agentId) {
      const agents = await getAgents();
      if (!agents.some((a) => a.id === agentId)) return NextResponse.json({ error: "agent not found" }, { status: 404 });
    }
    const provider = body.action?.provider ?? body.provider;
    action = {
      kind: "prompt",
      promptId,
      body: rawBody || undefined,
      agentId,
      provider: validProvider(provider) ? provider : undefined,
    };
  }

  const now = Date.now();
  const automation: Automation = {
    id: uid("auto"),
    name,
    enabled: body.enabled !== false,
    trigger,
    action,
    lastRun: null,
    lastStatus: null,
    lastError: null,
    runCount: 0,
    history: [],
    createdAt: now,
    updatedAt: now,
  };
  const all = await getAutomations();
  all.unshift(automation);
  await saveAutomations(all);
  return NextResponse.json({
    automation: { ...automation, triggerLabel: describeTrigger(automation), actionLabel: describeAction(automation) },
  });
}

export async function PATCH(req: Request) {
  ensureScheduler();
  const body = await req.json().catch(() => ({}));
  const all = await getAutomations();
  const a = all.find((x) => x.id === body.id);
  if (!a) return NextResponse.json({ error: "not found" }, { status: 404 });

  if (typeof body.name === "string" && body.name.trim()) a.name = body.name.trim().slice(0, 120);
  if (typeof body.enabled === "boolean") a.enabled = body.enabled;
  if (body.trigger?.kind === "git" || body.triggerKind === "git") {
    a.trigger = {
      kind: "git",
      repo: String(body.trigger?.repo ?? body.repo ?? (a.trigger.kind === "git" ? a.trigger.repo : "") ?? "").slice(0, 200) || undefined,
      branch: String(body.trigger?.branch ?? body.branch ?? (a.trigger.kind === "git" ? a.trigger.branch : "") ?? "").slice(0, 120) || undefined,
    };
  } else if (typeof (body.trigger?.expr ?? body.expr) === "string") {
    const expr = String(body.trigger?.expr ?? body.expr).trim().slice(0, 40);
    const parsed = parseCronish(expr);
    if (parsed.kind === "invalid") return NextResponse.json({ error: parsed.error }, { status: 400 });
    a.trigger = { kind: "cron", expr };
  }
  // action edits: replace wholesale when actionKind provided
  if (body.action?.kind ?? body.actionKind) {
    const ak = body.action?.kind ?? body.actionKind;
    if (ak === "digest") a.action = { kind: "digest" };
    else if (ak === "script" && typeof (body.action?.script ?? body.script) === "string") {
      a.action = { kind: "script", script: String(body.action?.script ?? body.script).slice(0, 4000) };
    } else if (ak === "prompt") {
      a.action = {
        kind: "prompt",
        promptId: typeof body.action?.promptId === "string" ? body.action.promptId : undefined,
        body: typeof body.action?.body === "string" ? body.action.body.slice(0, 8000) : undefined,
        agentId: typeof body.action?.agentId === "string" ? body.action.agentId : null,
        provider: validProvider(body.action?.provider) ? body.action.provider : undefined,
      };
    }
  }
  a.updatedAt = Date.now();
  await saveAutomations(all);
  return NextResponse.json({ automation: { ...a, triggerLabel: describeTrigger(a), actionLabel: describeAction(a) } });
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const all = await getAutomations();
  await saveAutomations(all.filter((a) => a.id !== searchParams.get("id")));
  return NextResponse.json({ ok: true });
}
