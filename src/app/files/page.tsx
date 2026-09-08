"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, SectionTitle } from "@/components/os/ui";
import { VoiceField } from "@/components/chat/VoiceField";
import { cn } from "@/lib/utils";

interface Item {
  name: string;
  dir: boolean;
  size: number;
  mtime: number;
  path: string;
}

export default function FilesPage() {
  const [path, setPath] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [file, setFile] = useState<{ path: string; content?: string; binary?: boolean } | null>(null);
  const [draft, setDraft] = useState("");
  const [newName, setNewName] = useState("");
  const [dirty, setDirty] = useState(false);

  const load = useCallback(async (p: string) => {
    const d = await fetch(`/api/files?path=${encodeURIComponent(p)}`).then((r) => r.json()).catch(() => null);
    if (!d) return;
    if (d.type === "dir") {
      setItems(d.items ?? []);
      setFile(null);
      setPath(d.path ?? p);
    } else {
      setFile(d);
      setDraft(d.content ?? "");
      setDirty(false);
    }
  }, []);

  useEffect(() => {
    load("");
  }, [load]);

  const crumbs = path ? path.split("/") : [];

  const save = async () => {
    if (!file) return;
    await fetch("/api/files", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: file.path, content: draft }),
    });
    setDirty(false);
  };

  const mkdir = async () => {
    if (!newName.trim()) return;
    await fetch("/api/files", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: (path ? path + "/" : "") + newName.trim(), mkdir: true }),
    });
    setNewName("");
    load(path);
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <Card>
        <SectionTitle kicker="workspace" title="Files" />
        <div className="mb-2 flex flex-wrap items-center gap-1 text-xs">
          <button onClick={() => load("")} className="rounded-md bg-white/8 px-2 py-1 font-mono hover:bg-white/15">workspaces/</button>
          {crumbs.map((c, i) => (
            <span key={i} className="flex items-center gap-1">
              <span className="opacity-30">/</span>
              <button onClick={() => load(crumbs.slice(0, i + 1).join("/"))} className="rounded-md bg-white/8 px-2 py-1 font-mono hover:bg-white/15">{c}</button>
            </span>
          ))}
        </div>
        <div className="max-h-[52vh] space-y-1 overflow-y-auto">
          {path && (
            <button onClick={() => load(crumbs.slice(0, -1).join("/"))} className="w-full rounded-lg px-2.5 py-1.5 text-left text-sm opacity-60 hover:bg-white/8">↩ ..</button>
          )}
          {items.map((it) => (
            <button
              key={it.path}
              onClick={() => (it.dir ? load(it.path) : load(it.path))}
              className={cn("flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition hover:bg-white/8", file?.path === it.path && "bg-[#ff6b1a]/15")}
            >
              <span>{it.dir ? "📁" : "📄"}</span>
              <span className="flex-1 truncate font-mono text-[13px]">{it.name}</span>
              {!it.dir && <span className="text-[10px] opacity-40">{(it.size / 1024).toFixed(1)}k</span>}
            </button>
          ))}
          {items.length === 0 && <div className="py-6 text-center text-sm opacity-50">empty folder — agent workspaces appear here</div>}
        </div>
        <div className="mt-3 flex gap-2">
          <VoiceField value={newName} onText={setNewName} micSize={24} className="flex-1">
            <input onKeyDown={(e) => e.key === "Enter" && mkdir()} placeholder="new folder…" className="glass w-full flex-1 rounded-full px-3 py-1.5 text-xs outline-none" />
          </VoiceField>
          <button onClick={mkdir} className="glass rounded-full px-3 py-1.5 text-xs font-bold">+ dir</button>
        </div>
        <p className="mt-2 text-[11px] opacity-40">Scoped to <span className="font-mono">workspaces/</span> — escapes blocked. Each agent works in its own folder.</p>
      </Card>

      <Card className="flex min-h-[60vh] flex-col">
        <SectionTitle kicker="editor" title={file ? file.path.split("/").pop() ?? "file" : "Select a file"} right={file && !file.binary ? <button onClick={save} disabled={!dirty} className="rounded-full bg-gradient-to-r from-[#ff6b1a] to-[#ff9a3d] px-4 py-1.5 text-xs font-bold text-white disabled:opacity-40">💾 save{dirty ? " ●" : ""}</button> : undefined} />
        {!file ? (
          <div className="flex flex-1 items-center justify-center text-sm opacity-50">← pick a file to view & edit</div>
        ) : file.binary ? (
          <div className="text-sm opacity-60">(binary or too large to preview)</div>
        ) : (
          <textarea
            value={draft}
            onChange={(e) => { setDraft(e.target.value); setDirty(true); }}
            spellCheck={false}
            className="term min-h-[50vh] flex-1 rounded-xl bg-black/40 p-3 text-white/85 outline-none focus:border focus:border-[#ff6b1a]/50"
          />
        )}
      </Card>
    </div>
  );
}
