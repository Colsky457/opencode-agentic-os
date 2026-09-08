import { NextResponse } from "next/server";
import {
  autoLink,
  getAgents,
  getGraph,
  getSessions,
  logUsage,
  recordHealth,
  saveGraph,
  saveSessions,
} from "@/lib/store";
import { uid } from "@/lib/utils";
import { saveChatToBrain } from "@/lib/brain";
import { resolveSystemPrompt } from "@/lib/platforms";
import { detectProviders } from "@/lib/providers";
import { routePrompt } from "@/lib/routing";
import { getRunner } from "@/lib/runners";
import { gateTool } from "@/lib/tools";
import { appendTranscriptEvent } from "@/lib/transcripts";
import { searchVault } from "@/lib/vault";

/** Demo-mode fake stream when provider quota is exhausted or user toggles demo. */
const DEMO_LINES = [
  "Rerouting through local demo core… (Provider quota is exhausted, so I'm simulating.)\n\n",
  "Here's the sharp version: your mission control is **online**, the fleet is idle, and shared memory is mapped.\n\n",
  "Top up the provider budget pool, then flip **demo mode off** in Settings to resume live inference. Meanwhile — want me to draft a mission brief, spin up a scout agent, or grow the knowledge graph?",
];

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const message = String(body.message ?? "").slice(0, 8000);
  const model = body.model ? String(body.model) : undefined;
  const agentId = body.agentId ? String(body.agentId) : null;
  const sessionId = body.sessionId ? String(body.sessionId) : null;
  const demo = Boolean(body.demo);
  const resumeId = body.resumeId ? String(body.resumeId) : undefined;
  const useVault = Boolean(body.vault);

  if (!message.trim()) return NextResponse.json({ error: "Empty message" }, { status: 400 });

  // Resolve agent persona for system prompt + provider
  let agentPart: string | undefined;
  let agentName: string | undefined;
  let agentProvider: string | undefined;
  if (agentId) {
    const agents = await getAgents();
    const a = agents.find((x) => x.id === agentId);
    if (a?.systemPrompt) agentPart = `You are ${a.name}. ${a.persona}. ${a.systemPrompt}`;
    if (a) {
      agentName = a.name;
      agentProvider = a.provider;
    }
  }
  const requested = typeof body.provider === "string" && body.provider ? body.provider : agentProvider;
  // "auto" (or nothing without an agent) → keyword routing; explicit choice always wins.
  // An agent persona locks routing to its own provider (keywords still reported).
  // Only installed providers are routing candidates.
  const auto = !requested || requested === "auto";
  let decision = null as null | { provider: string; matched: string[]; auto: true };
  if (auto) {
    const detected = await detectProviders().catch(() => []);
    const installed = detected.filter((d) => d.installed).map((d) => d.id);
    const candidates = (agentProvider ? [agentProvider] : installed.length ? installed : undefined) as string[] | undefined;
    decision = routePrompt(message, candidates);
  }
  const runner = getRunner(decision ? decision.provider : requested);
  const autoRouted = auto;
  const autoMatched = decision?.matched ?? [];
  let systemPrompt: string | undefined = resolveSystemPrompt(runner.id, agentPart) || undefined;

  // ---- Vault RAG: retrieve top chunks and fold into the system prompt ----
  let citations: { file: string; title: string; chunkIndex: number; text: string }[] = [];
  if (useVault && !demo) {
    try {
      const { hits } = await searchVault(message, 4);
      citations = hits.map((h) => ({ file: h.file, title: h.title, chunkIndex: h.chunkIndex, text: h.text }));
      if (citations.length) {
        const ctx = citations
          .map((c, i) => `[S${i + 1}] ${c.title} (${c.file.split("/").slice(-2).join("/")}):\n${c.text}`)
          .join("\n\n");
        const rag = `Use the vault excerpts below when relevant. Cite them inline as [S1], [S2], etc.\n\n${ctx}`;
        systemPrompt = systemPrompt ? `${systemPrompt}\n\n${rag}` : rag;
      }
    } catch {}
  }
  const brainSave = () => {
    saveChatToBrain(sessionRef, agentName).catch(() => {});
  };

  // Persist user message
  const sessions = await getSessions();
  let session = sessionId ? sessions.find((s) => s.id === sessionId) : undefined;
  if (!session) {
    session = {
      id: sessionId || uid("sess"),
      title: message.slice(0, 48),
      agentId,
      model: model ?? "default",
      messages: [],
      claudeSessionId: resumeId ?? null,
      provider: runner.id,
      autoRouted,
      providerSessions: resumeId ? { [runner.id]: resumeId } : {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    sessions.unshift(session);
  }
  session.provider = runner.id;
  session.autoRouted = autoRouted;
  const userMsg = { role: "user", content: message, ts: Date.now() } as const;
  session.messages.push(userMsg);
  session.updatedAt = Date.now();
  await saveSessions(sessions);
  void appendTranscriptEvent(session, userMsg);

  const encoder = new TextEncoder();
  const sessionRef = session;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));

      // ---- Demo mode: local simulation, no CLI burn ----
      if (demo) {
        send({ type: "meta", sessionId: sessionRef.id, demo: true });
        let full = "";
        for (const chunk of DEMO_LINES) {
          full += chunk;
          send({ type: "delta", text: chunk });
          await new Promise((r) => setTimeout(r, 260));
        }
        sessionRef.messages.push({ role: "assistant", content: full, ts: Date.now() });
        sessionRef.updatedAt = Date.now();
        await saveSessions(sessions);
        brainSave();
        void appendTranscriptEvent(sessionRef, sessionRef.messages[sessionRef.messages.length - 1]);
        await logUsage({
          id: uid("u"),
          ts: Date.now(),
          agentId,
          sessionId: sessionRef.id,
          inputTokens: 0,
          outputTokens: 0,
          costUsd: 0,
          durationMs: 0,
          ok: true,
        });
        send({ type: "done", sessionId: sessionRef.id, usage: null, demo: true });
        controller.close();
        return;
      }

      // ---- Live: stream the selected provider CLI ----
      send({ type: "meta", sessionId: sessionRef.id, provider: runner.id, auto: autoRouted, matched: autoMatched });
      let full = "";
      try {
        const blocked = await gateTool(`cli:${runner.id}`, agentId, `Chat: ${message.slice(0, 120)}`);
        if (blocked) {
          send({ type: "error", error: blocked.message });
          controller.close();
          return;
        }
        const resumeFor =
          sessionRef.providerSessions?.[runner.id] ??
          (runner.id === "claude" ? sessionRef.claudeSessionId ?? resumeId : resumeId);
        const meta = await runner.chat({
          prompt: message,
          model,
          systemPrompt,
          resumeSessionId: resumeFor ?? undefined,
          onDelta: (text) => {
            full += text;
            send({ type: "delta", text });
          },
        });
        if (meta.sessionId) {
          sessionRef.providerSessions = { ...(sessionRef.providerSessions ?? {}), [runner.id]: meta.sessionId };
          if (runner.id === "claude") sessionRef.claudeSessionId = meta.sessionId;
        }

        if (meta.isError) {
          await recordHealth({ lastError: meta.errorText ?? `${runner.label} error`, lastErrorTs: Date.now() });
          await logUsage({
            id: uid("u"),
            ts: Date.now(),
            agentId,
            sessionId: sessionRef.id,
            inputTokens: meta.inputTokens,
            outputTokens: meta.outputTokens,
            costUsd: meta.costUsd,
            durationMs: meta.durationMs,
            ok: false,
            error: meta.errorText ?? undefined,
            provider: runner.id,
          });
          send({ type: "error", error: meta.errorText ?? `${runner.label} returned an error`, quota: /402|quota|budget|rate.?limit|429/i.test(meta.errorText ?? "") });
          controller.close();
          return;
        }

        await recordHealth({ lastOk: Date.now(), lastError: undefined });
        sessionRef.messages.push({
          role: "assistant",
          content: full || "(empty response)",
          ts: Date.now(),
          tokens: meta.inputTokens + meta.outputTokens,
        });
        sessionRef.updatedAt = Date.now();
        await saveSessions(sessions);
        brainSave();
        void appendTranscriptEvent(sessionRef, sessionRef.messages[sessionRef.messages.length - 1]);
        await logUsage({
          id: uid("u"),
          ts: Date.now(),
          agentId,
          sessionId: sessionRef.id,
          inputTokens: meta.inputTokens,
          outputTokens: meta.outputTokens,
          costUsd: meta.costUsd,
          durationMs: meta.durationMs,
          ok: true,
          provider: runner.id,
        });
        // grow memory graph with this exchange
        try {
          const g = await getGraph();
          const nid = uid("chat");
          g.nodes.push({ id: nid, label: message.slice(0, 60), type: "chat", detail: full.slice(0, 200) });
          autoLink(message, g.nodes, g.edges, nid);
          await saveGraph(g);
        } catch {}
        send({
          type: "done",
          sessionId: sessionRef.id,
          claudeSessionId: sessionRef.claudeSessionId,
          usage: { input: meta.inputTokens, output: meta.outputTokens, cost: meta.costUsd, ms: meta.durationMs },
          citations,
          auto: autoRouted,
          matched: autoMatched,
        });
        controller.close();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "stream failed";
        send({ type: "error", error: msg });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
  });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const sessions = await getSessions();
  if (id) {
    const s = sessions.find((x) => x.id === id);
    return NextResponse.json({ session: s ?? null });
  }
  const agentFilter = searchParams.get("agent");
  const list = agentFilter ? sessions.filter((s) => s.agentId === agentFilter) : sessions;
  return NextResponse.json({
    sessions: list.map((s) => ({
      id: s.id,
      title: s.title,
      agentId: s.agentId,
      model: s.model,
      provider: (s as { provider?: string }).provider ?? "claude",
      autoRouted: (s as { autoRouted?: boolean }).autoRouted ?? false,
      updatedAt: s.updatedAt,
      count: s.messages.length,
    })),
  });
}
