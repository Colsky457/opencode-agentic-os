"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { APPS, type AppId, useOs } from "@/lib/os-store";
import { cn } from "@/lib/utils";

export const ROUTES: Record<AppId, string> = {
  command: "/",
  chat: "/chat",
  agents: "/agents",
  personas: "/personas",
  arena: "/arena",
  automations: "/automations",
  tools: "/tools",
  tasks: "/tasks",
  vault: "/vault",
  system: "/system",
  goals: "/goals",
  journal: "/journal",
  graph: "/graph",
  prompts: "/prompts",
  files: "/files",
  usage: "/usage",
  guide: "/guide",
  digest: "/digest",
  settings: "/settings",
};

/** Slide-over navigation opened from the TopBar logo. All apps, nothing hidden. */
export function NavDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const set = useOs((s) => s.set);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60"
          />
          <motion.aside
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 34 }}
            className="glass absolute top-0 left-0 flex h-full w-[84vw] max-w-[320px] flex-col border-r border-white/10 p-4"
          >
            <div className="mb-3 flex items-center gap-2.5">
              <div className="ring-conic rounded-xl p-[2px]">
                <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[#0b0e1d] text-lg">◈</div>
              </div>
              <div className="min-w-0 flex-1 leading-tight">
                <div className="font-display text-sm font-bold tracking-tight">
                  AGENTIC<span className="shimmer-text">OS</span>
                </div>
                <div className="text-[10px] tracking-[0.25em] uppercase opacity-50">navigate</div>
              </div>
              <button onClick={onClose} aria-label="Close navigation" className="glass flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm opacity-70 hover:opacity-100">
                ✕
              </button>
            </div>
            <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto">
              {APPS.map((app) => {
                const route = ROUTES[app.id];
                const active = app.id === "command" ? pathname === "/" : pathname.startsWith(route);
                return (
                  <Link
                    key={app.id}
                    href={route}
                    onClick={() => {
                      set({ activeApp: app.id });
                      onClose();
                    }}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 transition",
                      active ? "bg-[#ff6b1a]/15 text-white" : "opacity-70 hover:bg-white/8 hover:opacity-100"
                    )}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/8 text-lg">
                      {app.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">{app.name}</span>
                      <span className="block truncate text-[11px] opacity-50">{app.hint}</span>
                    </span>
                    {active && <span className="h-2 w-2 shrink-0 rounded-full bg-[#ff6b1a]" />}
                  </Link>
                );
              })}
            </nav>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}
