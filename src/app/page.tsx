"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, Pill, SectionTitle } from "@/components/os/ui";
import { AgentAvatar } from "@/components/os/AgentAvatar";
import { ParticleField } from "@/components/os/ParticleField";
import { formatTokens, timeAgo } from "@/lib/utils";
import { useOs } from "@/lib/os-store";

interface StatusData {
  claudeVersion: string | null;
  claudeConnected: boolean;
  lastError: string | null;
  counts: { agents: number; running: number; sessions: number; usageEvents: number };
  totals: { costUsd: number; tokens: number };
}

const spring = { type: "spring", stiffness: 120, damping: 18 } as const;

export default function CommandCenter() {
  const [status, setStatus] = useState<StatusData | null>(null);
  const [agents, setAgents] = useState<any[]>([]);
  const quotaError = useOs((s) => s.claudeQuotaError);
  const demoMode = useOs((s) => s.demoMode);

  useEffect(() => {
    fetch("/api/status").then((r) => r.json()).then(setStatus).catch(() => {});
    fetch("/api/agents").then((r) => r.json()).then((d) => setAgents(d.agents ?? [])).catch(() => {});
  }, []);

  return (
    <div className="space-y-4">
      {/* hero */}
      <div className="glass relative overflow-hidden rounded-3xl p-6 sm:p-8">
        <ParticleField density={40} />
        <div className="relative">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-[11px] font-semibold tracking-[0.3em] text-[#ff8c42] uppercase"
          >
            ◈ local mission control · {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: 0.06 }}
            className="font-display mt-2 max-w-2xl text-3xl font-black tracking-tight sm:text-5xl"
          >
            Command your <span className="shimmer-text">Claude fleet</span> from one gorgeous deck.
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="mt-2 max-w-xl text-sm opacity-70 sm:text-base"
          >
            Chat with Claude Code CLI, launch agents as real local processes, track tokens, reuse
            prompts, browse workspaces, and grow shared memory — all on your machine.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-5 flex flex-wrap gap-2.5"
          >
            <Link href="/chat" className="glow-orange rounded-full bg-gradient-to-r from-[#ff6b1a] to-[#ff9a3d] px-5 py-2.5 text-sm font-bold text-white transition hover:scale-105">
              ✦ Chat with Claude
            </Link>
            <Link href="/agents" className="glass rounded-full px-5 py-2.5 text-sm font-semibold transition hover:scale-105">
              ⬢ Launch agent
            </Link>
            <Link href="/graph" className="glass rounded-full px-5 py-2.5 text-sm font-semibold transition hover:scale-105">
              ⋈ Memory graph
            </Link>
          </motion.div>
        </div>
      </div>

      {quotaError && !demoMode && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-2xl border border-amber-400/40 bg-amber-400/10 p-4 text-sm">
          <span className="font-bold text-amber-300">⚠ Claude quota exhausted (402).</span>{" "}
          <span className="opacity-80">
            {quotaError.slice(0, 160)} — top up the budget pool, or enable <b>demo mode</b> in Settings to
            explore offline.
          </span>
        </motion.div>
      )}

      {/* stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {(
          [
            { k: "CLAUDE", v: status?.claudeVersion ? `v${status.claudeVersion.match(/[\d.]+/)?.[0] ?? "?"}` : "…", s: status?.claudeConnected ? "linked" : "offline", tone: (status?.claudeConnected ? "green" : "red") as "green" | "red" },
            { k: "AGENTS", v: String(status?.counts.agents ?? agents.length), s: `${status?.counts.running ?? 0} running`, tone: "violet" as const },
            { k: "TOKENS", v: formatTokens(status?.totals.tokens ?? 0), s: `$${(status?.totals.costUsd ?? 0).toFixed(4)} spent`, tone: "neutral" as const },
            { k: "SESSIONS", v: String(status?.counts.sessions ?? 0), s: `${status?.counts.usageEvents ?? 0} calls logged`, tone: "neutral" as const },
          ]
        ).map((c, i) => (
          <motion.div
            key={c.k}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: 0.05 * i }}
            className="glass rounded-2xl p-4"
          >
            <div className="text-[10px] font-semibold tracking-[0.25em] opacity-50">{c.k}</div>
            <div className="font-display mt-1 text-2xl font-black sm:text-3xl">{c.v}</div>
            <div className="mt-1.5"><Pill tone={c.tone}>{c.s}</Pill></div>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* fleet */}
        <Card>
          <SectionTitle kicker="fleet" title="Agent status" right={<Link href="/agents" className="text-xs text-[#ff8c42] hover:underline">manage ▸</Link>} />
          {agents.length === 0 ? (
            <div className="text-sm opacity-60">No agents yet — <Link href="/agents" className="text-[#ff8c42] hover:underline">create your first</Link>.</div>
          ) : (
            <div className="space-y-2">
              {agents.slice(0, 5).map((a) => (
                <Link key={a.id} href={`/agents/${a.id}`} className="avatar-hover flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2.5 transition hover:bg-white/10">
                  <AgentAvatar seed={a.id} seedNum={a.avatarSeed ?? 0} color={a.color} name={a.name} size={36} status={a.status} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold">{a.name}</div>
                    <div className="truncate text-xs opacity-50">{a.lastTask || a.persona}</div>
                  </div>
                  <Pill tone={a.status === "running" ? "green" : a.status === "error" ? "red" : "neutral"}>
                    {a.status === "running" ? "● live" : a.status}
                  </Pill>
                </Link>
              ))}
            </div>
          )}
        </Card>

        {/* quick ops */}
        <Card>
          <SectionTitle kicker="ops" title="Quick actions" />
          <div className="grid grid-cols-2 gap-2.5">
            {[
              { t: "Mission brief", d: "Summarize state in bullets", h: "/chat", icon: "✦" },
              { t: "Deep bug hunt", d: "Spawn Scout on a bug", h: "/agents", icon: "⬢" },
              { t: "Set a goal", d: "Target → brain", h: "/goals", icon: "◎" },
              { t: "Journal", d: "Log today → brain", h: "/journal", icon: "❝" },
              { t: "Capture idea", d: "Add memory node", h: "/graph", icon: "⋈" },
              { t: "Review spend", d: "Tokens & cost", h: "/usage", icon: "◊" },
            ].map((q) => (
              <Link key={q.t} href={q.h} className="group rounded-xl border border-white/10 bg-white/5 p-3 transition hover:scale-[1.02] hover:border-[#ff6b1a]/50">
                <div className="text-xl">{q.icon}</div>
                <div className="mt-1 text-sm font-bold">{q.t}</div>
                <div className="text-xs opacity-50">{q.d}</div>
              </Link>
            ))}
          </div>
          <div className="term mt-3 rounded-xl bg-black/40 p-3 text-[11px] opacity-70">
            <span className="text-[#22e6c8]">claudeos@local:~$</span> fleet --status
            <br />▸ {agents.filter((a) => a.status === "running").length} live · {agents.length} total · {demoMode ? "demo core" : "cli bridge armed"}
          </div>
        </Card>
      </div>
    </div>
  );
}
