"use client";

import { motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import { Card, EmptyState, Pill, SectionTitle } from "@/components/os/ui";
import { cn } from "@/lib/utils";

type Level = "allow" | "ask" | "disabled" | "inherit";

interface Tool {
  id: string;
  label: string;
  kind: string;
  detail: string;
  def: Exclude<Level, "inherit">;
  overrides: Record<string, Exclude<Level, "inherit">>;
}

interface Approval {
  id: string;
  tool: string;
  agentId: string | null;
  summary: string;
  status: "pending" | "approved" | "denied";
  createdAt: number;
}

const LEVEL_STYLE: Record<Exclude<Level, "inherit">, string> = {
  allow: "bg-emerald-400/15 text-emerald-300 border-emerald-400/40",
  ask: "bg-amber-400/15 text-amber-300 border-amber-400/40",
  disabled: "bg-red-400/15 text-red-300 border-red-400/40",
};

function LevelSeg({ value, onPick, compact }: { value: Exclude<Level, "inherit">; onPick: (l: Level) => void; compact?: boolean }) {
  const opts: Exclude<Level, "inherit">[] = ["allow", "ask", "disabled"];
  return (
    <div className="flex gap-1">
      {opts.map((l) => (
        <button
          key={l}
          onClick={() => onPick(l)}
          title={l === "allow" ? "Always allow" : l === "ask" ? "Ask before running" : "Disabled"}
          className={cn(
            "rounded-full border px-2.5 py-1 font-bold transition",
            compact ? "text-[10px]" : "text-[11px]",
            value === l ? LEVEL_STYLE[l] : "border-white/10 opacity-45 hover:opacity-100"
          )}
        >
          {l === "allow" ? "✓ Allow" : l === "ask" ? "? Ask" : "✕ Off"}
        </button>
      ))}
    </div>
  );
}

export default function ToolsPage() {
  const [tools, setTools] = useState<Tool[]>([]);
  const [agents, setAgents] = useState<{ id: string; name: string }[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [agentFilter, setAgentFilter] = useState<string>("");

  const refresh = useCallback(async () => {
    const d = await fetch("/api/tools").then((r) => r.json()).catch(() => null);
    if (!d) return;
    setTools(d.tools ?? []);
    setAgents(d.agents ?? []);
    setApprovals(d.approvals ?? []);
  }, []);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, [refresh]);

  const setLevel = async (tool: string, level: Level, agentId?: string) => {
    await fetch("/api/tools", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tool, level, agentId }),
    });
    refresh();
  };

  const decide = async (id: string, decision: "approve" | "deny") => {
    await fetch("/api/tools", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, decision }),
    });
    refresh();
  };

  const pending = approvals.filter((a) => a.status === "pending");
  const agentName = (id: string | null) => (id ? (agents.find((a) => a.id === id)?.name ?? "deleted agent") : "global");
  const toolLabel = (id: string) => tools.find((t) => t.id === id)?.label ?? id;

  return (
    <div className="space-y-4">
      <div>
        <div className="text-[10px] font-semibold tracking-[0.28em] text-[#ff8c42] uppercase">tool registry</div>
        <h1 className="font-display text-2xl font-black tracking-tight sm:text-3xl">Tools & Permissions</h1>
        <p className="mt-1 max-w-2xl text-sm opacity-60">
          Gate what agents may run. <b>Allow</b> runs free, <b>Ask</b> parks one single-use request for your approval,{" "}
          <b>Off</b> blocks with a clear error. Stopping fleet processes is always allowed.
        </p>
      </div>

      {pending.length > 0 && (
        <Card>
          <SectionTitle kicker="inbox" title={`Pending approvals (${pending.length})`} />
          <div className="space-y-2">
            {pending.map((a) => (
              <motion.div key={a.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-center gap-2 rounded-xl border border-amber-400/40 bg-amber-400/10 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold">
                    {toolLabel(a.tool)} <span className="font-normal opacity-60">· {agentName(a.agentId)}</span>
                  </div>
                  <div className="truncate font-mono text-[11px] opacity-60" title={a.summary}>{a.summary}</div>
                </div>
                <button onClick={() => decide(a.id, "approve")} className="rounded-full bg-emerald-500/80 px-4 py-1.5 text-xs font-bold text-white hover:bg-emerald-500">
                  Approve once ✓
                </button>
                <button onClick={() => decide(a.id, "deny")} className="rounded-full bg-red-500/80 px-4 py-1.5 text-xs font-bold text-white hover:bg-red-500">
                  Deny
                </button>
              </motion.div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <SectionTitle kicker="global" title="Default levels" right={<span className="text-xs opacity-50">{tools.length} tools</span>} />
        {tools.length === 0 ? (
          <div className="py-4 text-center text-sm opacity-50">loading registry…</div>
        ) : (
          <div className="space-y-2">
            {tools.map((t) => (
              <div key={t.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-white/5 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold break-words">
                    {t.label} <span className="font-mono text-[10px] font-normal opacity-40">{t.id}</span>
                  </div>
                  <div className="truncate text-[11px] opacity-50">{t.detail}</div>
                </div>
                <LevelSeg value={t.def} onPick={(l) => setLevel(t.id, l)} />
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle kicker="per agent" title="Agent overrides" />
        <div className="mb-2 flex gap-2">
          <select value={agentFilter} onChange={(e) => setAgentFilter(e.target.value)} className="glass rounded-full bg-transparent px-3 py-1.5 text-xs outline-none">
            <option value="">All agents</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
        {agents.filter((a) => !agentFilter || a.id === agentFilter).map((a) => (
          <div key={a.id} className="mb-2 rounded-xl bg-white/5 px-3 py-2.5">
            <div className="mb-1.5 text-sm font-bold">{a.name}</div>
            <div className="space-y-1.5">
              {tools.map((t) => {
                const eff: string = t.overrides[a.id] ?? "inherit";
                return (
                  <div key={t.id} className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="min-w-0 flex-1 truncate opacity-70">{t.label}</span>
                    {(["inherit", "allow", "ask", "disabled"] as Level[]).map((l) => (
                      <button
                        key={l}
                        onClick={() => setLevel(t.id, l, a.id)}
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-[10px] font-bold transition",
                          eff === l
                            ? l === "inherit"
                              ? "border-white/40 bg-white/10"
                              : l === "allow" || l === "ask" || l === "disabled"
                                ? LEVEL_STYLE[l]
                                : "border-white/40 bg-white/10"
                            : "border-white/10 opacity-45 hover:opacity-100"
                        )}
                      >
                        {l === "inherit" ? "↩ global" : l === "allow" ? "✓" : l === "ask" ? "?" : "✕"}
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        {agents.length === 0 && <EmptyState icon="⬢" title="No agents" hint="Commission an agent first, then fine-tune its tools here." />}
      </Card>

      {approvals.filter((a) => a.status !== "pending").length > 0 && (
        <Card>
          <SectionTitle kicker="ledger" title="Recent decisions" />
          <div className="space-y-1.5">
            {approvals.filter((a) => a.status !== "pending").slice(0, 10).map((a) => (
              <div key={a.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-white/5 px-3 py-1.5 text-xs">
                <Pill tone={a.status === "approved" ? "green" : "red"}>{a.status}</Pill>
                <span className="font-bold">{toolLabel(a.tool)}</span>
                <span className="opacity-50">· {agentName(a.agentId)}</span>
                <span className="ml-auto opacity-40">{new Date(a.createdAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
