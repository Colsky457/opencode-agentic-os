"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, Pill, SectionTitle } from "@/components/os/ui";

interface DigestStatus {
  date: string;
  digest: { enabled: boolean; time: string; noteDir: string } | null;
  cron: { list: string; status: string; runs: string; hasJob: boolean; schedulerUp: boolean };
  today: any | null;
  last: any | null;
  history: any[];
}

function plainTime(t?: string): string {
  if (!t || !/^\d{1,2}:\d{2}$/.test(t)) return "8:00 PM daily";
  const [h, m] = t.split(":").map(Number);
  const ap = h >= 12 ? "PM" : "AM";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${hh}:${String(m).padStart(2, "0")} ${ap} daily`;
}

export default function DigestPage() {
  const [data, setData] = useState<DigestStatus | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const refresh = useCallback(() => {
    fetch("/api/digest/status").then((r) => r.json()).then(setData).catch(() => {});
  }, []);
  useEffect(refresh, [refresh]);

  const act = async (kind: "run" | "cron" | "install", action?: string) => {
    setBusy(kind + (action ?? ""));
    setMsg(null);
    try {
      const url = kind === "run" ? "/api/digest/run" : kind === "install" ? "/api/digest/install" : "/api/digest/cron";
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action ? { action } : {}),
      }).then((x) => x.json());
      if (kind === "run") {
        setMsg(r.ok ? `🌙 Note written via ${r.provider}${r.fallback ? " (Claude fallback)" : ""} → ${r.notePath}` : `✗ ${r.error ?? "digest failed"}`);
      } else if (kind === "install") {
        setMsg(r.ok ? `✓ ${(r.steps ?? []).join(" · ")}` : `✗ ${r.error ?? "install failed"}`);
      } else {
        setMsg(r.ok ? `✓ ${action} ok` : `✗ ${(r.out ?? r.error ?? "").slice(0, 200)}`);
      }
    } catch (e) {
      setMsg(`✗ ${e instanceof Error ? e.message : "request failed"}`);
    } finally {
      setBusy(null);
      refresh();
    }
  };

  const time = data?.digest?.time ?? "20:00";

  return (
    <div className="space-y-4">
      <div>
        <div className="text-[10px] font-semibold tracking-[0.28em] text-[#ff8c42] uppercase">schedule</div>
        <h1 className="font-display text-2xl font-black tracking-tight sm:text-3xl">Nightly Digest 🌙</h1>
        <p className="mt-1 text-sm opacity-60">
          Every day at {plainTime(time)}, Hermes reads your chats, goals, and journal and writes one note to your vault.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle kicker="tonight" title="Today's note" />
          {data?.today?.ok ? (
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Pill tone="green">written</Pill>
                <Pill tone={data.today.fallback ? "amber" : "violet"}>
                  {data.today.fallback ? "via Claude (fallback)" : "via ☿ Hermes"}
                </Pill>
              </div>
              <div className="font-mono text-xs opacity-70">{data.today.notePath}</div>
              <div className="text-xs opacity-50">
                {data.today.attempts} attempt(s) · {data.today.inputTokens}+{data.today.outputTokens} tokens · ${Number(data.today.costUsd).toFixed(4)}
              </div>
            </div>
          ) : (
            <div className="text-sm opacity-60">
              No note yet today — it lands automatically at {plainTime(time)}, or run it now below.
            </div>
          )}
          <button
            onClick={() => act("run")}
            disabled={busy === "run"}
            className="glow-orange mt-3 rounded-full bg-gradient-to-r from-[#ff6b1a] to-[#ff9a3d] px-5 py-2 text-sm font-bold text-white transition hover:scale-105 disabled:opacity-40"
          >
            {busy === "run" ? "✍️ Hermes is writing… (up to a few min)" : "▶ Run now"}
          </button>
          {msg && <div className="mt-2 font-mono text-[11px] opacity-80">{msg}</div>}
        </Card>

        <Card>
          <SectionTitle kicker="alarm clock" title="Hermes cron job" />
          {!data ? (
            <div className="text-sm opacity-50">loading…</div>
          ) : !data.cron.hasJob ? (
            <div className="space-y-2 text-sm">
              <div className="opacity-60">No <span className="font-mono">agentic-digest</span> job installed in Hermes yet.</div>
              <button
                onClick={() => act("install")}
                disabled={busy === "install"}
                className="rounded-full bg-gradient-to-r from-[#22e6c8] to-[#4da6ff] px-5 py-2 text-sm font-bold text-white transition hover:scale-105 disabled:opacity-40"
              >
                {busy === "install" ? "installing…" : "⏰ Install 8pm schedule"}
              </button>
            </div>
          ) : (
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Pill tone={data.cron.schedulerUp ? "green" : "red"}>
                  {data.cron.schedulerUp ? "● scheduler up" : "● scheduler down"}
                </Pill>
                <span className="font-mono text-xs opacity-70">agentic-digest · {plainTime(time)}</span>
              </div>
              <details className="rounded-xl bg-black/30 p-2.5 text-[11px]">
                <summary className="cursor-pointer opacity-60">cron list</summary>
                <pre className="term mt-1 whitespace-pre-wrap opacity-80">{data.cron.list || "(empty)"}</pre>
              </details>
              <details className="rounded-xl bg-black/30 p-2.5 text-[11px]">
                <summary className="cursor-pointer opacity-60">recent runs</summary>
                <pre className="term mt-1 whitespace-pre-wrap opacity-80">{data.cron.runs || "(none yet)"}</pre>
              </details>
              <div className="flex gap-2">
                <button onClick={() => act("cron", "run")} disabled={!!busy} className="glass rounded-full px-4 py-1.5 text-xs font-bold disabled:opacity-40">fire now</button>
                <button onClick={() => act("cron", "pause")} disabled={!!busy} className="glass rounded-full px-4 py-1.5 text-xs font-bold disabled:opacity-40">pause</button>
                <button onClick={() => act("cron", "resume")} disabled={!!busy} className="glass rounded-full px-4 py-1.5 text-xs font-bold disabled:opacity-40">resume</button>
              </div>
            </div>
          )}
        </Card>
      </div>

      <Card>
        <SectionTitle kicker="archive" title="Recent digests" />
        <div className="space-y-1.5">
          {(data?.history ?? []).map((r: any) => (
            <div key={r.date + r.ts} className="flex flex-wrap items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-xs">
              <Pill tone={r.ok ? "green" : "red"}>{r.ok ? "ok" : "err"}</Pill>
              <span className="font-mono opacity-70">{r.date}</span>
              <span className="opacity-60">{r.fallback ? "via Claude (fallback)" : `via ${r.provider}`}</span>
              <span className="ml-auto font-mono opacity-60">{r.attempts} tries · {r.inputTokens + r.outputTokens} tok</span>
            </div>
          ))}
          {(data?.history ?? []).length === 0 && <div className="py-4 text-center text-sm opacity-50">no digests yet — tonight at {plainTime(time)} 🌙</div>}
        </div>
      </Card>
    </div>
  );
}
