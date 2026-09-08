"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AgentAvatar } from "@/components/os/AgentAvatar";
import { ProviderBadge } from "@/components/os/ProviderBadge";
import { VoiceField } from "@/components/chat/VoiceField";
import { Card, EmptyState, Pill, SectionTitle } from "@/components/os/ui";
import { formatTokens, timeAgo } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface Agent {
  id: string;
  name: string;
  persona: string;
  systemPrompt: string;
  model: string;
  color: string;
  avatarSeed: number;
  provider: string;
  status: "idle" | "running" | "error";
  pid: number | null;
  lastTask: string;
  createdAt: number;
  updatedAt: number;
}

type Tab = "overview" | "console" | "files" | "settings";

export default function AgentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params.id ?? "");
  const [agent, setAgent] = useState<Agent | null>(null);
  const [missing, setMissing] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");
  const [log, setLog] = useState("");
  const [task, setTask] = useState("");
  const [stats, setStats] = useState<{ calls: number; tokens: number; cost: number; chats: number } | null>(null);
  const [files, setFiles] = useState<{ name: string; dir: boolean; size: number; path: string }[]>([]);
  const [draft, setDraft] = useState<Agent | null>(null);
  const [follow, setFollow] = useState(true);
  const logRef = useRef<HTMLPreElement>(null);

  const refresh = useCallback(async () => {
    const d = await fetch("/api/agents").then((r) => r.json()).catch(() => null);
    const a = d?.agents?.find((x: Agent) => x.id === id);
    if (!a) {
      setMissing(true);
      return;
    }
    setAgent(a);
    if (!draft) setDraft(a);
  }, [id, draft]);

  useEffect(() => {
    refresh();
    fetch("/api/usage").then((r) => r.json()).then((u) => {
      const mine = (u.recent ?? []).filter((e: any) => e.agentId === id);
      setStats({
        calls: mine.length,
        tokens: mine.reduce((s: number, e: any) => s + e.inputTokens + e.outputTokens, 0),
        cost: mine.reduce((s: number, e: any) => s + e.costUsd, 0),
        chats: 0,
      });
    }).catch(() => {});
    fetch(`/api/chat?agent=${id}`).then((r) => r.json()).then((d) => {
      setStats((s) => (s ? { ...s, chats: (d.sessions ?? []).length } : s));
    }).catch(() => {});
    fetch(`/api/files?path=${encodeURIComponent(id)}`).then((r) => r.json()).then((d) => {
      if (d?.items) setFiles(d.items);
    }).catch(() => {});
  }, [id, refresh]);

  // live console polling while running (or viewing console tab)
  useEffect(() => {
    if (!agent || (agent.status !== "running" && tab !== "console")) return;
    let alive = true;
    const pull = async () => {
      const d = await fetch(`/api/agents/run?agentId=${id}`).then((r) => r.json()).catch(() => null);
      if (alive && d?.log !== undefined) setLog(d.log);
      if (alive) refresh();
    };
    pull();
    const t = setInterval(pull, 2500);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [id, agent?.status, tab, refresh]);

  useEffect(() => {
    if (follow) logRef.current?.scrollTo({ top: 999999 });
  }, [log, follow]);

  if (missing) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <div className="text-5xl opacity-40">⬢</div>
        <h1 className="font-display mt-3 text-2xl font-black">Agent retired or unknown</h1>
        <p className="mt-1 text-sm opacity-60">This agent no longer exists in the fleet.</p>
        <Link href="/agents" className="mt-4 inline-block rounded-full bg-gradient-to-r from-[#ff6b1a] to-[#ff9a3d] px-5 py-2 text-sm font-bold text-white">← back to fleet</Link>
      </div>
    );
  }
  if (!agent) return <div className="py-16 text-center opacity-60">summoning agent…</div>;

  const start = async () => {
    const r = await fetch("/api/agents/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId: id, task: task.trim() || "Report status and stand by for orders." }),
    }).then((x) => x.json());
    if (r.error) alert(r.error);
    setTab("console");
    refresh();
  };
  const stop = async () => {
    await fetch(`/api/agents/run?agentId=${id}`, { method: "DELETE" });
    refresh();
  };
  const save = async () => {
    if (!draft) return;
    await fetch("/api/agents", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name: draft.name, persona: draft.persona, systemPrompt: draft.systemPrompt, model: draft.model, color: draft.color, avatarSeed: draft.avatarSeed, provider: draft.provider }),
    });
    refresh();
  };
  const retire = async () => {
    if (!confirm(`Retire ${agent.name}?`)) return;
    await stop().catch(() => {});
    await fetch(`/api/agents?id=${id}`, { method: "DELETE" });
    router.push("/agents");
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "console", label: "Console" },
    { id: "files", label: "Files" },
    { id: "settings", label: "Settings" },
  ];

  return (
    <div className="space-y-4">
      {/* hero */}
      <div className="glass relative overflow-hidden rounded-3xl p-5 sm:p-6">
        <div className="pointer-events-none absolute -top-20 -right-20 h-64 w-64 rounded-full blur-[100px]" style={{ background: `${agent.color}33` }} />
        <div className="relative flex flex-wrap items-center gap-4">
          <motion.div whileHover={{ scale: 1.06, rotate: -3 }}>
            <AgentAvatar seed={agent.id} seedNum={agent.avatarSeed} color={agent.color} name={agent.name} size={76} status={agent.status} />
          </motion.div>
          <div className="min-w-0 flex-1">
            <Link href="/agents" className="text-[11px] opacity-50 hover:opacity-90 hover:underline">← fleet</Link>
            <h1 className="font-display truncate text-2xl font-black tracking-tight sm:text-3xl">{agent.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
              <Pill tone={agent.status === "running" ? "green" : agent.status === "error" ? "red" : "neutral"}>
                {agent.status === "running" ? `● live${agent.pid ? ` · pid ${agent.pid}` : ""}` : agent.status}
              </Pill>
              <span className="opacity-50">{agent.persona} · {agent.model || "default model"}</span>
              <ProviderBadge id={agent.provider} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/chat?agent=${agent.id}`} className="glow-orange rounded-full bg-gradient-to-r from-[#ff6b1a] to-[#ff9a3d] px-5 py-2 text-sm font-bold text-white transition hover:scale-105">
              ✦ Chat
            </Link>
            {agent.status === "running" ? (
              <button onClick={stop} className="rounded-full bg-red-500/85 px-5 py-2 text-sm font-bold text-white hover:bg-red-500">■ Stop</button>
            ) : (
              <button onClick={start} className="glass rounded-full px-5 py-2 text-sm font-bold transition hover:scale-105">▶ Run</button>
            )}
          </div>
        </div>

        {/* deploy bar */}
        {agent.status !== "running" && (
          <div className="relative mt-4 flex gap-2">
            <VoiceField value={task} onText={setTask} micSize={28} className="flex-1">
              <input
                onKeyDown={(e) => e.key === "Enter" && start()}
                placeholder={`Order ${agent.name}…  (Enter to deploy)`}
                className="glass w-full flex-1 rounded-full px-4 py-2 text-sm outline-none placeholder:text-white/30"
              />
            </VoiceField>
            <button onClick={start} className="rounded-full bg-gradient-to-r from-[#ff6b1a] to-[#ff9a3d] px-5 py-2 text-sm font-bold text-white">deploy ➤</button>
          </div>
        )}

        {/* tabs */}
        <div className="relative mt-4 flex gap-1 rounded-full bg-black/25 p-1 sm:w-fit">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)} className={cn("relative rounded-full px-4 py-1.5 text-xs font-bold transition", tab === t.id ? "text-white" : "opacity-55 hover:opacity-100")}>
              {tab === t.id && <motion.span layoutId={`agent-tab-${id}`} className="absolute inset-0 rounded-full bg-gradient-to-r from-[#ff6b1a] to-[#8b5cf6]" transition={{ type: "spring", stiffness: 400, damping: 32 }} />}
              <span className="relative">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.16 }}>
          {tab === "overview" && (
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <SectionTitle kicker="dossier" title="Persona" />
                <p className="text-sm opacity-75">{agent.persona}</p>
                <div className="mt-3 rounded-2xl bg-black/25 p-3 text-sm whitespace-pre-wrap opacity-80">{agent.systemPrompt}</div>
                {agent.lastTask && <div className="mt-3 text-xs opacity-50">last task: <span className="opacity-80">{agent.lastTask}</span></div>}
              </Card>
              <Card>
                <SectionTitle kicker="telemetry" title="Lifetime stats" />
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    { k: "RUNS LOGGED", v: String(stats?.calls ?? 0) },
                    { k: "TOKENS", v: formatTokens(stats?.tokens ?? 0) },
                    { k: "SPEND", v: `$${(stats?.cost ?? 0).toFixed(4)}` },
                    { k: "CHATS", v: String(stats?.chats ?? 0) },
                  ].map((c) => (
                    <div key={c.k} className="rounded-2xl bg-white/5 p-3">
                      <div className="text-[10px] font-semibold tracking-[0.2em] opacity-50">{c.k}</div>
                      <div className="font-display text-xl font-black">{c.v}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 text-xs opacity-50">commissioned {timeAgo(agent.createdAt)} · active {timeAgo(agent.updatedAt)}</div>
              </Card>
            </div>
          )}

          {tab === "console" && (
            <Card>
              <SectionTitle
                kicker="live"
                title="Process console"
                right={
                  <label className="flex cursor-pointer items-center gap-2 text-xs opacity-70">
                    <input type="checkbox" checked={follow} onChange={(e) => setFollow(e.target.checked)} /> follow
                  </label>
                }
              />
              <pre ref={logRef} className="term max-h-[55vh] overflow-y-auto rounded-2xl bg-black/50 p-4 whitespace-pre-wrap text-white/85">
                {(log || "— console ready. deploy a task to see live output —").slice(-12000)}
                {agent.status === "running" && <span className="stream-caret" />}
              </pre>
            </Card>
          )}

          {tab === "files" && (
            <Card>
              <SectionTitle kicker="workspace" title={`workspaces/${agent.id}/`} right={<Link href="/files" className="text-xs text-[#ff8c42] hover:underline">open browser ▸</Link>} />
              {files.length === 0 ? (
                <div className="py-6 text-center text-sm opacity-50">workspace empty — run a task to generate artifacts</div>
              ) : (
                <div className="space-y-1">
                  {files.map((f) => (
                    <div key={f.path} className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-sm">
                      <span>{f.dir ? "📁" : "📄"}</span>
                      <span className="flex-1 truncate font-mono text-[13px]">{f.name}</span>
                      {!f.dir && <span className="text-[11px] opacity-40">{(f.size / 1024).toFixed(1)}k</span>}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {tab === "settings" && draft && (
            <Card>
              <SectionTitle kicker="config" title="Agent settings" />
              <div className="flex items-center gap-4">
                <AgentAvatar seed={draft.id} seedNum={draft.avatarSeed} color={draft.color} name={draft.name || "?"} size={64} />
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => setDraft({ ...draft, avatarSeed: (draft.avatarSeed + 1) % 1000 })} className="glass rounded-full px-4 py-1.5 text-xs font-bold">🎲 shuffle look</button>
                  <div className="flex items-center gap-1.5">
                    {["#ff6b1a", "#8b5cf6", "#22e6c8", "#ffd166", "#ff4d6d", "#4da6ff"].map((c) => (
                      <button key={c} onClick={() => setDraft({ ...draft, color: c })} className="h-6 w-6 rounded-full transition hover:scale-125" style={{ background: c, boxShadow: draft.color === c ? `0 0 0 2px #fff, 0 0 10px ${c}` : undefined }} title={c} />
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                <VoiceField value={draft.name} onText={(v) => setDraft({ ...draft, name: v })} micSize={26}>
                  <input placeholder="Name" className="glass w-full rounded-xl px-3 py-2 text-sm outline-none" />
                </VoiceField>
                <VoiceField value={draft.persona} onText={(v) => setDraft({ ...draft, persona: v })} micSize={26}>
                  <input placeholder="Persona" className="glass w-full rounded-xl px-3 py-2 text-sm outline-none" />
                </VoiceField>
                <VoiceField value={draft.model} onText={(v) => setDraft({ ...draft, model: v })} micSize={26}>
                  <input placeholder="Model override (blank = default)" className="glass w-full rounded-xl px-3 py-2 text-sm outline-none" />
                </VoiceField>
                <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm">
                  <span className="text-xs opacity-50">CLI</span>
                  <select
                    value={draft.provider || "claude"}
                    onChange={(e) => setDraft({ ...draft, provider: e.target.value })}
                    className="flex-1 bg-transparent text-sm font-bold outline-none"
                  >
                    <option value="claude">✦ Claude Code</option>
                    <option value="opencode">⬡ opencode</option>
                    <option value="hermes">☿ Hermes</option>
                    <option value="antigravity">⬔ Antigravity</option>
                  </select>
                  <ProviderBadge id={draft.provider} />
                </label>
              </div>
              <VoiceField value={draft.systemPrompt} onText={(v) => setDraft({ ...draft, systemPrompt: v })} multiline micSize={28} className="mt-2.5">
                <textarea rows={4} placeholder="System prompt" className="glass w-full rounded-xl px-3 py-2 text-sm outline-none" />
              </VoiceField>
              <div className="mt-3 flex gap-2">
                <button onClick={save} className="rounded-full bg-emerald-500/85 px-5 py-2 text-sm font-bold text-white hover:bg-emerald-500">save ✓</button>
                <button onClick={retire} className="rounded-full border border-red-400/40 bg-red-400/10 px-5 py-2 text-sm font-bold text-red-300 hover:bg-red-400/20">retire agent</button>
              </div>
            </Card>
          )}
        </motion.div>
      </AnimatePresence>

      {agent.lastTask === "" && tab === "overview" && agent.status === "idle" && (
        <EmptyState icon="⬢" title={`${agent.name} is standing by`} hint="Deploy a task above or start a chat — output streams into the Console tab." />
      )}
    </div>
  );
}
