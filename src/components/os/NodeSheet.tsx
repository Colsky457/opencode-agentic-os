"use client";

import { useEffect, useState } from "react";
import { renderMarkdown } from "@/components/chat/bits";
import type { GraphNode } from "@/components/os/MemoryGraph";

interface Hit {
  file: string;
  title: string;
  text: string;
}

type NodeT = GraphNode & { name: string };

/** Bottom-sheet: node detail → linked vault notes → md preview + edit. */
export function NodeSheet({ node, onClose }: { node: NodeT | null; onClose: () => void }) {
  const [hits, setHits] = useState<Hit[] | null>(null);
  const [file, setFile] = useState<string | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setHits(null);
    setFile(null);
    setContent(null);
    setEditing(false);
    if (!node) return;
    fetch(`/api/vault/search?q=${encodeURIComponent(node.label)}&k=6`)
      .then((r) => r.json())
      .then((d) => {
        const seen = new Map<string, Hit>();
        for (const h of (d.hits ?? []) as Hit[]) if (!seen.has(h.file)) seen.set(h.file, h);
        setHits([...seen.values()]);
      })
      .catch(() => setHits([]));
  }, [node]);

  useEffect(() => {
    if (!file) return;
    setContent(null);
    setEditing(false);
    fetch(`/api/brain-file?path=${encodeURIComponent(file)}`)
      .then((r) => r.json())
      .then((d) => {
        setContent(typeof d.content === "string" ? d.content : null);
        setDraft(typeof d.content === "string" ? d.content : "");
      })
      .catch(() => setContent(null));
  }, [file]);

  if (!node) return null;

  const save = async () => {
    if (!file || saving) return;
    setSaving(true);
    try {
      const r = await fetch("/api/brain-file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: file, content: draft }),
      });
      if (r.ok) {
        setContent(draft);
        setEditing(false);
        fetch("/api/vault", { method: "POST" }).catch(() => {});
      }
    } finally {
      setSaving(false);
    }
  };

  const short = (p: string) => p.split("/").slice(-3).join("/");

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="glass relative m-0 max-h-[85dvh] w-full max-w-2xl overflow-y-auto rounded-t-3xl p-5 sm:m-4 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 text-[10px] font-semibold tracking-[0.28em] text-[#ff8c42] uppercase">{node.type} node</div>
        <h3 className="font-display pr-8 text-xl font-bold">{node.name}</h3>
        {node.detail && <p className="mt-1 text-sm opacity-70">{node.detail}</p>}
        <button onClick={onClose} className="glass absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full text-sm opacity-70 hover:opacity-100">
          ✕
        </button>

        <div className="mt-4 text-[10px] font-semibold tracking-[0.28em] opacity-50 uppercase">Linked notes</div>
        {hits === null ? (
          <div className="mt-2 text-sm opacity-50">Searching vault…</div>
        ) : hits.length === 0 ? (
          <div className="mt-2 text-sm opacity-50">No vault notes mention “{node.label}” yet.</div>
        ) : (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {hits.map((h) => (
              <button
                key={h.file}
                onClick={() => setFile(h.file)}
                className={`max-w-full truncate rounded-full px-3 py-1.5 text-xs transition ${file === h.file ? "bg-[#ff6b1a] font-bold text-white" : "bg-white/8 hover:bg-white/15"}`}
                title={h.file}
              >
                📄 {h.title || short(h.file)}
              </button>
            ))}
          </div>
        )}

        {file && (
          <div className="mt-3 rounded-2xl border border-white/10 bg-black/30 p-4">
            <div className="mb-2 flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-xs opacity-50" title={file}>{short(file)}</span>
              {content !== null && (
                <button
                  onClick={() => (editing ? save() : setEditing(true))}
                  disabled={saving}
                  className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold transition hover:bg-[#ff6b1a] hover:text-white disabled:opacity-50"
                >
                  {editing ? (saving ? "saving…" : "💾 save") : "✎ edit"}
                </button>
              )}
              {editing && (
                <button onClick={() => { setEditing(false); setDraft(content ?? ""); }} className="rounded-full bg-white/10 px-3 py-1 text-xs opacity-70 hover:opacity-100">
                  cancel
                </button>
              )}
            </div>
            {content === null ? (
              <div className="text-sm opacity-50">Loading note…</div>
            ) : editing ? (
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={14}
                className="glass w-full rounded-xl px-3 py-2 font-mono text-xs leading-relaxed outline-none"
              />
            ) : (
              <div className="max-h-[40dvh] overflow-y-auto text-sm leading-relaxed">{renderMarkdown(content)}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
