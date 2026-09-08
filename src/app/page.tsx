"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, Pill, SectionTitle } from "@/components/os/ui";
import { AgentAvatar } from "@/components/os/AgentAvatar";
import { MemoryGraph, type GraphNode } from "@/components/os/MemoryGraph";
import { NodeSheet } from "@/components/os/NodeSheet";
import { SkillButtons } from "@/components/os/SkillButtons";
import { ParticleField } from "@/components/os/ParticleField";
import { formatTokens, timeAgo } from "@/lib/utils";
import { useOs } from "@/lib/os-store";

interface StatusData {
  provider?: string;
  claudeVersion: string | null;
  claudeConnected: boolean;
  lastError: string | null;
  counts: { agents: number; running: number; sessions: number; usageEvents: number };
  totals: { costUsd: number; tokens: number };
  providers?: { id: string; glyph: string; installed: boolean }[];
}

interface SessionLite {
  id: string;
  title: string;
  agentId: string | null;
  updatedAt: number;
  count: number;
}

interface TaskLite {
  id: string;
  title: string;
  status: string;
}

interface GoalLite {
  id: string;
  title: string;
  status: string;
  due: string;
}

interface JournalLite {
  id: string;
  ts: number;
}

interface UsageDay {
  day: string;
  tokens: number;
  cost: number;
}

interface SystemLite {
  host: { cpuPct: number | null; memPct: number } | null;
}

interface DigestLite {
  today: { date: string } | null;
  cron: { hasJob: boolean } | null;
}

const spring = { type: "spring", stiffness: 120, damping: 18 } as const;

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Up late";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

/** Extract YYYY-MM-DD from a free-form due string, if present. */
function dueDay(due: string): string | null {
  const m = (due || "").match(/\d{4}-\d{2}-\d{2}/);
  return m ? m[0] : null;
}

