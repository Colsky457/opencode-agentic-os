"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Card, EmptyState, Pill, SectionTitle } from "@/components/os/ui";

/** Embedded external dashboard (Hermes Board / 9router) with live status + tab fallback. */
export function DashFrame({
  kicker,
  title,
  url,
  target,
  canControl = false,
  downHint,
  loginHint,
}: {
  kicker: string;
  title: string;
  url: string;
  target: "hermes" | "router";
  canControl?: boolean;
  downHint: string;
  loginHint?: string;
}) {
  const [up, setUp] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [nonce, setNonce] = useState(0);
  const [showLoginHint, setShowLoginHint] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const check = useCallback(async () => {
    try {
      const d = await fetch("/api/dashboards").then((r) => r.json());
      setUp(Boolean(d?.[target]?.up));
    } catch {
      setUp(false);
    }
  }, [target]);

  useEffect(() => {
    check();
  }, [check]);

  /* After iframe loads, wait 6s then surface a login-loop hint —
     if the user is still on the login page by then, they probably need the tab. */
  const onFrameLoad = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setShowLoginHint(false);
    timerRef.current = setTimeout(() => setShowLoginHint(true), 6000);
  };

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const control = async (action: "start" | "stop") => {
    if (busy) return;
    setBusy(true);
    try {
      await fetch("/api/dashboards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target, action }),
      });
    } catch {}
    setTimeout(() => {
      setBusy(false);
      check();
    }, 3000);
  };

  return (
    <Card className="overflow-hidden">
      <SectionTitle
        kicker={kicker}
        title={title}
        right={
          <span className="flex items-center gap-2">
            {up === null ? (
              <Pill tone="neutral">probing…</Pill>
            ) : up ? (
              <Pill tone="green">● live</Pill>
            ) : (
              <Pill tone="red">● down</Pill>
            )}
            <button onClick={() => { setNonce((n) => n + 1); setShowLoginHint(false); check(); }} title="Reload" className="glass rounded-full px-3 py-1 text-xs opacity-70 hover:opacity-100">
              ⟳
            </button>
            <a href={url} target="_blank" rel="noreferrer" className="glass rounded-full px-3 py-1 text-xs font-bold text-[#ff8c42] hover:underline">
              open ↗
            </a>
          </span>
        }
      />
      {up === null ? (
        <div className="py-10 text-center text-sm opacity-50">probing dashboard…</div>
      ) : up ? (
        <>
          <div className="relative">
            <iframe
              key={nonce}
              src={url}
              title={title}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-top-frame allow-downloads"
              className="h-[75dvh] w-full rounded-xl border border-white/10 bg-black/30"
              onLoad={onFrameLoad}
            />
            {showLoginHint && loginHint && (
              <div className="absolute inset-x-0 bottom-0 flex items-end justify-center pb-6 pt-20 bg-gradient-to-t from-black/80 via-black/40 to-transparent pointer-events-none">
                <div className="pointer-events-auto glass rounded-xl px-5 py-3 text-center space-y-2">
                  <p className="text-sm font-semibold text-white/90">{loginHint}</p>
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block rounded-full bg-gradient-to-r from-[#ff6b1a] to-[#ff9a3d] px-5 py-2 text-sm font-bold text-white hover:scale-105 transition"
                  >
                    open in a tab ↗
                  </a>
                </div>
              </div>
            )}
          </div>
          {canControl && (
            <button onClick={() => control("stop")} disabled={busy} className="mt-3 rounded-full border border-red-400/40 bg-red-400/10 px-4 py-1.5 text-xs font-bold text-red-300 hover:bg-red-400/20 disabled:opacity-50">
              {busy ? "working…" : "■ stop dashboard"}
            </button>
          )}
        </>
      ) : (
        <div>
          <EmptyState icon="🖥️" title="Dashboard is down" hint={downHint} />
          {canControl && (
            <button onClick={() => control("start")} disabled={busy} className="mx-auto mt-2 block rounded-full bg-gradient-to-r from-[#ff6b1a] to-[#ff9a3d] px-5 py-2 text-sm font-bold text-white transition hover:scale-105 disabled:opacity-50">
              {busy ? "starting…" : "▶ start dashboard"}
            </button>
          )}
        </div>
      )}
    </Card>
  );
}
