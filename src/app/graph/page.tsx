"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { Card, EmptyState, SectionTitle } from "@/components/os/ui";
import { VoiceField } from "@/components/chat/VoiceField";

const ForceGraph = dynamic(() => import("react-force-graph-2d"), { ssr: false });

const TYPE_COLORS: Record<string, string> = {
  agent: "#ff6b1a",
  chat: "#8b5cf6",
  prompt: "#ffd166",
  file: "#22e6c8",
  idea: "#ff4d6d",
};

export default function GraphPage() {
  const [graph, setGraph] = useState<{ nodes: any[]; edges: any[] }>({ nodes: [], edges: [] });
  const [label, setLabel] = useState("");
  const [detail, setDetail] = useState("");
  const [type, setType] = useState("idea");
  const [selected, setSelected] = useState<any>(null);

  const refresh = useCallback(() => {
    fetch("/api/graph").then((r) => r.json()).then(setGraph).catch(() => {});
  }, []);
  useEffect(refresh, [refresh]);

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

  const data = {
    nodes: graph.nodes.map((n) => ({ id: n.id, name: n.label, ...n })),
    links: graph.edges.map((e) => ({ source: e.from, target: e.to, label: e.label })),
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
      <Card className="overflow-hidden">
        <SectionTitle kicker="memory" title="Shared memory graph" right={<span className="text-xs opacity-50">{graph.nodes.length} nodes · {graph.edges.length} links</span>} />
        {graph.nodes.length === 0 ? (
          <EmptyState icon="⋈" title="Memory is empty" hint="Capture ideas, chats, and files as nodes — related items auto-link." />
        ) : (
          <div className="h-[62vh] overflow-hidden rounded-xl bg-black/30">
            <ForceGraph
              graphData={data}
              nodeColor={(n: any) => TYPE_COLORS[n.type] ?? "#fff"}
              nodeLabel={(n: any) => `${n.name}${n.detail ? " — " + n.detail.slice(0, 80) : ""}`}
              linkColor={() => "rgba(255,255,255,0.18)"}
              backgroundColor="rgba(0,0,0,0)"
              onNodeClick={(n: any) => setSelected(n)}
              nodeCanvasObject={(n: any, ctx: CanvasRenderingContext2D, area: number) => {
                const r = Math.sqrt(area) * 1.1;
                ctx.fillStyle = TYPE_COLORS[n.type] ?? "#fff";
                ctx.beginPath();
                ctx.arc(n.x, n.y, r + 3, 0, Math.PI * 2);
                ctx.globalAlpha = 0.35;
                ctx.fill();
                ctx.globalAlpha = 1;
                ctx.beginPath();
                ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
                ctx.fill();
                ctx.font = "11px Inter, sans-serif";
                ctx.fillStyle = "#fff";
                ctx.fillText(String(n.name).slice(0, 24), n.x + r + 5, n.y + 4);
              }}
            />
          </div>
        )}
        <div className="mt-3 flex flex-wrap gap-2 text-[11px] opacity-70">
          {Object.entries(TYPE_COLORS).map(([t, c]) => (
            <span key={t} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: c }} />{t}</span>
          ))}
        </div>
      </Card>

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
            <div className="mt-2 text-xs opacity-50">
              links: {graph.edges.filter((e) => e.from === selected.id || e.to === selected.id).length}
            </div>
            <button onClick={() => remove(selected.id)} className="mt-3 w-full rounded-full border border-red-400/40 bg-red-400/10 py-1.5 text-xs font-bold text-red-300 hover:bg-red-400/20">
              delete node
            </button>
          </Card>
        )}
      </div>
    </div>
  );
}
