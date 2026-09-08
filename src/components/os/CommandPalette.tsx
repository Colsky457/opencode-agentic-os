"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { APPS, useOs } from "@/lib/os-store";
import { AgentAvatar } from "@/components/os/AgentAvatar";
import { VoiceField } from "@/components/chat/VoiceField";

export function CommandPalette() {
  const open = useOs((s) => s.paletteOpen);
  const set = useOs((s) => s.set);
  const [q, setQ] = useState("");
  const [agents, setAgents] = useState<{ id: string; name: string; color: string; avatarSeed?: number }[]>([]);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    setQ("");
    fetch("/api/agents")
      .then((r) => r.json())
      .then((d) => setAgents(d.agents ?? []))
      .catch(() => {});
  }, [open ]);

  const results = useMemo(() => {
    const needle = q.toLowerCase();
    const appHits = APPS.filter((a) => a.name.toLowerCase().includes(needle)).map((a) => ({
      kind: "app" as const,
      label: a.name,
      sub: a.hint,
      icon: a.icon,
      run: () => {
        router.push(a.id === "command" ? "/" : `/${a.id}`);
        set({ paletteOpen: false, activeApp: a.id });
      },
    }));
    const agentHits = agents
      .filter((a) => a.name.toLowerCase().includes(needle))
      .map((a) => ({
        kind: "agent" as const,
        label: a.name,
        sub: "open agent section",
        icon: "⬢",
        agent: a,
        run: () => {
          set({ paletteOpen: false, activeAgentId: a.id });
          router.push(`/agents/${a.id}`);
        },
      }));
    const actions = [
      {
        kind: "action" as const,
        label: "New chat",
        sub: "open chat",
        icon: "✦",
        run: () => {
          set({ paletteOpen: false });
          router.push("/chat");
        },
      },
      {
        kind: "action" as const,
        label: "Toggle demo mode",
        sub: "simulate provider offline",
        icon: "◊",
        run: () => {
          set({ paletteOpen: false, demoMode: !useOs.getState().demoMode });
        },
      },
    ].filter((a) => !needle || a.label.toLowerCase().includes(needle));
    return [...appHits, ...agentHits, ...actions].slice(0, 9);
  }, [q, agents, router, set]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") set({ paletteOpen: false });
      if (e.key === "Enter" && results[0]) results[0].run();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, results, set]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[90] flex items-start justify-center bg-black/60 p-4 pt-[14vh] backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => set({ paletteOpen: false })}
        >
          <motion.div
            className="glass w-full max-w-lg overflow-hidden rounded-2xl"
            initial={{ scale: 0.94, y: -12, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.96, y: -8, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-white/10 px-1.5 py-1">
              <VoiceField value={q} onText={setQ} micSize={26}>
                <input
                  autoFocus
                  placeholder="Type a command, search — or dictate 🎙  (Enter ↵, Esc)"
                  className="w-full bg-transparent px-2.5 py-2.5 text-sm outline-none placeholder:text-white/30"
                />
              </VoiceField>
            </div>
            <div className="max-h-72 overflow-y-auto p-1.5">
              {results.map((r, i) => (
                <button
                  key={`${r.kind}-${r.label}`}
                  onClick={r.run}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition hover:bg-white/10"
                >
                  {"agent" in r && r.agent ? (
                    <AgentAvatar seed={r.agent.id} seedNum={r.agent.avatarSeed ?? 0} color={r.agent.color} name={r.agent.name} size={32} ring={false} />
                  ) : (
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/8 text-base">
                      {r.icon}
                    </span>
                  )}
                  <span className="flex-1">
                    <span className="block">{r.label}</span>
                    <span className="block text-xs opacity-50">{r.sub}</span>
                  </span>
                  {i === 0 && (
                    <span className="rounded-md bg-[#ff6b1a]/20 px-1.5 py-0.5 font-mono text-[10px] text-[#ffb27a]">
                      ↵
                    </span>
                  )}
                </button>
              ))}
              {results.length === 0 && (
                <div className="px-3 py-6 text-center text-sm opacity-50">no matches</div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
