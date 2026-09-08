"use client";

import { useEffect, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, Pill, SectionTitle } from "@/components/os/ui";
import { formatTokens } from "@/lib/utils";

export default function UsagePage() {
  const [data, setData] = useState<{ totals: any; daily: any[]; recent: any[] } | null>(null);

  useEffect(() => {
    fetch("/api/usage").then((r) => r.json()).then(setData).catch(() => {});
  }, []);

  const totals = data?.totals ?? { calls: 0, tokens: 0, cost: 0, errors: 0 };

  return (
    <div className="space-y-4">
      <div>
        <div className="text-[10px] font-semibold tracking-[0.28em] text-[#ff8c42] uppercase">telemetry</div>
        <h1 className="font-display text-2xl font-black tracking-tight sm:text-3xl">Usage & Analytics</h1>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { k: "TOTAL CALLS", v: String(totals.calls) },
          { k: "TOKENS", v: formatTokens(totals.tokens) },
          { k: "SPEND", v: `$${Number(totals.cost).toFixed(4)}` },
          { k: "ERRORS", v: String(totals.errors) },
        ].map((c) => (
          <div key={c.k} className="glass rounded-2xl p-4">
            <div className="text-[10px] font-semibold tracking-[0.25em] opacity-50">{c.k}</div>
            <div className="font-display mt-1 text-2xl font-black">{c.v}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle kicker="trend" title="Tokens / day" />
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.daily ?? []}>
                <defs>
                  <linearGradient id="tok" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ff6b1a" stopOpacity={0.7} />
                    <stop offset="100%" stopColor="#ff6b1a" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,.08)" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#888" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#888" }} axisLine={false} tickLine={false} width={44} />
                <Tooltip contentStyle={{ background: "#0b0e1d", border: "1px solid rgba(255,255,255,.12)", borderRadius: 12, fontSize: 12 }} />
                <Area type="monotone" dataKey="tokens" stroke="#ff6b1a" strokeWidth={2.5} fill="url(#tok)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <SectionTitle kicker="trend" title="Cost / day ($)" />
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.daily ?? []}>
                <CartesianGrid stroke="rgba(255,255,255,.08)" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: "#888" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#888" }} axisLine={false} tickLine={false} width={44} />
                <Tooltip contentStyle={{ background: "#0b0e1d", border: "1px solid rgba(255,255,255,.12)", borderRadius: 12, fontSize: 12 }} />
                <Bar dataKey="cost" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card>
        <SectionTitle kicker="ledger" title="Recent calls" />
        <div className="space-y-1.5">
          {(data?.recent ?? []).map((u: any) => (
            <div key={u.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-xs">
              <Pill tone={u.ok ? "green" : "red"}>{u.ok ? "ok" : "err"}</Pill>
              <span className="font-mono opacity-70">{new Date(u.ts).toLocaleString()}</span>
              <span className="opacity-60">{u.agentId ? `⬢ ${u.agentId.slice(0, 10)}` : "✦ direct"}</span>
              <span className="ml-auto font-mono">{formatTokens(u.inputTokens + u.outputTokens)} tok · ${Number(u.costUsd).toFixed(4)}</span>
            </div>
          ))}
          {(data?.recent ?? []).length === 0 && <div className="py-6 text-center text-sm opacity-50">no calls logged yet — chat with Claude to light up the ledger</div>}
        </div>
      </Card>
    </div>
  );
}
