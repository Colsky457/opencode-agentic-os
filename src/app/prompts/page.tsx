"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Card, EmptyState, SectionTitle } from "@/components/os/ui";
import { VoiceField } from "@/components/chat/VoiceField";

interface Prompt {
  id: string;
  title: string;
  body: string;
  tags: string[];
  uses: number;
}

export default function PromptsPage() {
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [q, setQ] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ title: "", body: "", tags: "" });
  const router = useRouter();

  const refresh = () => fetch("/api/prompts").then((r) => r.json()).then((d) => setPrompts(d.prompts ?? [])).catch(() => {});
  useEffect(() => {
    refresh();
  }, []);

  const create = async () => {
    if (!form.title.trim() || !form.body.trim()) return;
    await fetch("/api/prompts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: form.title, body: form.body, tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean) }),
    });
    setForm({ title: "", body: "", tags: "" });
    setShowNew(false);
    refresh();
  };

  const useIt = async (p: Prompt) => {
    await fetch("/api/prompts", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: p.id, used: true }) });
    await navigator.clipboard.writeText(p.body).catch(() => {});
    router.push("/chat");
  };

  const filtered = prompts.filter(
    (p) => !q || p.title.toLowerCase().includes(q.toLowerCase()) || p.body.toLowerCase().includes(q.toLowerCase()) || p.tags.some((t) => t.includes(q.toLowerCase()))
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div>
          <div className="text-[10px] font-semibold tracking-[0.28em] text-[#ff8c42] uppercase">library</div>
          <h1 className="font-display text-2xl font-black tracking-tight sm:text-3xl">Prompt Library</h1>
        </div>
        <div className="flex-1" />
        <VoiceField value={q} onText={setQ} micSize={24} className="w-40 sm:w-56">
          <input placeholder="search…" className="glass w-full rounded-full px-3 py-1.5 text-sm outline-none" />
        </VoiceField>
        <button onClick={() => setShowNew((s) => !s)} className="glow-orange rounded-full bg-gradient-to-r from-[#ff6b1a] to-[#ff9a3d] px-4 py-2 text-sm font-bold text-white">+ New</button>
      </div>

      {showNew && (
        <Card>
          <SectionTitle kicker="forge" title="New template" />
          <VoiceField value={form.title} onText={(v) => setForm({ ...form, title: v })} micSize={26}>
            <input placeholder="Title" className="glass w-full rounded-xl px-3 py-2 text-sm outline-none" />
          </VoiceField>
          <VoiceField value={form.body} onText={(v) => setForm({ ...form, body: v })} multiline micSize={28} className="mt-2">
            <textarea rows={4} placeholder="Prompt body… — or dictate it 🎙" className="glass w-full rounded-xl px-3 py-2 text-sm outline-none" />
          </VoiceField>
          <VoiceField value={form.tags} onText={(v) => setForm({ ...form, tags: v })} micSize={26} className="mt-2">
            <input placeholder="tags, comma, separated" className="glass w-full rounded-xl px-3 py-2 text-sm outline-none" />
          </VoiceField>
          <button onClick={create} className="mt-2.5 rounded-full bg-gradient-to-r from-[#ff6b1a] to-[#ff9a3d] px-5 py-2 text-sm font-bold text-white">Save ✎</button>
        </Card>
      )}

      {filtered.length === 0 ? (
        <EmptyState icon="✎" title="No templates" hint="Save your best prompts here — one click copies them into chat." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((p, i) => (
            <motion.div key={p.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.04, 0.25) }} className="glass rounded-2xl p-4">
              <div className="flex items-center gap-2">
                <div className="font-display flex-1 truncate font-bold">{p.title}</div>
                <span className="text-[11px] opacity-50">×{p.uses}</span>
              </div>
              <p className="mt-1 line-clamp-3 text-sm opacity-70">{p.body}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {p.tags.map((t) => (
                  <span key={t} className="rounded-full bg-white/8 px-2 py-0.5 text-[11px] opacity-70">#{t}</span>
                ))}
              </div>
              <div className="mt-3 flex gap-2">
                <button onClick={() => useIt(p)} className="rounded-full bg-[#ff6b1a]/15 px-3.5 py-1.5 text-xs font-bold text-[#ffb27a] hover:bg-[#ff6b1a]/25">copy + open chat ➤</button>
                <button onClick={async () => { await navigator.clipboard.writeText(p.body).catch(() => {}); }} className="glass rounded-full px-3.5 py-1.5 text-xs">copy</button>
                <button onClick={async () => { if (confirm("Delete template?")) { await fetch(`/api/prompts?id=${p.id}`, { method: "DELETE" }); refresh(); } }} className="ml-auto text-xs opacity-50 hover:text-red-300">delete</button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
