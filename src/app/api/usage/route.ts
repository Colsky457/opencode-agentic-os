import { NextResponse } from "next/server";
import { getUsage } from "@/lib/store";

export async function GET() {
  const usage = await getUsage();
  const byDay = new Map<string, { tokens: number; cost: number; calls: number; errors: number }>();
  for (const u of usage) {
    const day = new Date(u.ts).toISOString().slice(0, 10);
    const d = byDay.get(day) ?? { tokens: 0, cost: 0, calls: 0, errors: 0 };
    d.tokens += u.inputTokens + u.outputTokens;
    d.cost += u.costUsd;
    d.calls += 1;
    if (!u.ok) d.errors += 1;
    byDay.set(day, d);
  }
  const daily = [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .slice(-14)
    .map(([day, v]) => ({ day: day.slice(5), ...v, cost: Number(v.cost.toFixed(4)) }));
  const totals = {
    calls: usage.length,
    tokens: usage.reduce((s, u) => s + u.inputTokens + u.outputTokens, 0),
    cost: Number(usage.reduce((s, u) => s + u.costUsd, 0).toFixed(4)),
    errors: usage.filter((u) => !u.ok).length,
  };
  const byProviderMap = new Map<string, { calls: number; tokens: number; cost: number; errors: number; latencySum: number; latencyN: number; lastTs: number }>();
  for (const u of usage) {
    const p = u.provider ?? "unknown";
    const e = byProviderMap.get(p) ?? { calls: 0, tokens: 0, cost: 0, errors: 0, latencySum: 0, latencyN: 0, lastTs: 0 };
    e.calls += 1;
    e.tokens += u.inputTokens + u.outputTokens;
    e.cost += u.costUsd;
    if (!u.ok) e.errors += 1;
    if (u.ok && u.durationMs > 0) {
      e.latencySum += u.durationMs;
      e.latencyN += 1;
    }
    if (u.ts > e.lastTs) e.lastTs = u.ts;
    byProviderMap.set(p, e);
  }
  const byProvider = [...byProviderMap.entries()].map(([provider, e]) => ({
    provider,
    calls: e.calls,
    tokens: e.tokens,
    cost: Number(e.cost.toFixed(4)),
    errors: e.errors,
    avgLatencyMs: e.latencyN ? Math.round(e.latencySum / e.latencyN) : null,
    lastTs: e.lastTs,
  }));
  return NextResponse.json({ totals, daily, byProvider, recent: usage.slice(-30).reverse() });
}
