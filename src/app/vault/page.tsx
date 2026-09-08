"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card, EmptyState, Pill, SectionTitle } from "@/components/os/ui";
import { cn } from "@/lib/utils";

interface VaultStatus {
  files: number;
  chunks: number;
  embedded: number;
  updatedAt: number;
  embedError: string | null;
  fileList: { file: string; chunks: number }[];
  progress: { running: boolean; total: number; done: number; current: string; embedded: number; errors: string[] };
}

interface Hit {
  id: string;
  file: string;
  title: string;
  chunkIndex: number;
  text: string;
  score: number;
  method: "semantic" | "keyword";
}

export default function VaultPage() {
  const [status, setStatus] = useState<VaultStatus | null>(null);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [embedded, setEmbedded] = useState(false);
  const [searching, setSearching] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    const d = await fetch("/api/vault").then((r) => r.json()).catch(() => null);
    if (d) setStatus(d);
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
  }, [refresh]);

  const indexNow = async () => {
    await fetch("/api/vault", { method: "POST" }).catch(() => {});
    refresh();
  };

  const search = async (query?: string) => {
    const needle = (query ?? q).trim();
    if (!needle) return;
    setSearching(true);
    try {
      const d = await fetch(`/api/vault/search?q=${encodeURIComponent(needle)}`).then((r) => r.json());
      setHits(d.hits ?? []);
      setEmbedded(!!d.embedded);
    } finally {
      setSearching(false);
    }
  };

  const upload = async (files: FileList | File[]) => {
    const form = new FormData();
    let n = 0;
    for (const f of Array.from(files)) {
      if (!/\.(md|markdown|txt|pdf)$/i.test(f.name)) continue;
      form.append("file", f);
      n++;
    }
    if (!n) {
      setUploadMsg("only .md and .pdf files, please");
      return;
    }
    setUploadMsg(`uploading ${n} file${n === 1 ? "" : "s"}…`);
    try {
      const d = await fetch("/api/vault/upload", { method: "POST", body: form }).then((r) => r.json());
      setUploadMsg(d.ok ? `✓ indexed: ${(d.files ?? []).join(", ")}` : `✗ ${d.error ?? "upload failed"}`);
    } catch {
      setUploadMsg("✗ upload failed");
    }
    refresh();
  };

  const prog = status?.progress;

  return (
    <div className="space-y-4">
      <div>
        <div className="text-[10px] font-semibold tracking-[0.28em] text-[#ff8c42] uppercase">vault explorer</div>
        <h1 className="font-display text-2xl font-black tracking-tight sm:text-3xl">Notes & Documents</h1>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          {/* search */}
          <Card>
            <SectionTitle kicker="rag" title="Search the vault" right={embedded ? <Pill tone="green">semantic</Pill> : <Pill tone="neutral">keyword</Pill>} />
            <div className="flex gap-2">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && search()}
                placeholder="Ask across all notes & docs…"
                className="glass min-w-0 flex-1 rounded-full px-4 py-2.5 text-sm outline-none placeholder:text-white/30 focus:border-[#22e6c8]/60"
              />
              <button onClick={() => search()} disabled={searching || !q.trim()} className="glow-orange rounded-full bg-gradient-to-r from-[#ff6b1a] to-[#ff9a3d] px-5 py-2.5 text-sm font-bold text-white transition hover:scale-105 disabled:opacity-40">
                {searching ? "…" : "🔍"}
              </button>
            </div>
            <div className="mt-3 space-y-2">
              {hits.map((h) => (
                <button key={h.id} onClick={() => search(h.title)} className="block w-full rounded-xl bg-white/5 px-3.5 py-2.5 text-left transition hover:bg-white/10">
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-sm font-bold">{h.title}</span>
                    <span className="flex-1" />
                    <Pill tone={h.method === "semantic" ? "green" : "neutral"}>{h.method}</Pill>
                    <span className="font-mono text-[10px] opacity-40">{h.score}</span>
                  </div>
                  <div className="mt-1 line-clamp-2 text-xs break-words opacity-60">{h.text}</div>
                  <div className="mt-1 truncate font-mono text-[10px] opacity-40">{h.file}</div>
                </button>
              ))}
              {hits.length === 0 && q && !searching && (
                <div className="py-4 text-center text-sm opacity-50">no chunks matched — try fewer words</div>
              )}
            </div>
          </Card>

          {/* files */}
          <Card>
            <SectionTitle kicker="index" title="Indexed files" right={<span className="text-xs opacity-50">{status ? `${status.files} files · ${status.chunks} chunks · ${status.embedded} embedded` : "…"}</span>} />
            {!status ? (
              <div className="py-6 text-center text-sm opacity-50">loading index…</div>
            ) : status.files === 0 ? (
              <EmptyState icon="📚" title="Index is empty" hint="Index your brain vault below, or drop in markdown/PDF files to get started." />
            ) : (
              <div className="max-h-64 space-y-1 overflow-y-auto">
                {(status.fileList ?? []).map((f) => (
                  <div key={f.file} className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition hover:bg-white/5">
                    <span>{f.file.toLowerCase().endsWith(".pdf") ? "📕" : "📄"}</span>
                    <span className="min-w-0 flex-1 truncate font-mono text-[12px]">{f.file}</span>
                    <span className="text-[10px] opacity-40">{f.chunks} chunks</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          {/* index controls */}
          <Card>
            <SectionTitle kicker="engine" title="Index status" />
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between"><span className="opacity-50">Embeddings</span><span>{status && status.embedded > 0 ? `✅ ${status.embedded} vectors` : status?.embedError ? "⚠️ keyword mode" : "…"}</span></div>
              {status?.embedError && status.embedded === 0 && (
                <div className="rounded-lg bg-white/5 p-2 opacity-60" title={status.embedError}>
                  model unavailable — keyword search active ({status.embedError.slice(0, 80)}…)
                </div>
              )}
              {prog?.running && (
                <div>
                  <div className="flex justify-between text-[11px]"><span className="truncate opacity-60">{prog.current || "starting…"}</span><span>{prog.done}/{prog.total}</span></div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-gradient-to-r from-[#22e6c8] to-[#4da6ff] transition-all" style={{ width: prog.total ? `${Math.round((prog.done / prog.total) * 100)}%` : "0%" }} />
                  </div>
                </div>
              )}
              {prog && !prog.running && prog.errors.length > 0 && (
                <div className="rounded-lg bg-red-400/10 p-2 text-[11px] break-words text-red-300">{prog.errors.slice(0, 3).join(" · ")}</div>
              )}
            </div>
            <button onClick={indexNow} disabled={prog?.running} className="mt-3 w-full rounded-full bg-gradient-to-r from-[#22e6c8] to-[#4da6ff] py-2 text-sm font-bold text-white transition hover:scale-[1.02] disabled:opacity-40">
              {prog?.running ? "⏳ Indexing…" : "🔄 Rebuild index"}
            </button>
            <p className="mt-2 text-[11px] opacity-50">Scans your brain vault + uploads. First run downloads the embedding model (~90MB, one time).</p>
          </Card>

          {/* uploader */}
          <Card>
            <SectionTitle kicker="add" title="Upload documents" />
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files.length) upload(e.dataTransfer.files); }}
              onClick={() => fileRef.current?.click()}
              className={cn(
                "cursor-pointer rounded-2xl border-2 border-dashed p-6 text-center transition",
                dragOver ? "border-[#22e6c8] bg-[#22e6c8]/10" : "border-white/15 hover:border-white/30"
              )}
            >
              <div className="text-3xl">📥</div>
              <div className="mt-1 text-sm font-bold">Drop .md / .pdf here</div>
              <div className="text-xs opacity-50">or click to browse</div>
              <input ref={fileRef} type="file" accept=".md,.markdown,.txt,.pdf" multiple className="hidden" onChange={(e) => { if (e.target.files?.length) upload(e.target.files); e.target.value = ""; }} />
            </div>
            {uploadMsg && <div className="mt-2 font-mono text-[11px] opacity-70">{uploadMsg}</div>}
          </Card>
        </div>
      </div>
    </div>
  );
}