function Sparkline({ data }: { data: number[] }) {
  if (data.length < 2 || data.every((v) => v === 0)) {
    return <div className="text-xs opacity-50">No usage yet this week.</div>;
  }
  const max = Math.max(...data);
  const pts = data
    .map((v, i) => `${(i / (data.length - 1)) * 100},${28 - (v / max) * 26}`)
    .join(" ");
  return (
    <svg viewBox="0 0 100 30" className="h-12 w-full" preserveAspectRatio="none">
      <polyline points={pts} fill="none" stroke="#ff6b1a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export default function CommandCenter() {
  const [status, setStatus] = useState<StatusData | null>(null);
  const [agents, setAgents] = useState<any[]>([]);
  const [sessions, setSessions] = useState<SessionLite[]>([]);
  const [tasks, setTasks] = useState<TaskLite[]>([]);
  const [goals, setGoals] = useState<GoalLite[]>([]);
  const [journaled, setJournaled] = useState(false);
  const [week, setWeek] = useState<UsageDay[]>([]);
  const [system, setSystem] = useState<SystemLite | null>(null);
  const [digest, setDigest] = useState<DigestLite | null>(null);
  const [brainNode, setBrainNode] = useState<(GraphNode & { name: string }) | null>(null);
  const quotaError = useOs((s) => s.claudeQuotaError);
  const demoMode = useOs((s) => s.demoMode);

  useEffect(() => {
    fetch("/api/status").then((r) => r.json()).then(setStatus).catch(() => {});
    fetch("/api/agents").then((r) => r.json()).then((d) => setAgents(d.agents ?? [])).catch(() => {});
    fetch("/api/chat").then((r) => r.json()).then((d) => setSessions((d.sessions ?? []).slice(0, 4))).catch(() => {});
    fetch("/api/tasks").then((r) => r.json()).then((d) => setTasks(d.tasks ?? [])).catch(() => {});
    fetch("/api/goals").then((r) => r.json()).then((d) => setGoals(d.goals ?? [])).catch(() => {});
    fetch("/api/journal")
      .then((r) => r.json())
      .then((d) => {
        const today = new Date().toDateString();
        setJournaled((d.entries ?? []).some((e: JournalLite) => new Date(e.ts).toDateString() === today));
      })
      .catch(() => {});
    fetch("/api/usage").then((r) => r.json()).then((d) => setWeek((d.daily ?? []).slice(-7))).catch(() => {});
    fetch("/api/system").then((r) => r.json()).then(setSystem).catch(() => {});
    fetch("/api/digest/status").then((r) => r.json()).then(setDigest).catch(() => {});
  }, []);

  const todayStr = new Date().toISOString().slice(0, 10);
  const dueGoals = goals.filter((g) => g.status === "active" && dueDay(g.due) && (dueDay(g.due) as string) <= todayStr);
  const approvals = tasks.filter((t) => t.status === "awaiting_approval");
  const failed = tasks.filter((t) => t.status === "failed");
  const attention: { icon: string; text: string; href: string }[] = [
    ...approvals.map((t) => ({ icon: "⏸", text: `"${t.title}" needs approval`, href: "/tasks" })),
    ...failed.map((t) => ({ icon: "❌", text: `"${t.title}" failed`, href: "/tasks" })),
    ...dueGoals.map((g) => ({ icon: "◎", text: `"${g.title}" due ${dueDay(g.due) === todayStr ? "today" : "overdue"}`, href: "/goals" })),
  ];

  const running = agents.filter((a) => a.status === "running").length;

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
            ◈ {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...spring, delay: 0.06 }}
            className="font-display mt-2 max-w-2xl text-3xl font-black tracking-tight sm:text-5xl"
          >
            {greeting()}. <span className="shimmer-text">{running > 0 ? `${running} agent${running > 1 ? "s" : ""} live` : "Fleet standing by"}</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="mt-2 max-w-xl text-sm opacity-70 sm:text-base"
          >
            {agents.length} agents · {sessions.length ? `last chat ${timeAgo(sessions[0].updatedAt)}` : "no chats yet"} · {demoMode ? "demo core" : "cli bridge armed"}
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-5 flex flex-wrap gap-2.5"
          >
            <Link href="/chat" className="glow-orange rounded-full bg-gradient-to-r from-[#ff6b1a] to-[#ff9a3d] px-5 py-2.5 text-sm font-bold text-white transition hover:scale-105">
              ✦ Start chatting
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
          <span className="font-bold text-amber-300">⚠ Provider quota exhausted (402).</span>{" "}
          <span className="opacity-80">
            {quotaError.slice(0, 160)} — top up the budget pool, or enable <b>demo mode</b> in Settings to
            explore offline.
          </span>
        </motion.div>
      )}

      {/* needs attention */}
      {attention.length > 0 && (
        <Card className="border-amber-400/30">
          <SectionTitle kicker="attention" title={`Needs you (${attention.length})`} />
          <div className="space-y-1.5">
            {attention.slice(0, 5).map((a, i) => (
              <Link key={i} href={a.href} className="flex items-center gap-2.5 rounded-xl bg-amber-400/8 px-3 py-2 text-sm transition hover:bg-amber-400/15">
                <span>{a.icon}</span>
                <span className="min-w-0 flex-1 truncate">{a.text}</span>
                <span className="text-xs text-[#ff8c42]">open ▸</span>
              </Link>
            ))}
          </div>
        </Card>
      )}

      {/* brain centerpiece */}
      <MemoryGraph heightClass="h-[42vh]" selectedId={brainNode?.id} onSelect={setBrainNode} linkToGraph />

      {/* stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {(
          [
            { k: (status?.provider ?? "AI").toUpperCase(), v: status?.claudeVersion ? `v${status.claudeVersion.match(/[\d.]+/)?.[0] ?? "?"}` : "…", s: status?.claudeConnected ? "linked" : "offline", tone: (status?.claudeConnected ? "green" : "red") as "green" | "red" },
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
        {/* continue */}
        <Card>
          <SectionTitle kicker="resume" title="Continue" right={<Link href="/chat" className="text-xs text-[#ff8c42] hover:underline">all chats ▸</Link>} />
          {sessions.length === 0 ? (
            <div className="text-sm opacity-60">No chats yet — <Link href="/chat" className="text-[#ff8c42] hover:underline">start your first</Link>.</div>
          ) : (
            <div className="space-y-1.5">
              {sessions.map((s) => (
                <Link key={s.id} href={`/chat?s=${s.id}`} className="flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2.5 transition hover:bg-white/10">
                  <span className="text-lg">✦</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold">{s.title || "Untitled chat"}</div>
                    <div className="text-xs opacity-50">{timeAgo(s.updatedAt)} · {s.count} msgs</div>
                  </div>
                  <span className="text-xs text-[#ff8c42]">resume ▸</span>
                </Link>
              ))}
            </div>
          )}
        </Card>

        {/* today */}
        <Card>
          <SectionTitle kicker="today" title="Today" right={<Link href="/goals" className="text-xs text-[#ff8c42] hover:underline">goals ▸</Link>} />
          <div className="space-y-1.5 text-sm">
            {dueGoals.length === 0 ? (
              <div className="rounded-xl bg-white/5 px-3 py-2.5 opacity-60">◎ Nothing due today.</div>
            ) : (
              dueGoals.slice(0, 3).map((g) => (
                <Link key={g.id} href="/goals" className="block truncate rounded-xl bg-white/5 px-3 py-2.5 transition hover:bg-white/10">
                  ◎ {g.title}
                </Link>
              ))
            )}
            <div className="rounded-xl bg-white/5 px-3 py-2.5">
              {journaled ? "❝ Journaled today ✓" : <><span className="opacity-60">❝ Not journaled yet — </span><Link href="/journal" className="text-[#ff8c42] hover:underline">write one</Link></>}
            </div>
            <Link href="/digest" className="block rounded-xl bg-white/5 px-3 py-2.5 transition hover:bg-white/10">
              {digest?.today ? "🌙 Tonight's digest is ready ✓" : digest?.cron?.hasJob ? "🌙 Digest scheduled for 8pm" : <><span className="opacity-60">🌙 No digest scheduled — </span><span className="text-[#ff8c42]">set it up</span></>}
            </Link>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* spend trend */}
        <Card>
          <SectionTitle kicker="spend" title="7-day tokens" right={<Link href="/usage" className="text-xs text-[#ff8c42] hover:underline">full ledger ▸</Link>} />
          <Sparkline data={week.map((d) => d.tokens)} />
          <div className="mt-1 flex justify-between text-[11px] opacity-50">
            <span>{week[0]?.day ?? ""}</span>
            <span>{week.length ? `${formatTokens(week.reduce((s, d) => s + d.tokens, 0))} · $${week.reduce((s, d) => s + d.cost, 0).toFixed(4)}` : ""}</span>
            <span>{week[week.length - 1]?.day ?? ""}</span>
          </div>
        </Card>

        {/* system */}
        <Card>
          <SectionTitle kicker="host" title="System" right={<Link href="/system" className="text-xs text-[#ff8c42] hover:underline">telemetry ▸</Link>} />
          <div className="flex items-center gap-4 text-sm">
            <div><span className="opacity-50">CPU </span><b>{system?.host?.cpuPct ?? "…"}%</b></div>
            <div><span className="opacity-50">MEM </span><b>{system?.host?.memPct ?? "…"}%</b></div>
            <div className="ml-auto flex items-center gap-1.5">
              {(status?.providers ?? []).map((p) => (
                <span key={p.id} title={`${p.id} ${p.installed ? "installed" : "missing"}`} className="flex items-center gap-1 rounded-full bg-white/5 px-2 py-1 text-xs">
                  <span className={`h-1.5 w-1.5 rounded-full ${p.installed ? "bg-emerald-400" : "bg-white/25"}`} />
                  {p.glyph}
                </span>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* one-tap skills */}
      <SkillButtons />

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
            <span className="text-[#22e6c8]">agentic@local:~$</span> fleet --status
            <br />▸ {agents.filter((a) => a.status === "running").length} live · {agents.length} total · {demoMode ? "demo core" : "cli bridge armed"}
          </div>
        </Card>
      </div>

      <NodeSheet node={brainNode} onClose={() => setBrainNode(null)} />
    </div>
  );
}
