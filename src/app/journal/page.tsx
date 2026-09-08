"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Card, EmptyState, SectionTitle } from "@/components/os/ui";
import { VoiceField } from "@/components/chat/VoiceField";
import { dayLabel, formatClock } from "@/components/chat/bits";

interface Entry {
  id: string;
  title: string;
  body: string;
  mood: string;
  ts: number;
}

const MOODS = ["🚀", "🔥", "💡", "😌", "🤔", "😤", "🎉"];

export default function JournalPage() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [mood, setMood] = useState("");
  const [showNew, setShowNew] = useState(false);

  const refresh = () => fetch("/api/journal").then((r) => r.json()).then((d) => setEntries(d.entries ?? [])).catch(() => {});
  useEffect(() => {
    refresh();
  }, []);

  const save = async () => {
    if (!title.trim() && !body.trim()) return;
    await fetch("/api/journal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: title.trim() || "Untitled entry", body, mood }),
    });
    setTitle("");
    setBody("");
    setMood("");
    setShowNew(false);
    refresh();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this entry? (brain daily file keeps its copy)")) return;
    await fetch(`/api/journal?id=${id}`, { method: "DELETE" });
    refresh();
  };

  let lastDay = "";

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center gap-3">
        <div>
          <div className="text-[10px] font-semibold tracking-[0.28em] text-[#ff8c42] uppercase">log</div>
          <h1 className="font-display text-2xl font-black tracking-tight sm:text-3xl">Journal</h1>
        </div>
        <div className="flex-1" />
        <button onClick={() => setShowNew((s) => !s)} className="glow-orange rounded-full bg-gradient-to-r from-[#ff6b1a] to-[#ff9a3d] px-4 py-2 text-sm font-bold text-white transition hover:scale-105">
          + New entry
        </button>
      </div>

      <div className="glass rounded-2xl p-3 text-xs opacity-70">
        🧠 Every entry appends to <span className="font-mono">brain/Agentic OS/Journal/YYYY-MM-DD.md</span> automatically.
      </div>

      {showNew && (
        <Card>
          <SectionTitle kicker="today" title={new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })} />
          <div className="mb-2 flex gap-1.5">
            {MOODS.map((m) => (
              <button key={m} onClick={() => setMood(mood === m ? "" : m)} className={`rounded-full px-2 py-1 text-lg transition hover:scale-125 ${mood === m ? "bg-white/15" : "opacity-50 hover:opacity-100"}`}>
                {m}
              </button>
            ))}
          </div>
          <VoiceField value={title} onText={setTitle} micSize={26}>
            <input placeholder="Headline (or dictate 🎙)" className="glass w-full rounded-xl px-3 py-2 text-sm outline-none" />
          </VoiceField>
          <VoiceField value={body} onText={setBody} multiline micSize={30} className="mt-2.5">
            <textarea rows={5} placeholder="What's on your mind? Speak or type — it saves to your brain…" className="glass w-full rounded-xl px-3 py-2 text-sm leading-relaxed outline-none" />
          </VoiceField>
          <div className="mt-3 flex gap-2">
            <button onClick={save} className="rounded-full bg-gradient-to-r from-[#ff6b1a] to-[#ff9a3d] px-5 py-2 text-sm font-bold text-white">Save to brain 🧠</button>
            <button onClick={() => setShowNew(false)} className="glass rounded-full px-4 py-2 text-sm">cancel</button>
          </div>
        </Card>
      )}

      {entries.length === 0 && !showNew ? (
        <EmptyState icon="❝" title="Blank page" hint="Write your first entry — it lands in your brain's daily file instantly." />
      ) : (
        <div className="space-y-1">
          {entries.map((e, i) => {
            const day = dayLabel(e.ts);
            const showDay = day !== lastDay;
            lastDay = day;
            return (
              <div key={e.id}>
                {showDay && (
                  <div className="my-3 flex items-center gap-3 text-[11px] opacity-40">
                    <span className="h-px flex-1 bg-white/10" />
                    {day}
                    <span className="h-px flex-1 bg-white/10" />
                  </div>
                )}
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.03, 0.2) }} className="glass group rounded-3xl p-4">
                  <div className="flex items-baseline gap-2">
                    {e.mood && <span className="text-lg">{e.mood}</span>}
                    <div className="font-display min-w-0 flex-1 font-bold break-words">{e.title}</div>
                    <span className="shrink-0 text-[11px] opacity-40">{formatClock(e.ts)}</span>
                  </div>
                  {e.body && <p className="mt-1.5 text-sm break-words whitespace-pre-wrap opacity-75">{e.body}</p>}
                  <button onClick={() => remove(e.id)} className="mt-1 text-[11px] opacity-60 transition hover:text-red-300 hover:underline lg:opacity-0 lg:group-hover:opacity-50 lg:hover:!opacity-100">
                    delete
                  </button>
                </motion.div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
