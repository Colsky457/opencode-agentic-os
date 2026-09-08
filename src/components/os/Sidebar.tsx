"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { APPS, type AppId, useOs } from "@/lib/os-store";
import { cn } from "@/lib/utils";

const ROUTES: Record<AppId, string> = {
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

export function Sidebar() {
  const pathname = usePathname();
  const set = useOs((s) => s.set);

  return (
    <nav className="glass fixed bottom-3 left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-2xl p-1.5 md:top-1/2 md:right-3 md:bottom-auto md:left-auto md:translate-x-0 md:-translate-y-1/2 md:flex-col">
      {APPS.map((app) => {
        const route = ROUTES[app.id];
        const active = app.id === "command" ? pathname === "/" : pathname.startsWith(route);
        return (
          <Link
            key={app.id}
            href={route}
            onClick={() => set({ activeApp: app.id })}
            title={`${app.name} — ${app.hint}`}
            className={cn(
              "group relative flex h-11 w-11 items-center justify-center rounded-xl text-lg transition",
              active ? "text-white" : "opacity-55 hover:scale-110 hover:opacity-100"
            )}
          >
            {active && (
              <motion.span
                layoutId="dock-active"
                className="ring-conic absolute inset-0 rounded-xl p-[2px]"
                transition={{ type: "spring", stiffness: 400, damping: 32 }}
              >
                <span className="flex h-full w-full items-center justify-center rounded-[10px] bg-[#0b0e1d] text-lg">
                  {app.icon}
                </span>
              </motion.span>
            )}
            {!active && <span>{app.icon}</span>}
            <span className="pointer-events-none absolute bottom-full left-1/2 mb-2 hidden -translate-x-1/2 rounded-lg bg-black/85 px-2 py-1 text-[11px] whitespace-nowrap text-white group-hover:block md:bottom-auto md:top-1/2 md:right-full md:bottom-auto md:left-auto md:mr-2 md:mb-0 md:-translate-y-1/2 md:translate-x-0">
              {app.name}
            </span>
            {active && <span className="absolute -bottom-0.5 h-1 w-1 rounded-full bg-[#ff6b1a]" />}
          </Link>
        );
      })}
    </nav>
  );
}
