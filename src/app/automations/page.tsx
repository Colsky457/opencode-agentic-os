"use client";

import { motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import { Card, EmptyState, Pill, SectionTitle } from "@/components/os/ui";
import { cn } from "@/lib/utils";

interface Automation {
  id: string;
  name: string;
  enabled: boolean;
  trigger: { kind: "cron"; expr: string } | { kind: "git"; repo?: string; branch?: string };
  action: { kind: string; [k: string]: any };
  lastRun: number | null;
  lastStatus: "ok" | "error" | null;
  lastError: string | null;
  runCount: number;
  history: { ts: number; ok: boolean; summary: string }[];
  triggerLabel: string;
  actionLabel: string;
}

export default function AutomationsPage() {
  const [items, setItems] = useState<Automation[]>([]);
  const [agents, setAgents] = useState<{ id: string; name: string }[]>([]);
  const [prompts, setPrompts] = useState<{ id: string; title: string }[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    triggerKind: "cron" as "cron" | "git",
    expr: "daily 20:00",
    repo: "",
    branch: "",
    actionKind: "prompt" as "prompt" | "digest" | "script",
    promptId: "",
    body: "",
    agentId: "",
    script: "",
  });

  const refresh = useCallback(async () => {
    const d = await fetch("/api/automations").then((r) => r.json()).catch(() => null);
    if (d?.automations) setItems(d.automations);
  }, []);

  useEffect(() => {
    refresh();
    fetch("/api/agents").then((r) => r.json()).then((d) => setAgents((d.agents ?? []).map((a: any) => ({ id: a.id, name: a.name })))).catch(() => {});
    fetch("/api/prompts").then((r) => r.json()).then((d) => setPrompts((d.prompts ?? []).map((p: any) => ({ id: p.id, title: p.title })))).catch(() => {});
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, [refresh]);

  const create = async () => {
    const payload: any = { name: form.name };
    if (form.triggerKind === "git") {
      payload.trigger = { kind: "git", repo: form.repo || undefined, branch: form.branch || undefined };
    } else {
      payload.trigger = { kind: "cron", expr: form.expr };
    }
    if (form.actionKind === "digest") payload.action = { kind: "digest" };
    else if (form.actionKind === "script") payload.action = { kind: "script", script: form.script };
    else {
      payload.action = {
        kind: "prompt",
        promptId: form.promptId || undefined,
        body: form.body || undefined,
        agentId: form.agentId || undefined,
      };
    }
    const r = await fetch("/api/automations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).then((x) => x.json());
    if (r.error) {
      alert(r.error);
      return;
    }
    setForm({ name: "", triggerKind: "cron", expr: "daily 20:00", repo: "", branch: "", actionKind: "prompt", promptId: "", body: "", agentId: "", script: "" });
    setShowNew(false);
    refresh();
  };

  const toggle = async (a: Automation) => {
    await fetch("/api/automations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: a.id, enabled: !a.enabled }),
    });
    refresh();
  };

  const runNow = async (a: Automation) => {
    setBusy(a.id);
    const r = await fetch("/api/automations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: a.id, runNow: true }),
    }).then((x) => x.json()).catch(() => ({ error: "request failed" }));
    setBusy(null);
    if (r.error) alert(r.error);
    else alert(`Done: ${r.summary ?? "ok"}`);
    refresh();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this automation?")) return;
    await fetch(`/api/automations?id=${id}`, { method: "DELETE" });
    refresh();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div>
          <div className="text-[10px] font-semibold tracking-[0.28em] text-[#ff8c42] uppercase">automations</div>
          <h1 className="font-display text-2xl font-black tracking-tight sm:text-3xl">
            Workflows{" "}
            <span className="text-base font-normal opacity-50">· {items.filter((a) => a.enabled).length} on</span>
          </h1>
        </div>
        <div className="flex-1" />
        <button onClick={() => setShowNew((s) => !s)} className="glow-orange rounded-full bg-gradient-to-r from-[#ff6b1a] to-[#ff9a3d] px-4 py-2 text-sm font-bold text-white transition hover:scale-105">
          + New automation
        </button>
      </div>

      {showNew && (
        <Card>
          <SectionTitle kicker="builder" title="New automation" />
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Name (e.g. Nightly journal summary)" className="glass w-full rounded-xl px-3 py-2 text-sm outline-none" />

          <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
            <div className="glass rounded-xl p-3">
              <div className="mb-1.5 text-[11px] font-bold tracking-[0.2em] opacity-50 uppercase">Trigger</div>
              <div className="flex gap-1.5">
                {(["cron", "git"] as const).map((k) => (
                  <button key={k} onClick={() => setForm({ ...form, triggerKind: k })} className={cn("rounded-full px-3 py-1 text-xs font-bold", form.triggerKind === k ? "bg-gradient-to-r from-[#ff6b1a] to-[#ff9a3d] text-white" : "bg-white/10 opacity-60")}>
                    {k === "cron" ? "🕐 Schedule" : "📦 Git commit"}
                  </button>
                ))}
              </div>
              {form.triggerKind === "cron" ? (
                <input value={form.expr} onChange={(e) => setForm({ ...form, expr: e.target.value })} placeholder='daily 20:00 · hourly · every 30m · 0 9 * * *' className="mt-2 w-full rounded-lg bg-black/30 px-2.5 py-1.5 font-mono text-xs outline-none" />
              ) : (
                <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                  <input value={form.repo} onChange={(e) => setForm({ ...form, repo: e.target.value })} placeholder="repo (blank = any)" className="rounded-lg bg-black/30 px-2.5 py-1.5 text-xs outline-none" />
                  <input value={form.branch} onChange={(e) => setForm({ ...form, branch: e.target.value })} placeholder="branch (blank = any)" className="rounded-lg bg-black/30 px-2.5 py-1.5 text-xs outline-none" />
                </div>
              )}
              {form.triggerKind === "git" && (
                <div className="mt-1.5 font-mono text-[10px] opacity-50">POST /api/hooks/git {"{repo, branch}"}</div>
              )}
            </div>

            <div className="glass rounded-xl p-3">
              <div className="mb-1.5 text-[11px] font-bold tracking-[0.2em] opacity-50 uppercase">Action</div>
              <div className="flex gap-1.5">
                {(["prompt", "digest", "script"] as const).map((k) => (
                  <button key={k} onClick={() => setForm({ ...form, actionKind: k })} className={cn("rounded-full px-3 py-1 text-xs font-bold", form.actionKind === k ? "bg-gradient-to-r from-[#ff6b1a] to-[#ff9a3d] text-white" : "bg-white/10 opacity-60")}>
                    {k === "prompt" ? "💬 Prompt" : k === "digest" ? "🌙 Digest" : "📜 Script"}
                  </button>
                ))}
              </div>
              {form.actionKind === "prompt" && (
                <div className="mt-2 space-y-1.5">
                  <select value={form.promptId} onChange={(e) => setForm({ ...form, promptId: e.target.value })} className="w-full rounded-lg bg-black/30 px-2.5 py-1.5 text-xs outline-none">
                    <option value="">Custom prompt (below)</option>
                    {prompts.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                  </select>
                  {!form.promptId && (
                    <textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={2} placeholder="Prompt body…" className="w-full rounded-lg bg-black/30 px-2.5 py-1.5 text-xs outline-none" />
                  )}
                  <select value={form.agentId} onChange={(e) => setForm({ ...form, agentId: e.target.value })} className="w-full rounded-lg bg-black/30 px-2.5 py-1.5 text-xs outline-none">
                    <option value="">Default provider</option>
                    {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
              )}
              {form.actionKind === "script" && (
                <textarea value={form.script} onChange={(e) => setForm({ ...form, script: e.target.value })} rows={2} placeholder="echo hello >> log.txt" className="mt-2 w-full rounded-lg bg-black/30 px-2.5 py-1.5 font-mono text-xs outline-none" />
              )}
              {form.actionKind === "digest" && (
                <div className="mt-2 text-xs opacity-60">Runs the nightly journal digest on trigger.</div>
              )}
            </div>
          </div>

          <div className="mt-3 flex gap-2">
            <button onClick={create} className="rounded-full bg-gradient-to-r from-[#ff6b1a] to-[#ff9a3d] px-5 py-2 text-sm font-bold text-white">Create ⚙️</button>
            <button onClick={() => setShowNew(false)} className="glass rounded-full px-4 py-2 text-sm">cancel</button>
          </div>
        </Card>
      )}

      {items.length === 0 && !showNew ? (
        <EmptyState icon="⚙️" title="No automations" hint="Schedule recurring agent work or react to git commits — create your first workflow above." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {items.map((a, i) => (
            <motion.div key={a.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.04, 0.25) }} className={cn("glass rounded-2xl p-4", !a.enabled && "opacity-60")}>
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-display font-bold">{a.name}</div>
                  <div className="mt-0.5 text-xs break-words opacity-60">{a.triggerLabel} → {a.actionLabel}</div>
                </div>
                <button
                  onClick={() => toggle(a)}
                  title={a.enabled ? "Disable" : "Enable"}
                  className={cn("relative h-6 w-11 shrink-0 rounded-full transition", a.enabled ? "bg-gradient-to-r from-[#ff6b1a] to-[#8b5cf6]" : "bg-white/15")}
                >
                  <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all", a.enabled ? "left-[22px]" : "left-0.5")} />
                </button>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] opacity-60">
                <Pill tone={a.lastStatus === "ok" ? "green" : a.lastStatus === "error" ? "red" : "neutral"}>
                  {a.lastStatus ? `last: ${a.lastStatus}` : "never run"}
                </Pill>
                <span>{a.runCount} runs</span>
                {a.lastError && <span className="truncate text-red-300" title={a.lastError}>· {a.lastError.slice(0, 80)}</span>}
              </div>
              {a.history.length > 0 && (
                <div className="mt-2 max-h-24 space-y-1 overflow-y-auto">
                  {a.history.slice().reverse().slice(0, 4).map((h, j) => (
                    <div key={j} className="truncate rounded-lg bg-black/30 px-2 py-1 font-mono text-[10px] opacity-70">
                      {h.ok ? "✓" : "✕"} {new Date(h.ts).toLocaleString()} — {h.summary.slice(0, 100)}
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-2.5 flex gap-2 text-xs">
                <button onClick={() => runNow(a)} disabled={busy === a.id} className="rounded-full bg-white/10 px-3.5 py-1.5 font-bold hover:bg-white/20 disabled:opacity-40">
                  {busy === a.id ? "running…" : "▶ Run now"}
                </button>
                <button onClick={() => toggle(a)} className="opacity-60 hover:opacity-100 hover:underline">{a.enabled ? "disable" : "enable"}</button>
                <button onClick={() => { if (confirm("Delete this automation?")) fetch(`/api/automations?id=${a.id}`, { method: "DELETE" }).then(refresh); }} className="ml-auto opacity-60 hover:text-red-300 hover:underline">delete</button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
