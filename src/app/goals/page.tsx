"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Card, EmptyState, Pill, SectionTitle } from "@/components/os/ui";
import { VoiceField } from "@/components/chat/VoiceField";
import { timeAgo } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface Goal {
  id: string;
  title: string;
  notes: string;
  status: "active" | "done" | "archived";
  due: string;
  updatedAt: number;
}

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [due, setDue] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [filter, setFilter] = useState<"active" | "done" | "archived" | "all">("active");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState({ title: "", notes: "", due: "" });

  const refresh = () => fetch("/api/goals").then((r) => r.json()).then((d) => setGoals(d.goals ?? [])).catch(() => {});
  useEffect(() => {
    refresh();
  }, []);

  const create = async () => {
    if (!title.trim()) return;
    await fetch("/api/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, notes, due }),
    });
    setTitle("");
    setNotes("");
    setDue("");
    setShowNew(false);
    refresh();
  };

  const patch = async (id: string, p: Partial<Goal>) => {
    await fetch("/api/goals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...p }),
    });
    refresh();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this goal? (brain file is removed too)")) return;
    await fetch(`/api/goals?id=${id}`, { method: "DELETE" });
    refresh();
  };

  const list = goals.filter((g) => filter === "all" || g.status === filter);
  const activeCount = goals.filter((g) => g.status === "active").length;
  const doneCount = goals.filter((g) => g.status === "done").length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div>
          <div className="text-[10px] font-semibold tracking-[0.28em] text-[#ff8c42] uppercase">missions</div>
          <h1 className="font-display text-2xl font-black tracking-tight sm:text-3xl">
            Goals{" "}
            <span className="text-base font-normal opacity-50">
              · {activeCount} active · {doneCount} done
            </span>
          </h1>
        </div>
        <div className="flex-1" />
        <button onClick={() => setShowNew((s) => !s)} className="glow-orange rounded-full bg-gradient-to-r from-[#ff6b1a] to-[#ff9a3d] px-4 py-2 text-sm font-bold text-white transition hover:scale-105">
          + New goal
        </button>
      </div>

      <div className="glass rounded-2xl p-3 text-xs opacity-70">
        🧠 Every change syncs to <span className="font-mono">brain/Agentic OS/Goals.md</span> as <span className="font-mono">- [ ] / - [x]</span> checkbox tasks — Obsidian Tasks compatible.
      </div>

      <AnimatePresence>
        {showNew && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <Card>
              <SectionTitle kicker="target" title="New goal" />
              <VoiceField value={title} onText={setTitle} micSize={26}>
                <input
                  onKeyDown={(e) => e.key === "Enter" && create()}
                  placeholder="What are we aiming at? (or dictate 🎙)"
                  className="glass w-full rounded-xl px-3 py-2 text-sm outline-none"
                />
              </VoiceField>
              <VoiceField value={notes} onText={setNotes} multiline micSize={28} className="mt-2.5">
                <textarea rows={3} placeholder="Notes, plan, acceptance criteria…" className="glass w-full rounded-xl px-3 py-2 text-sm outline-none" />
              </VoiceField>
              <div className="mt-2.5 flex gap-2">
                <input value={due} onChange={(e) => setDue(e.target.value)} placeholder="due (e.g. 2026-10-01)" className="glass rounded-xl px-3 py-2 text-sm outline-none" />
                <button onClick={create} className="rounded-full bg-gradient-to-r from-[#ff6b1a] to-[#ff9a3d] px-5 py-2 text-sm font-bold text-white">Set goal ◎</button>
                <button onClick={() => setShowNew(false)} className="glass rounded-full px-4 py-2 text-sm">cancel</button>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex gap-1.5">
        {(["active", "done", "archived", "all"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={cn("rounded-full px-3.5 py-1.5 text-xs font-bold transition", filter === f ? "bg-gradient-to-r from-[#ff6b1a] to-[#8b5cf6] text-white" : "glass opacity-60 hover:opacity-100")}>
            {f}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <EmptyState icon="◎" title={filter === "active" ? "No active goals" : `No ${filter} goals`} hint="Set a target — it lands in your brain instantly as markdown." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {list.map((g, i) => (
            <motion.div key={g.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.04, 0.25) }} className="glass rounded-3xl p-4">
              <div className="flex items-start gap-3">
                <button
                  onClick={() => patch(g.id, { status: g.status === "done" ? "active" : "done" })}
                  title={g.status === "done" ? "Reopen" : "Mark done"}
                  className={cn(
                    "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-sm font-black transition hover:scale-110",
                    g.status === "done" ? "border-emerald-400 bg-emerald-400/25 text-emerald-300" : "border-white/25 opacity-70 hover:border-emerald-400/70"
                  )}
                >
                  {g.status === "done" ? "✓" : ""}
                </button>
                <div className="min-w-0 flex-1">
                  {editing === g.id ? (
                    <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} className="w-full rounded-lg bg-black/30 px-2 py-1 text-sm font-bold outline-none" />
                  ) : (
                    <div className={cn("font-display font-bold", g.status === "done" && "line-through opacity-50")}>{g.title}</div>
                  )}
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] opacity-50">
                    <Pill tone={g.status === "active" ? "green" : g.status === "done" ? "violet" : "neutral"}>{g.status}</Pill>
                    {g.due && <span>📅 {g.due}</span>}
                    <span>{timeAgo(g.updatedAt)}</span>
                  </div>
                </div>
              </div>
              {editing === g.id ? (
                <div className="mt-2.5 space-y-2">
                  <textarea value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} rows={3} className="w-full rounded-xl bg-black/30 px-2.5 py-2 text-xs outline-none" placeholder="Notes" />
                  <input value={draft.due} onChange={(e) => setDraft({ ...draft, due: e.target.value })} className="w-full rounded-xl bg-black/30 px-2.5 py-1.5 text-xs outline-none" placeholder="due" />
                  <div className="flex gap-2">
                    <button onClick={() => { patch(g.id, draft); setEditing(null); }} className="rounded-full bg-emerald-500/85 px-4 py-1.5 text-xs font-bold text-white">save</button>
                    <button onClick={() => setEditing(null)} className="glass rounded-full px-4 py-1.5 text-xs">cancel</button>
                  </div>
                </div>
              ) : (
                g.notes && <p className="mt-2 line-clamp-3 text-sm whitespace-pre-wrap opacity-70">{g.notes}</p>
              )}
              <div className="mt-2.5 flex gap-3 text-xs opacity-60">
                <button onClick={() => { setEditing(g.id); setDraft({ title: g.title, notes: g.notes, due: g.due }); }} className="hover:opacity-100 hover:underline">edit</button>
                {g.status !== "archived" && <button onClick={() => patch(g.id, { status: "archived" })} className="hover:opacity-100 hover:underline">archive</button>}
                {g.status === "archived" && <button onClick={() => patch(g.id, { status: "active" })} className="hover:opacity-100 hover:underline">restore</button>}
                <button onClick={() => remove(g.id)} className="ml-auto hover:text-red-300 hover:underline">delete</button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
