import { execFile } from "child_process";
import { NextResponse } from "next/server";
import os from "os";
import { detectProviders } from "@/lib/providers";
import { allRunners } from "@/lib/runners";
import { getAgents, getUsage } from "@/lib/store";

function cpuSnapshot() {
  let idle = 0;
  let total = 0;
  for (const c of os.cpus()) {
    for (const [k, v] of Object.entries(c.times)) {
      total += v;
      if (k === "idle") idle += v;
    }
  }
  return { idle, total };
}

async function hostCpuPct(sampleMs = 400): Promise<number | null> {
  try {
    const a = cpuSnapshot();
    await new Promise((r) => setTimeout(r, sampleMs));
    const b = cpuSnapshot();
    const idle = b.idle - a.idle;
    const total = b.total - a.total;
    if (total <= 0) return null;
    return Math.max(0, Math.min(100, Math.round(((total - idle) / total) * 100)));
  } catch {
    return null;
  }
}

function gpuInfo(): Promise<{ name: string; utilPct: number; memUsedMb: number; memTotalMb: number } | null> {
  return new Promise((resolve) => {
    const p = execFile(
      "nvidia-smi",
      ["--query-gpu=name,utilization.gpu,memory.used,memory.total", "--format=csv,noheader,nounits"],
      { timeout: 4000 },
      (err, stdout) => {
        if (err) return resolve(null);
        const line = stdout.trim().split("\n")[0];
        if (!line) return resolve(null);
        const [name, util, memUsed, memTotal] = line.split(",").map((s) => s.trim());
        const utilPct = Number(util);
        const memUsedMb = Number(memUsed);
        const memTotalMb = Number(memTotal);
        if ([utilPct, memUsedMb, memTotalMb].some((n) => !Number.isFinite(n))) return resolve(null);
        resolve({ name, utilPct, memUsedMb, memTotalMb });
      }
    );
    p.on("error", () => resolve(null));
  });
}

export async function GET() {
  const [agents, usage, detected] = await Promise.all([getAgents(), getUsage(), detectProviders()]);

  const [cpuPct, gpu] = await Promise.all([hostCpuPct(), gpuInfo()]);
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;

  const byAgent = new Map<string, { tokens: number; latSum: number; latN: number; lastTs: number; lastErrorTs: number }>();
  for (const u of usage) {
    if (!u.agentId) continue;
    const e = byAgent.get(u.agentId) ?? { tokens: 0, latSum: 0, latN: 0, lastTs: 0, lastErrorTs: 0 };
    e.tokens += u.inputTokens + u.outputTokens;
    if (u.ok && u.durationMs > 0) {
      e.latSum += u.durationMs;
      e.latN += 1;
    }
    if (u.ts > e.lastTs) e.lastTs = u.ts;
    if (!u.ok && u.ts > e.lastErrorTs) e.lastErrorTs = u.ts;
    byAgent.set(u.agentId, e);
  }

  const now = Date.now();
  const runnerIds = new Set(allRunners().map((r) => r.id));
  const installed = new Map(detected.map((d) => [d.id, d.installed] as const));

  const fleet = agents.map((a) => {
    const stats = byAgent.get(a.id);
    const providerOk = runnerIds.has(a.provider) ? (installed.get(a.provider) ?? false) : false;
    let status: "Online" | "Idle" | "Degraded" = "Idle";
    let note: string | null = null;
    if (a.status === "running") status = "Online";
    else if (a.status === "error") {
      status = "Degraded";
      note = "last run errored";
    } else if (!providerOk) {
      status = "Degraded";
      note = `provider ${a.provider} not installed`;
    } else if (stats && now - stats.lastErrorTs < 15 * 60 * 1000 && stats.lastErrorTs >= stats.lastTs) {
      status = "Degraded";
      note = "recent error";
    }
    return {
      id: a.id,
      name: a.name,
      provider: a.provider,
      agentStatus: a.status,
      status,
      note,
      tokens: stats?.tokens ?? 0,
      avgLatencyMs: stats && stats.latN ? Math.round(stats.latSum / stats.latN) : null,
      lastTs: stats?.lastTs ?? null,
    };
  });

  return NextResponse.json({
    ok: true,
    host: {
      cpuPct,
      cores: os.cpus().length,
      load1: os.loadavg()[0],
      memTotal: totalMem,
      memUsed: usedMem,
      memPct: Math.round((usedMem / totalMem) * 100),
      uptimeSec: Math.floor(os.uptime()),
      gpu,
    },
    fleet,
  });
}
