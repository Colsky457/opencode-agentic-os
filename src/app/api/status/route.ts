import { NextResponse } from "next/server";
import { loadConfigSync } from "@/lib/config";
import { detectProviders } from "@/lib/providers";
import { allRunners, getRunner } from "@/lib/runners";
import { getAgents, getHealth, getSessions, getUsage } from "@/lib/store";

export async function GET() {
  const cfg = loadConfigSync();
  const [agents, sessions, usage, health, detected] = await Promise.all([
    getAgents(),
    getSessions(),
    getUsage(),
    getHealth(),
    detectProviders(),
  ]);
  const versions: Record<string, string | null> = {};
  await Promise.all(
    allRunners().map(async (r) => {
      versions[r.id] = await r.version().catch(() => null);
    })
  );
  const def = getRunner().id;
  const version = versions[def] ?? null;
  const running = agents.filter((a) => a.status === "running").length;
  const totalCost = usage.reduce((s, u) => s + (u.costUsd || 0), 0);
  const totalTokens = usage.reduce((s, u) => s + u.inputTokens + u.outputTokens, 0);
  return NextResponse.json({
    ok: true,
    provider: def,
    providers: allRunners().map((r) => ({
      id: r.id,
      label: r.label,
      glyph: r.glyph,
      color: r.color,
      streaming: r.supportsStreaming,
      version: versions[r.id] ?? null,
      installed: (detected.find((d) => d.id === r.id)?.installed ?? versions[r.id] !== null),
    })),
    claudeVersion: version,
    claudeConnected: version !== null,
    lastError: health.lastError ?? null,
    lastErrorTs: health.lastErrorTs ?? null,
    counts: {
      agents: agents.length,
      running,
      sessions: sessions.length,
      usageEvents: usage.length,
    },
    totals: { costUsd: totalCost, tokens: totalTokens },
    server: { host: cfg.server.host, port: cfg.server.port },
    models: cfg.chat.models?.length ? cfg.chat.models : ["default"],
    demoMode: Boolean(cfg.ui.demoMode),
  });
}
