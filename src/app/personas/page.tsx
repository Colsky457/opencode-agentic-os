"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, EmptyState, Pill, SectionTitle } from "@/components/os/ui";
import { ProviderBadge } from "@/components/os/ProviderBadge";

interface Platform {
  id: string;
  role: string;
  systemPrompt: string;
  customized: boolean;
  installed: boolean | null;
  version: string | null;
  agents: { id: string; name: string }[];
}

export default function PersonasPage() {
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [drafts, setDrafts] = useState<Record<string, { role: string; systemPrompt: string }>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const refresh = async () => {
    const d = await fetch("/api/platforms").then((r) => r.json()).catch(() => null);
    if (d?.platforms) {
      setPlatforms(d.platforms);
      setDrafts(Object.fromEntries(d.platforms.map((p: Platform) => [p.id, { role: p.role, systemPrompt: p.systemPrompt }])));
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const save = async (id: string) => {
    const d = drafts[id];
    if (!d) return;
    setSaving(id);
    setMsg(null);
    const r = await fetch("/api/platforms", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, role: d.role, systemPrompt: d.systemPrompt }),
    }).then((x) => x.json()).catch(() => null);
    setSaving(null);
    if (r?.platforms) {
      setPlatforms(r.platforms);
      setMsg(`✓ ${id} saved to os.config.json — live immediately, no restart needed.`);
    } else {
      setMsg(`✗ save failed for ${id}.`);
    }
  };

  const reset = async (id: string) => {
    if (!confirm(`Reset ${id} to its built-in role + prompt?`)) return;
    setSaving(id);
    const r = await fetch("/api/platforms", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, reset: true }),
    }).then((x) => x.json()).catch(() => null);
    setSaving(null);
    if (r?.platforms) {
      setPlatforms(r.platforms);
      const p = r.platforms.find((x: Platform) => x.id === id);
      if (p) setDrafts((d) => ({ ...d, [id]: { role: p.role, systemPrompt: p.systemPrompt } }));
      setMsg(`✓ ${id} reset to built-in defaults.`);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="text-[10px] font-semibold tracking-[0.28em] text-[#ff8c42] uppercase">system & personas</div>
        <h1 className="font-display text-2xl font-black tracking-tight sm:text-3xl">Platforms & Personas</h1>
        <p className="mt-1 max-w-2xl text-sm opacity-60">
          Each platform gets an explicit system role that frames every chat, arena run, fleet task, and queued step.
          Edits save straight into <span className="font-mono">os.config.json</span> — leave a field blank to fall back to the built-in default.
        </p>
      </div>

      {msg && <div className="glass rounded-2xl px-4 py-2.5 font-mono text-xs opacity-80">{msg}</div>}

      {platforms.length === 0 ? (
        <EmptyState icon="🎭" title="Loading platforms…" hint="Reading platform roles from os.config.json." />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {platforms.map((p) => {
            const d = drafts[p.id] ?? { role: p.role, systemPrompt: p.systemPrompt };
            const dirty = d.role !== p.role || d.systemPrompt !== p.systemPrompt;
            return (
              <Card key={p.id}>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <ProviderBadge id={p.id} size="sm" />
                  {p.customized && <Pill tone="violet">customized</Pill>}
                  {p.installed === true && <Pill tone="green">installed</Pill>}
                  {p.installed === false && <Pill tone="amber">not installed</Pill>}
                </div>
                <SectionTitle kicker="role" title={p.role || "—"} />
                <label className="mb-1 block text-[11px] tracking-[0.2em] opacity-50 uppercase">Role title</label>
                <input
                  value={d.role}
                  onChange={(e) => setDrafts((s) => ({ ...s, [p.id]: { ...d, role: e.target.value } }))}
                  placeholder="e.g. Lead Developer Agent"
                  className="glass w-full rounded-xl px-3 py-2 text-sm outline-none"
                />
                <label className="mt-3 mb-1 block text-[11px] tracking-[0.2em] opacity-50 uppercase">System prompt</label>
                <textarea
                  value={d.systemPrompt}
                  onChange={(e) => setDrafts((s) => ({ ...s, [p.id]: { ...d, systemPrompt: e.target.value } }))}
                  rows={8}
                  placeholder="Blank = built-in default"
                  className="glass w-full rounded-xl px-3 py-2 font-mono text-xs leading-relaxed outline-none"
                />
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => save(p.id)}
                    disabled={!dirty || saving === p.id}
                    className="rounded-full bg-gradient-to-r from-[#ff6b1a] to-[#ff9a3d] px-4 py-1.5 text-xs font-bold text-white transition hover:scale-105 disabled:opacity-40"
                  >
                    {saving === p.id ? "saving…" : "Save ✓"}
                  </button>
                  {p.customized && (
                    <button onClick={() => reset(p.id)} disabled={saving === p.id} className="glass rounded-full px-4 py-1.5 text-xs disabled:opacity-40">
                      Reset
                    </button>
                  )}
                </div>
                {p.agents.length > 0 && (
                  <div className="mt-3 border-t border-white/10 pt-2 text-xs">
                    <span className="opacity-50">Agents on this platform: </span>
                    {p.agents.map((a, i) => (
                      <span key={a.id}>
                        <Link href={`/agents/${a.id}`} className="font-bold text-[#ff8c42] hover:underline">{a.name}</Link>
                        {i < p.agents.length - 1 && <span className="opacity-40"> · </span>}
                      </span>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Card>
        <SectionTitle kicker="personas" title="Agent personas" />
        <p className="text-sm opacity-60">
          Individual agent personas (name + personality + instructions) live on each agent — edit them from the{" "}
          <Link href="/agents" className="font-bold text-[#ff8c42] hover:underline">Agents page</Link>. At runtime the
          platform role above always frames the agent persona.
        </p>
      </Card>
    </div>
  );
}
