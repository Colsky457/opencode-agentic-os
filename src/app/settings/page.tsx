"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Card, Pill, SectionTitle } from "@/components/os/ui";
import { useOs } from "@/lib/os-store";

export default function SettingsPage() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const demoMode = useOs((s) => s.demoMode);
  const set = useOs((s) => s.set);
  const [status, setStatus] = useState<any>(null);
  const [setup, setSetup] = useState<any>(null);
  const [routing, setRouting] = useState<{ keywords: Record<string, string[]>; fallback: string; providers: { id: string; label: string; glyph: string }[] } | null>(null);
  const [routingMsg, setRoutingMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/status").then((r) => r.json()).then(setStatus).catch(() => {});
    fetch("/api/setup/status").then((r) => r.json()).then(setSetup).catch(() => {});
    fetch("/api/routing").then((r) => r.json()).then(setRouting).catch(() => {});
  }, []);

  const saveRouting = async () => {
    if (!routing) return;
    setRoutingMsg(null);
    const r = await fetch("/api/routing", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ keywords: routing.keywords, fallback: routing.fallback }),
    }).then((x) => x.json()).catch(() => null);
    if (r?.keywords) {
      setRouting({ keywords: r.keywords, fallback: r.fallback, providers: routing.providers });
      setRoutingMsg("✓ routing saved — applies to the next message.");
    } else {
      setRoutingMsg(`✗ ${r?.error ?? "save failed"}`);
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div>
        <div className="text-[10px] font-semibold tracking-[0.28em] text-[#ff8c42] uppercase">system</div>
        <h1 className="font-display text-2xl font-black tracking-tight sm:text-3xl">Settings</h1>
      </div>

      <Card>
        <SectionTitle kicker="link" title="Provider connection" />
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <span className="opacity-60">CLI binary:</span>
            <span className="font-mono">{status?.provider ?? "…"}</span>
            <span className="flex-1" />
            {status?.claudeVersion ? <Pill tone="green">● v{status.claudeVersion.match(/[\d.]+/)?.[0]}</Pill> : <Pill tone="red">offline</Pill>}
          </div>
          <div className="flex items-center gap-2">
            <span className="opacity-60">Mode:</span>
            <span>{status?.claudeConnected ? "non-interactive stream-json bridge" : "unreachable"}</span>
          </div>
          {status?.lastError && (
            <div className="rounded-xl border border-amber-400/40 bg-amber-400/10 p-3 text-[13px]">
              <b className="text-amber-300">Last error:</b> <span className="opacity-80">{String(status.lastError).slice(0, 220)}</span>
            </div>
          )}
          <p className="text-xs opacity-50">
            Requires the <span className="font-mono">claude</span> CLI logged in with quota.
            API errors (e.g. exhausted budget) surface inline in chat until resolved.
          </p>
        </div>
      </Card>

      <Card>
        <SectionTitle kicker="providers" title="AI providers" right={<a href="/setup" className="text-xs text-[#ff8c42] hover:underline">re-run setup ▸</a>} />
        <div className="space-y-1.5">
          {(setup?.providers ?? []).map((p: any) => (
            <div key={p.id} className="flex items-center gap-2.5 rounded-xl bg-white/5 px-3 py-2 text-sm">
              <span className={`h-2 w-2 rounded-full ${p.installed ? "bg-emerald-400" : "bg-white/20"}`} />
              <span className="font-bold">{p.label}</span>
              <span className="font-mono text-[11px] opacity-50">{p.bin}{p.version ? ` · ${p.version}` : ""}</span>
              <span className="flex-1" />
              {p.installed ? (p.supported ? <Pill tone="green">ready</Pill> : <Pill tone="violet">soon</Pill>) : <Pill tone="neutral">missing</Pill>}
            </div>
          ))}
          {!setup && <div className="py-2 text-center text-xs opacity-50">detecting…</div>}
        </div>
      </Card>

      <Card>
        <SectionTitle kicker="routing" title="Auto-routing keywords" />
        <p className="mb-2 text-xs opacity-50">
          Chat in <b>✨ Auto</b> mode scans for these words and picks a platform. First match wins. Edit comma-separated, then save.
        </p>
        {!routing ? (
          <div className="py-2 text-center text-xs opacity-50">loading…</div>
        ) : (
          <div className="space-y-2">
            {routing.providers.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="w-28 shrink-0 font-bold">{p.glyph} {p.label}</span>
                <input
                  value={(routing.keywords[p.id] ?? []).join(", ")}
                  onChange={(e) =>
                    setRouting({ ...routing, keywords: { ...routing.keywords, [p.id]: e.target.value.split(",").map((s) => s.trim()) } })
                  }
                  placeholder="comma, separated, keywords"
                  className="glass min-w-0 flex-1 rounded-xl px-3 py-1.5 text-xs outline-none"
                />
              </div>
            ))}
            <div className="flex items-center gap-2 text-sm">
              <span className="w-28 shrink-0 font-bold">Fallback</span>
              <select
                value={routing.fallback}
                onChange={(e) => setRouting({ ...routing, fallback: e.target.value })}
                className="glass rounded-xl bg-transparent px-3 py-1.5 text-xs outline-none"
              >
                {routing.providers.map((p) => (
                  <option key={p.id} value={p.id}>{p.glyph} {p.label}</option>
                ))}
              </select>
              <span className="flex-1" />
              <button onClick={saveRouting} className="rounded-full bg-gradient-to-r from-[#ff6b1a] to-[#ff9a3d] px-4 py-1.5 text-xs font-bold text-white">
                Save ✓
              </button>
            </div>
            {routingMsg && <div className="font-mono text-[11px] opacity-70">{routingMsg}</div>}
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle kicker="experience" title="Appearance & behavior" />
        <div className="space-y-3 text-sm">
          <div className="flex items-center gap-2">
            <span className="opacity-60">Theme</span>
            <span className="flex-1" />
            {(["dark", "light", "system"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition ${theme === t ? "bg-gradient-to-r from-[#ff6b1a] to-[#ff9a3d] text-white" : "glass"}`}
              >
                {t}{resolvedTheme === t ? " ●" : ""}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <div>
              <div className="font-bold">Demo mode {demoMode ? "on" : "off"}</div>
              <div className="text-xs opacity-50">Simulate the provider locally — zero quota burn, full UI tour.</div>
            </div>
            <span className="flex-1" />
            <button
              onClick={() => set({ demoMode: !demoMode })}
              className={`relative h-7 w-12 rounded-full transition ${demoMode ? "bg-gradient-to-r from-[#ff6b1a] to-[#8b5cf6]" : "bg-white/15"}`}
            >
              <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${demoMode ? "left-6" : "left-1"}`} />
            </button>
          </div>
        </div>
      </Card>

      <Card>
        <SectionTitle kicker="safety" title="Local hosting" />
        <ul className="list-disc space-y-1 pl-5 text-[13px] opacity-70">
          <li>Bound to <span className="font-mono">{status?.server ? `${status.server.host}:${status.server.port}` : "…"}</span> — LAN can't reach it unless you forward.</li>
          <li>Files API is jailed to <span className="font-mono">workspaces/</span>; <span className="font-mono">..</span> escapes return 403.</li>
          <li>Agents run as your user with <span className="font-mono">dontAsk</span> permissions — review tasks before deploying.</li>
          <li>All memory lives in <span className="font-mono">./data/*.json</span> on this machine. Nothing leaves except provider API calls.</li>
        </ul>
      </Card>
    </div>
  );
}
