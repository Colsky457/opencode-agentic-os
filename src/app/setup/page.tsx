"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Card, Pill, SectionTitle } from "@/components/os/ui";
import { cn } from "@/lib/utils";

interface Provider {
  id: string;
  label: string;
  bin: string;
  installed: boolean;
  version: string | null;
  supported: boolean;
  installHint: string;
}

const STEPS = ["Providers", "Vault", "Server"] as const;

export default function SetupPage() {
  const [step, setStep] = useState(0);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [def, setDef] = useState("claude");
  const [bins, setBins] = useState<Record<string, string>>({});
  const [vault, setVault] = useState("~/brain");
  const [vaultOk, setVaultOk] = useState<string | null>(null);
  const [vaultErr, setVaultErr] = useState<string | null>(null);
  const [host, setHost] = useState("127.0.0.1");
  const [port, setPort] = useState("3000");
  const [portOk, setPortOk] = useState<boolean | null>(null);
  const [portErr, setPortErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [needsRestart, setNeedsRestart] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/setup/status")
      .then((r) => r.json())
      .then((d) => {
        setProviders(d.providers ?? []);
        if (d.config) {
          setVault(d.config.paths?.brain ?? "~/brain");
          setHost(d.config.server?.host ?? "127.0.0.1");
          setPort(String(d.config.server?.port ?? 3000));
          setDef(d.config.defaultProvider ?? "claude");
          setBins(d.config.bins ?? {});
        } else {
          const first = (d.providers ?? []).find((p: Provider) => p.installed && p.supported);
          if (first) setDef(first.id);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const checkVault = async () => {
    setVaultOk(null);
    setVaultErr(null);
    const r = await fetch("/api/setup/check-path", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: vault }),
    }).then((x) => x.json());
    if (r.ok) setVaultOk(r.resolved);
    else setVaultErr(r.error ?? "not writable");
  };

  const checkPort = async () => {
    setPortOk(null);
    setPortErr(null);
    const r = await fetch(`/api/setup/check-port?host=${encodeURIComponent(host)}&port=${encodeURIComponent(port)}`).then((x) => x.json());
    setPortOk(r.ok);
    if (!r.ok) setPortErr(r.error ?? "unavailable");
  };

  const finish = async () => {
    const enabled: Record<string, boolean> = {};
    for (const p of providers) enabled[p.id] = p.installed;
    const r = await fetch("/api/setup/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ defaultProvider: def, bins, enabled, vault, host, port: Number(port) }),
    }).then((x) => x.json());
    if (r.ok) {
      const loc = window.location;
      const sameOrigin = loc.hostname === host && String(Number(port)) === loc.port;
      setNeedsRestart(!sameOrigin);
      setDone(true);
      if (sameOrigin) setTimeout(() => (window.location.href = "/"), 1600);
    }
  };

  const installed = providers.filter((p) => p.installed);

  if (loading) return <div className="py-20 text-center opacity-60">detecting your machine…</div>;

  return (
    <div className="mx-auto max-w-2xl space-y-4 py-6">
      <div className="text-center">
        <div className="ring-conic mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-3xl p-[2px]">
          <div className="flex h-full w-full items-center justify-center rounded-3xl bg-[#0b0e1d] text-3xl">◈</div>
        </div>
        <div className="text-[10px] font-semibold tracking-[0.3em] text-[#ff8c42] uppercase">first run</div>
        <h1 className="font-display text-3xl font-black tracking-tight">
          Welcome to <span className="shimmer-text">AgenticOS</span>
        </h1>
        <p className="mt-1 text-sm opacity-60">Three steps and your mission control is live.</p>
      </div>

      {/* stepper */}
      <div className="flex gap-2">
        {STEPS.map((s, i) => (
          <button key={s} onClick={() => setStep(i)} className={cn("flex-1 rounded-full py-2 text-xs font-bold transition", i === step ? "bg-gradient-to-r from-[#ff6b1a] to-[#8b5cf6] text-white" : i < step ? "glass opacity-80" : "glass opacity-40")}>
            {i + 1}. {s}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.18 }}>
          {step === 0 && (
            <Card>
              <SectionTitle kicker="step 1" title="AI providers detected" right={<Pill tone="green">{installed.length} found</Pill>} />
              <div className="space-y-2">
                {providers.map((p) => (
                  <div key={p.id} className={cn("flex items-center gap-3 rounded-2xl border p-3", def === p.id && p.installed && p.supported ? "border-[#ff6b1a]/60 bg-[#ff6b1a]/8" : "border-white/10 bg-white/5")}>
                    <span className={cn("h-2.5 w-2.5 rounded-full", p.installed ? "bg-emerald-400" : "bg-white/20")} />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold">
                        {p.label} <span className="font-mono text-[11px] font-normal opacity-50">{p.bin}{p.version ? ` · ${p.version}` : ""}</span>
                      </div>
                      {!p.installed ? (
                        <div className="term mt-0.5 text-[11px] opacity-60">not found — <span className="text-[#22e6c8]">{p.installHint}</span></div>
                      ) : !p.supported ? (
                        <div className="text-[11px] opacity-60">detected — full support coming soon</div>
                      ) : (
                        <div className="text-[11px] opacity-60">ready to drive chats + agents</div>
                      )}
                    </div>
                    {p.installed && p.supported && (
                      <button onClick={() => setDef(p.id)} className={cn("rounded-full px-3.5 py-1.5 text-xs font-bold", def === p.id ? "bg-gradient-to-r from-[#ff6b1a] to-[#ff9a3d] text-white" : "glass")}>
                        {def === p.id ? "✓ default" : "use"}
                      </button>
                    )}
                  </div>
                ))}
                {providers.length === 0 && <div className="py-4 text-center text-sm opacity-50">no providers detected</div>}
              </div>
              {installed.length === 0 && (
                <div className="mt-3 rounded-2xl border border-amber-400/40 bg-amber-400/10 p-3 text-sm">
                  No AI CLI found. Install one (e.g. <span className="font-mono">npm install -g @anthropic-ai/claude-code</span>), then refresh — or continue and explore in demo mode.
                </div>
              )}
            </Card>
          )}

          {step === 1 && (
            <Card>
              <SectionTitle kicker="step 2" title="Second-brain vault" />
              <p className="mb-2 text-sm opacity-60">Chats, goals, and journal entries save here as markdown. Point it at your Obsidian vault or keep the default.</p>
              <div className="flex gap-2">
                <input value={vault} onChange={(e) => setVault(e.target.value)} placeholder="~/brain" className="glass flex-1 rounded-xl px-3 py-2 font-mono text-sm outline-none" />
                <button onClick={checkVault} className="glass rounded-xl px-4 py-2 text-sm font-bold">test ✎</button>
              </div>
              {vaultOk && <div className="mt-2 rounded-xl border border-emerald-400/40 bg-emerald-400/10 p-2.5 text-xs">✓ writable → <span className="font-mono">{vaultOk}/Agentic OS/</span></div>}
              {vaultErr && <div className="mt-2 rounded-xl border border-red-400/40 bg-red-400/10 p-2.5 text-xs">✗ {vaultErr}</div>}
            </Card>
          )}

          {step === 2 && (
            <Card>
              <SectionTitle kicker="step 3" title="Local server" />
              <div className="grid grid-cols-[1fr_120px] gap-2.5">
                <input value={host} onChange={(e) => setHost(e.target.value)} placeholder="127.0.0.1" className="glass rounded-xl px-3 py-2 font-mono text-sm outline-none" />
                <input value={port} onChange={(e) => setPort(e.target.value)} placeholder="3000" inputMode="numeric" className="glass rounded-xl px-3 py-2 font-mono text-sm outline-none" />
              </div>
              <button onClick={checkPort} className="glass mt-2.5 rounded-xl px-4 py-2 text-sm font-bold">check availability</button>
              {portOk && <div className="mt-2 rounded-xl border border-emerald-400/40 bg-emerald-400/10 p-2.5 text-xs">✓ {host}:{port} is free</div>}
              {portErr && <div className="mt-2 rounded-xl border border-red-400/40 bg-red-400/10 p-2.5 text-xs">✗ {portErr}</div>}
              <p className="mt-2 text-[11px] opacity-50">Keep 127.0.0.1 to stay localhost-only. Changing host/port after launch requires a server restart.</p>
            </Card>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="flex gap-2">
        {step > 0 && <button onClick={() => setStep(step - 1)} className="glass rounded-full px-5 py-2.5 text-sm font-bold">← back</button>}
        <div className="flex-1" />
        {step < 2 ? (
          <button onClick={() => setStep(step + 1)} className="glow-orange rounded-full bg-gradient-to-r from-[#ff6b1a] to-[#ff9a3d] px-6 py-2.5 text-sm font-bold text-white transition hover:scale-105">
            continue →
          </button>
        ) : done ? (
          <div className="glass rounded-full px-6 py-2.5 text-sm font-bold text-emerald-300">
            {needsRestart ? "✓ saved — restart server to apply" : "✓ launching…"}
          </div>
        ) : (
          <button onClick={finish} className="glow-orange rounded-full bg-gradient-to-r from-[#22e6c8] to-[#4da6ff] px-6 py-2.5 text-sm font-bold text-white transition hover:scale-105">
            ◈ launch mission control
          </button>
        )}
      </div>

      {done && needsRestart && (
        <div className="glass rounded-2xl p-4 text-sm">
          Config saved. Restart the server to bind the new address:
          <div className="term mt-2 rounded-xl bg-black/40 p-2.5">npm run dev <span className="opacity-50"># then open</span> http://{host}:{port}</div>
        </div>
      )}
    </div>
  );
}
