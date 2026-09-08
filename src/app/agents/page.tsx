"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AgentAvatar } from "@/components/os/AgentAvatar";
import { ProviderBadge } from "@/components/os/ProviderBadge";
import { VoiceField } from "@/components/chat/VoiceField";
import { Card, EmptyState, SectionTitle } from "@/components/os/ui";
import { timeAgo } from "@/lib/utils";

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
  updatedAt: number;
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ name: "", persona: "", systemPrompt: "", model: "", provider: "claude" });

  const refresh = useCallback(async () => {
    const d = await fetch("/api/agents").then((r) => r.json()).catch(() => null);
    if (d?.agents) setAgents(d.agents);
  }, []);

  useEffect(() => {
    // seed defaults on first visit if empty
    fetch("/api/agents", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })
      .then((r) => r.json())
      .then((d) => {
        if (d.agents) setAgents(d.agents);
        else refresh();
      })
      .catch(() => refresh());
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, [refresh]);

  const stop = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    await fetch(`/api/agents/run?agentId=${id}`, { method: "DELETE" });
    refresh();
  };

  const create = async () => {
    const r = await fetch("/api/agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form.name ? form : { name: "", persona: "", systemPrompt: "", model: "" }),
    }).then((x) => x.json());
    if (r.agent) setAgents((a) => [r.agent, ...a]);
    else if (r.agents) setAgents(r.agents);
    setForm({ name: "", persona: "", systemPrompt: "", model: "", provider: "claude" });
    setShowNew(false);
    refresh();
  };

  const live = agents.filter((a) => a.status === "running").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div>
          <div className="text-[10px] font-semibold tracking-[0.28em] text-[#ff8c42] uppercase">fleet</div>
          <h1 className="font-display text-2xl font-black tracking-tight sm:text-3xl">
            Agent Fleet{" "}
            <span className="text-base font-normal opacity-50">
              · {live} live
            </span>
          </h1>
        </div>
        <div className="flex-1" />
        <button onClick={() => setShowNew((s) => !s)} className="glow-orange rounded-full bg-gradient-to-r from-[#ff6b1a] to-[#ff9a3d] px-4 py-2 text-sm font-bold text-white transition hover:scale-105">
          + New agent
        </button>
      </div>

      {/* avatar strip */}
      {agents.length > 0 && (
        <div className="glass flex items-center gap-3 overflow-x-auto rounded-2xl p-3">
          {agents.map((a) => (
            <Link key={a.id} href={`/agents/${a.id}`} title={`${a.name} — open section`} className="avatar-hover flex shrink-0 flex-col items-center gap-1">
              <AgentAvatar seed={a.id} seedNum={a.avatarSeed ?? 0} color={a.color} name={a.name} size={46} status={a.status} />
              <span className="max-w-[64px] truncate text-[11px] font-semibold opacity-80">{a.name}</span>
            </Link>
          ))}
          <div className="ml-auto hidden shrink-0 text-xs opacity-50 sm:block">click an agent → its section</div>
        </div>
      )}

      <AnimatePresence>
        {showNew && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <Card>
              <SectionTitle kicker="forge" title="Commission agent" />
              <div className="grid gap-2.5 sm:grid-cols-2">
                <VoiceField value={form.name} onText={(v) => setForm({ ...form, name: v })} micSize={26}>
                  <input placeholder="Name (e.g. Scout)" className="glass w-full rounded-xl px-3 py-2 text-sm outline-none" />
                </VoiceField>
                <VoiceField value={form.persona} onText={(v) => setForm({ ...form, persona: v })} micSize={26}>
                  <input placeholder="Persona (e.g. Recon specialist)" className="glass w-full rounded-xl px-3 py-2 text-sm outline-none" />
                </VoiceField>
                <VoiceField value={form.model} onText={(v) => setForm({ ...form, model: v })} micSize={26}>
                  <input placeholder="Model override (blank = default)" className="glass w-full rounded-xl px-3 py-2 text-sm outline-none" />
                </VoiceField>
                <label className="glass flex items-center gap-2 rounded-xl px-3 py-2 text-sm">
                  <span className="text-xs opacity-50">CLI</span>
                  <select value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} className="flex-1 bg-transparent font-bold outline-none">
                    <option value="claude">✦ Claude Code</option>
                    <option value="opencode">⬡ opencode</option>
                    <option value="hermes">☿ Hermes</option>
                    <option value="antigravity">⬔ Antigravity</option>
                  </select>
                </label>
                <div className="text-xs opacity-50 self-center">gets a unique generative avatar automatically</div>
              </div>
              <VoiceField value={form.systemPrompt} onText={(v) => setForm({ ...form, systemPrompt: v })} multiline micSize={28} className="mt-2.5">
                <textarea placeholder="System prompt — who is this agent, how does it behave?" rows={3} className="glass w-full rounded-xl px-3 py-2 text-sm outline-none" />
              </VoiceField>
              <div className="mt-3 flex gap-2">
                <button onClick={create} className="rounded-full bg-gradient-to-r from-[#ff6b1a] to-[#ff9a3d] px-5 py-2 text-sm font-bold text-white">Commission ⬢</button>
                <button onClick={() => setShowNew(false)} className="glass rounded-full px-4 py-2 text-sm">cancel</button>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {agents.length === 0 ? (
        <EmptyState icon="⬢" title="Fleet is empty" hint="Commission your first agent — each one gets its own persona, model, avatar, and isolated workspace." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((a, i) => (
            <motion.div
              key={a.id}
              layout
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.05, 0.3), type: "spring", stiffness: 140, damping: 18 }}
              whileHover={{ y: -4 }}
            >
              <Link
                href={`/agents/${a.id}`}
                className="glass group block overflow-hidden rounded-3xl p-4 transition"
                style={{ ["--ac" as string]: a.color }}
              >
                <div className="flex items-start gap-3">
                  <motion.span whileHover={{ scale: 1.1, rotate: -4 }} className="avatar-hover">
                    <AgentAvatar seed={a.id} seedNum={a.avatarSeed ?? 0} color={a.color} name={a.name} size={56} status={a.status} />
                  </motion.span>
                  <div className="min-w-0 flex-1">
                    <div className="font-display truncate text-lg font-black tracking-tight group-hover:text-[#ffb27a]">
                      {a.name}
                    </div>
                    <div className="truncate text-xs opacity-55">{a.persona}</div>
                    <div className="mt-1"><ProviderBadge id={a.provider} /></div>
                    <div className="mt-0.5 truncate text-[11px] opacity-40">
                      {a.model || "default model"} · {a.status === "running" ? `● live${a.pid ? ` · ${a.pid}` : ""}` : `idle · ${timeAgo(a.updatedAt)}`}
                    </div>
                  </div>
                </div>
                {a.lastTask && <div className="mt-2 truncate text-xs opacity-50">▸ {a.lastTask}</div>}
                <div className="mt-3 flex gap-2">
                  <span className="flex-1 rounded-full bg-gradient-to-r from-[#ff6b1a] to-[#ff9a3d] py-1.5 text-center text-xs font-bold text-white opacity-90 transition group-hover:opacity-100">
                    open section →
                  </span>
                  {a.status === "running" && (
                    <button onClick={(e) => stop(e, a.id)} className="rounded-full bg-red-500/85 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-red-500">
                      ■
                    </button>
                  )}
                  <Link href={`/chat?agent=${a.id}`} onClick={(e) => e.stopPropagation()} className="glass rounded-full px-3.5 py-1.5 text-xs font-bold" title={`Chat with ${a.name}`}>
                    ✦
                  </Link>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
