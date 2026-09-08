"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { AgentAvatar } from "@/components/os/AgentAvatar";
import { ProviderBadge } from "@/components/os/ProviderBadge";
import { Card, EmptyState, Pill, SectionTitle } from "@/components/os/ui";
import { formatTokens, timeAgo } from "@/lib/utils";

interface FleetRow {
  id: string;
  name: string;
  provider: string;
  agentStatus: string;
  status: "Online" | "Idle" | "Degraded";
  note: string | null;
  tokens: number;
  avgLatencyMs: number | null;
  lastTs: number | null;
}

interface SystemData {
  host: {
    cpuPct: number | null;
    cores: number;
    load1: number;
    memTotal: number;
    memUsed: number;
    memPct: number;
    uptimeSec: number;
    gpu: { name: string; utilPct: number; memUsedMb: number; memTotalMb: number } | null;
  };
  fleet: FleetRow[];
}

function Gauge({ label, value, display, sub, color }: { label: string; value: number | null; display: string; sub: string; color: string }) {
  const pct = value == null ? 0 : Math.max(0, Math.min(100, value));
  const r = 44;
  const circ = 2 * Math.PI * r;
  return (
    <div className="glass rounded-2xl p-4">
      <div className="text-[10px] font-semibold tracking-[0.25em] opacity-50">{label}</div>
      <div className="mt-2 flex items-center gap-3">
        <div className="relative h-24 w-24 shrink-0">
          <svg viewBox="0 0 100 100" className="h-24 w-24 -rotate-90">
            <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="10" />
            <motion.circle
              cx="50"
              cy="50"
              r={r}
              fill="none"
              stroke={color}
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={circ}
              initial={{ strokeDashoffset: circ }}
              animate={{ strokeDashoffset: circ - (circ * pct) / 100 }}
              transition={{ type: "spring", stiffness: 60, damping: 18 }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="font-display text-lg font-black">{value == null ? "—" : display}</span>
          </div>
        </div>
        <div className="min-w-0 text-xs opacity-60">{value == null ? "not available on this host" : sub}</div>
      </div>
    </div>
  );
}

function fmtBytes(n: number) {
  if (n >= 1 << 30) return `${(n / (1 << 30)).toFixed(1)} GB`;
  return `${Math.round(n / (1 << 20))} MB`;
}

function fmtUptime(sec: number) {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  if (d > 0) return `${d}d ${h}h`;
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function fmtLatency(ms: number | null) {
  if (ms == null) return "—";
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${ms}ms`;
}

const STATUS_TONE: Record<FleetRow["status"], "green" | "neutral" | "amber"> = {
  Online: "green",
  Idle: "neutral",
  Degraded: "amber",
};

export default function SystemPage() {
  const [data, setData] = useState<SystemData | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () => {
      fetch("/api/system")
        .then((r) => r.json())
        .then((d) => {
          if (alive) setData(d);
        })
        .catch(() => {});
    };
    load();
    const t = setInterval(load, 5000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const h = data?.host;
  const memPct = h ? Math.round((h.memUsed / h.memTotal) * 100) : null;

  return (
    <div className="space-y-4">
      <div>
        <div className="text-[10px] font-semibold tracking-[0.28em] text-[#ff8c42] uppercase">system telemetry</div>
        <h1 className="font-display text-2xl font-black tracking-tight sm:text-3xl">Host & Fleet Health</h1>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Gauge
          label="HOST CPU"
          value={h?.cpuPct ?? null}
          display={`${h?.cpuPct ?? 0}%`}
          sub={`${h?.cores ?? "?"} cores · load ${h?.load1?.toFixed(2) ?? "?"}`}
          color="#ff6b1a"
        />
        <Gauge
          label="HOST RAM"
          value={memPct}
          display={h ? `${h.memPct}%` : "—"}
          sub={h ? `${fmtBytes(h.memUsed)} / ${fmtBytes(h.memTotal)} · up ${fmtUptime(h.uptimeSec)}` : ""}
          color="#8b5cf6"
        />
        <Gauge
          label="GPU"
          value={h?.gpu ? h.gpu.utilPct : null}
          display={h?.gpu ? `${h.gpu.utilPct}%` : "—"}
          sub={h?.gpu ? `${h.gpu.name} · ${h.gpu.memUsedMb}/${h.gpu.memTotalMb} MB` : ""}
          color="#22e6c8"
        />
      </div>

      <Card>
        <SectionTitle kicker="fleet" title="Connected agents" right={<span className="text-xs opacity-50">{data ? `${data.fleet.length} agents` : "…"}</span>} />
        {!data ? (
          <div className="py-6 text-center text-sm opacity-50">probing host + fleet…</div>
        ) : data.fleet.length === 0 ? (
          <EmptyState icon="⬢" title="No agents yet" hint="Commission your first agent from the Agents page and it will appear here." />
        ) : (
          <div className="space-y-2">
            {data.fleet.map((a, i) => (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.04, 0.3) }}
                className="flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2.5"
              >
                <AgentAvatar seed={a.id} seedNum={0} color="#8b5cf6" name={a.name} size={36} ring={false} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-bold">{a.name}</span>
                    <ProviderBadge id={a.provider} />
                    <Pill tone={STATUS_TONE[a.status]}>
                      {a.status === "Online" ? "● Online" : a.status === "Degraded" ? "▲ Degraded" : "○ Idle"}
                    </Pill>
                  </div>
                  <div className="mt-0.5 truncate text-xs opacity-50">
                    {formatTokens(a.tokens)} · {fmtLatency(a.avgLatencyMs)} avg
                    {a.lastTs ? ` · active ${timeAgo(a.lastTs)}` : " · no runs yet"}
                    {a.note ? ` · ${a.note}` : ""}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
