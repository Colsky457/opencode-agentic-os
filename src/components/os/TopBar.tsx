"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useTheme } from "next-themes";
import { useEffect } from "react";
import { APPS, useOs } from "@/lib/os-store";
import { cn } from "@/lib/utils";

export function TopBar() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const paletteOpen = useOs((s) => s.paletteOpen);
  const set = useOs((s) => s.set);
  const claudeVersion = useOs((s) => s.claudeVersion);
  const quotaError = useOs((s) => s.claudeQuotaError);
  const demoMode = useOs((s) => s.demoMode);
  const serverAddr = useOs((s) => s.serverAddr);

  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then((d) => {
        set({
          claudeVersion: d.claudeVersion ?? null,
          claudeQuotaError: d.lastError ?? null,
          serverAddr: d.server ? `${d.server.host}:${d.server.port}` : null,
        });
      })
      .catch(() => {});
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        set({ paletteOpen: !useOs.getState().paletteOpen });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [set]);

  return (
    <header className="glass sticky top-0 z-40 flex h-14 items-center gap-3 px-4">
      <div className="flex items-center gap-2.5">
        <div className="ring-conic rounded-xl p-[2px]">
          <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[#0b0e1d] text-lg dark:bg-[#0b0e1d]">
            ◈
          </div>
        </div>
        <div className="leading-tight">
          <div className="font-display text-sm font-bold tracking-tight">
            CLAUDE<span className="shimmer-text">OS</span>
          </div>
          <div className="text-[10px] tracking-[0.25em] text-current uppercase opacity-50">
            mission control
          </div>
        </div>
      </div>

      {/* Claude link status */}
      <div
        className={cn(
          "ml-2 hidden items-center gap-2 rounded-full border px-3 py-1 text-xs sm:flex",
          quotaError
            ? "border-amber-400/40 bg-amber-400/10"
            : "border-emerald-400/30 bg-emerald-400/10"
        )}
        title={quotaError ?? `Claude CLI ${claudeVersion ?? ""} connected`}
      >
        <span className="relative flex h-2 w-2">
          <AnimatePresence>
            {!quotaError && (
              <motion.span
                className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60"
                animate={{ scale: [1, 2.2, 1], opacity: [0.6, 0, 0.6] }}
                transition={{ repeat: Infinity, duration: 2 }}
              />
            )}
          </AnimatePresence>
          <span
            className={cn(
              "relative inline-flex h-2 w-2 rounded-full",
              quotaError ? "bg-amber-400" : "bg-emerald-400"
            )}
          />
        </span>
        <span className="opacity-80">
          {quotaError ? "quota exhausted" : `claude ${claudeVersion ?? "…"}`}
        </span>
      </div>

      <div className="flex-1" />

      {demoMode && (
        <span className="rounded-full border border-[#8b5cf6]/40 bg-[#8b5cf6]/15 px-3 py-1 text-xs text-[#b7a5ff]">
          demo mode
        </span>
      )}

      <button
        onClick={() => set({ paletteOpen: true })}
        className="glass hidden items-center gap-2 rounded-full px-3 py-1.5 text-xs opacity-80 transition hover:opacity-100 md:flex"
      >
        <span className="opacity-60">⌘K</span> command…
      </button>
      <button
        onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        className="glass rounded-full p-2 text-sm transition hover:scale-110"
        title={`Switch to ${resolvedTheme === "dark" ? "light" : "dark"} (current: ${theme})`}
      >
        {resolvedTheme === "dark" ? "☀" : "☾"}
      </button>
      <div className="hidden text-right text-[11px] leading-tight opacity-60 lg:block">
        <div>{new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</div>
        <div className="font-mono">LOCAL · {serverAddr ?? "…"}</div>
      </div>
    </header>
  );
}
