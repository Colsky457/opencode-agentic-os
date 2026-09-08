"use client";

import { useState } from "react";
import { Card, SectionTitle } from "@/components/os/ui";
import { VoiceField } from "@/components/chat/VoiceField";
import { MemoryGraph, TYPE_COLORS, type GraphNode } from "@/components/os/MemoryGraph";

export default function GraphPage() {
  const [label, setLabel] = useState("");
  const [detail, setDetail] = useState("");
  const [type, setType] = useState("idea");
  const [selected, setSelected] = useState<(GraphNode & { name: string }) | null>(null);
  const [signal, setSignal] = useState(0);

  const refresh = () => setSignal((s) => s + 1);

  const add = async () => {
    if (!label.trim()) return;
    await fetch("/api/graph", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: label.trim(), detail, type }),
    });
    setLabel("");
    setDetail("");
    refresh();
  };

  const remove = async (id: string) => {
    await fetch(`/api/graph?id=${id}`, { method: "DELETE" });
    setSelected(null);
    refresh();
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
      <MemoryGraph refreshSignal={signal} selectedId={selected?.id} onSelect={setSelected} />

      <div className="space-y-3">
        <Card>
          <SectionTitle kicker="capture" title="New memory" />
          <VoiceField value={label} onText={setLabel} micSize={26}>
            <input onKeyDown={(e) => e.key === "Enter" && add()} placeholder="Label (e.g. Launch checklist)" className="glass w-full rounded-xl px-3 py-2 text-sm outline-none" />
          </VoiceField>
          <div className="mt-2 flex gap-1.5">
            {Object.keys(TYPE_COLORS).map((t) => (
              <button key={t} onClick={() => setType(t)} className={`rounded-full px-2.5 py-1 text-[11px] transition ${type === t ? "text-white" : "bg-white/8 opacity-60 hover:opacity-100"}`} style={type === t ? { background: TYPE_COLORS[t] } : undefined}>
                {t}
              </button>
            ))}
          </div>
          <VoiceField value={detail} onText={setDetail} multiline micSize={28} className="mt-2">
            <textarea rows={3} placeholder="Detail (optional) — or dictate it 🎙" className="glass w-full rounded-xl px-3 py-2 text-sm outline-none" />
          </VoiceField>
          <button onClick={add} className="mt-2.5 w-full rounded-full bg-gradient-to-r from-[#ff6b1a] to-[#ff9a3d] py-2 text-sm font-bold text-white transition hover:scale-[1.02]">
            ⋈ Capture + auto-link
          </button>
          <p className="mt-2 text-[11px] opacity-50">New nodes auto-link to related nodes by keyword overlap. Chats also feed the graph automatically.</p>
        </Card>

        {selected && (
          <Card>
            <SectionTitle kicker={selected.type} title={String(selected.name).slice(0, 40)} />
            {selected.detail && <p className="text-sm opacity-70">{selected.detail}</p>}
            <button onClick={() => remove(selected.id)} className="mt-3 w-full rounded-full border border-red-400/40 bg-red-400/10 py-1.5 text-xs font-bold text-red-300 hover:bg-red-400/20">
              delete node
            </button>
          </Card>
        )}
      </div>
    </div>
  );
}
