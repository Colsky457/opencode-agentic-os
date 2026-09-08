"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Card, EmptyState, Pill, SectionTitle } from "@/components/os/ui";
import { cn } from "@/lib/utils";

interface ProviderOpt {
  id: string;
  label: string;
  glyph: string;
  color: string;
  streaming: boolean;
  installed: boolean;
}

interface Panel {
  provider: string;
  label: string;
  glyph: string;
  color: string;
  ok: boolean;
  text: string;
  error: string | null;
  usage: { input: number; output: number; cost: number; ms: number } | null;
}

interface Review {
  provider: string;
  label: string;
  glyph: string;
  color: string;
  mode: string;
  from: string;
  text: string;
}

export default function ArenaPage() {
  const [providers, setProviders] = useState<ProviderOpt[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [prompt, setPrompt] = useState("");
  const [running, setRunning] = useState(false);
  const [panels, setPanels] = useState<Panel[]>([]);
  const [review, setReview] = useState<Review | null>(null);
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [reviewMode, setReviewMode] = useState<"review" | "critique" | "debug">("review");

  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then((d) => {
        const list: ProviderOpt[] = (d.providers ?? []).filter((p: ProviderOpt) => p.installed);
        setProviders(list);
        setSelected(list.map((p) => p.id));
      })
      .catch(() => {});
  }, []);

  const toggle = (id: string) => {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  };

  const submit = async () => {
    if (!prompt.trim() || selected.length === 0 || running) return;
    setRunning(true);
    setPanels([]);
    setReview(null);
    try {
      const d = await fetch("/api/arena", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim(), providers: selected }),
      }).then((r) => r.json());
      if (d.error) alert(d.error);
      else setPanels(d.results ?? []);
    } catch {
      alert("arena run failed");
    } finally {
      setRunning(false);
    }
  };

  const crossReview = async (fromPanel: Panel, toId: string) => {
    if (reviewing) return;
    setReviewing(`${fromPanel.provider}->${toId}`);
    try {
      const d = await fetch("/api/arena/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          responseText: fromPanel.text,
          from: fromPanel.label,
          to: toId,
          mode: reviewMode,
        }),
      }).then((r) => r.json());
      if (d.error) alert(d.error);
      else setReview(d);
    } catch {
      alert("cross-review failed");
    } finally {
      setReviewing(null);
    }
  };

  const others = (p: Panel) => panels.filter((x) => x.provider !== p.provider && x.ok);

  return (
    <div className="space-y-4">
      <div>
        <div className="text-[10px] font-semibold tracking-[0.28em] text-[#ff8c42] uppercase">agent arena</div>
        <h1 className="font-display text-2xl font-black tracking-tight sm:text-3xl">Collaboration Workspace</h1>
      </div>

      <Card>
        <SectionTitle kicker="contenders" title="Select agents" />
        {providers.length === 0 ? (
          <div className="py-4 text-center text-sm opacity-50">detecting installed providers…</div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {providers.map((p) => {
              const on = selected.includes(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => toggle(p.id)}
                  className={cn(
                    "flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold transition",
                    on ? "text-white" : "opacity-55 hover:opacity-100"
                  )}
                  style={on ? { borderColor: `${p.color}88`, background: `${p.color}22` } : undefined}
                >
                  <span>{p.glyph}</span> {p.label}
                  {on && <span className="text-emerald-300">✓</span>}
                </button>
              );
            })}
          </div>
        )}
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          placeholder="One prompt for every selected agent…"
          className="glass mt-3 w-full rounded-xl px-3 py-2 text-sm outline-none"
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select
            value={reviewMode}
            onChange={(e) => setReviewMode(e.target.value as typeof reviewMode)}
            className="glass rounded-full bg-transparent px-3 py-2 text-xs outline-none"
            title="Cross-review mode"
          >
            <option value="review">🔍 Review</option>
            <option value="critique">⚔️ Critique</option>
            <option value="debug">🐛 Debug</option>
          </select>
          <div className="flex-1" />
          <button
            onClick={submit}
            disabled={running || !prompt.trim() || selected.length === 0}
            className="glow-orange rounded-full bg-gradient-to-r from-[#ff6b1a] to-[#ff9a3d] px-6 py-2 text-sm font-bold text-white transition hover:scale-105 disabled:opacity-40"
          >
            {running ? "⚔️ Battling…" : `⚔️ Send to ${selected.length} agent${selected.length === 1 ? "" : "s"}`}
          </button>
        </div>
      </Card>

      {running && panels.length === 0 && (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {selected.map((id) => {
            const p = providers.find((x) => x.id === id);
            return (
              <div key={id} className="glass animate-pulse rounded-2xl p-4">
                <div className="flex items-center gap-2 text-sm font-bold">
                  <span>{p?.glyph}</span> {p?.label ?? id}
                </div>
                <div className="mt-2 text-xs opacity-50">thinking…</div>
              </div>
            );
          })}
        </div>
      )}

      {panels.length > 0 && (
        <div className="grid items-start gap-3 md:grid-cols-2 xl:grid-cols-3">
          {panels.map((p, i) => (
            <motion.div
              key={p.provider}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.06, 0.3) }}
              className="glass overflow-hidden rounded-2xl"
              style={{ borderTop: `3px solid ${p.color}` }}
            >
              <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2.5">
                <span className="text-lg">{p.glyph}</span>
                <span className="font-display text-sm font-bold">{p.label}</span>
                <div className="flex-1" />
                <Pill tone={p.ok ? "green" : "red"}>{p.ok ? "answered" : "error"}</Pill>
              </div>
              <div className="max-h-80 overflow-y-auto px-4 py-3 text-sm leading-relaxed break-words whitespace-pre-wrap">
                {p.ok ? p.text : <span className="text-red-300">{p.error}</span>}
              </div>
              {p.ok && (
                <div className="border-t border-white/10 px-4 py-2.5">
                  <div className="text-[11px] opacity-50">
                    ⚡ {p.usage ? `${p.usage.input}+${p.usage.output} tok · $${p.usage.cost.toFixed(4)} · ${(p.usage.ms / 1000).toFixed(1)}s` : "no usage"}
                  </div>
                  {others(p).length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <span className="text-[11px] opacity-50">Cross-review by:</span>
                      {others(p).map((o) => (
                        <button
                          key={o.provider}
                          onClick={() => crossReview(p, o.provider)}
                          disabled={reviewing !== null}
                          className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold transition hover:scale-105 hover:bg-white/20 disabled:opacity-40"
                        >
                          {reviewing === `${p.provider}->${o.provider}` ? "…" : `${o.glyph} ${o.label}`}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {review && (
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <SectionTitle
              kicker={`${review.mode} · ${review.from} → ${review.label}`}
              title={`Cross-Review ${review.glyph}`}
            />
            <div className="max-h-96 overflow-y-auto text-sm leading-relaxed break-words whitespace-pre-wrap">{review.text}</div>
          </Card>
        </motion.div>
      )}

      {panels.length === 0 && !running && (
        <EmptyState icon="⚔️" title="Arena is quiet" hint="Pick two or more agents above, write one prompt, and watch them answer side by side." />
      )}
    </div>
  );
}
