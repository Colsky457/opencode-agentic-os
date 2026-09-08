"use client";

import { motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { Card, EmptyState, Pill, SectionTitle } from "@/components/os/ui";
import { cn } from "@/lib/utils";

interface Step {
  id: string;
  label: string;
  prompt: string;
  sensitive: boolean;
  done: boolean;
  ok: boolean | null;
}

interface Task {
  id: string;
  title: string;
  agentId: string | null;
  provider: string;
  steps: Step[];
  status: "todo" | "in_progress" | "awaiting_approval" | "completed" | "failed";
  currentStep: number;
  pendingStep: number | null;
  requiresApproval: boolean;
  error: string | null;
  progress: number;
}

interface AgentOpt {
  id: string;
  name: string;
  provider: string;
}

const COLUMNS = [
  { id: "todo", label: "To Do", icon: "📋" },
  { id: "in_progress", label: "In Progress", icon: "⚙️" },
  { id: "awaiting_approval", label: "Awaiting Approval", icon: "✋" },
  { id: "completed", label: "Completed", icon: "✅" },
] as const;

const STATUS_TONE: Record<string, "green" | "neutral" | "amber" | "red" | "violet"> = {
  todo: "neutral",
  in_progress: "violet",
  awaiting_approval: "amber",
  completed: "green",
  failed: "red",
};

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [agents, setAgents] = useState<AgentOpt[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ title: "", agentId: "", steps: "", requiresApproval: false });
  const [openLog, setOpenLog] = useState<string | null>(null);
  const [logs, setLogs] = useState<Record<string, string>>({});
  const logTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    const d = await fetch("/api/tasks").then((r) => r.json()).catch(() => null);
    if (d?.tasks) setTasks(d.tasks);
  }, []);

  useEffect(() => {
    refresh();
    fetch("/api/agents")
      .then((r) => r.json())
      .then((d) => setAgents((d.agents ?? []).map((a: any) => ({ id: a.id, name: a.name, provider: a.provider }))))
      .catch(() => {});
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
  }, [refresh]);

  // live log polling for the open task while it is active
  useEffect(() => {
    if (logTimer.current) clearInterval(logTimer.current);
    if (!openLog) return;
    const pull = async () => {
      const d = await fetch(`/api/tasks?log=${openLog}`).then((r) => r.json()).catch(() => null);
      if (d?.log !== undefined) setLogs((l) => ({ ...l, [openLog]: d.log }));
    };
    pull();
    logTimer.current = setInterval(pull, 2000);
    return () => {
      if (logTimer.current) clearInterval(logTimer.current);
    };
  }, [openLog]);

  const create = async () => {
    const r = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.title,
        agentId: form.agentId || undefined,
        steps: form.steps,
        requiresApproval: form.requiresApproval,
      }),
    }).then((x) => x.json());
    if (r.error) {
      alert(r.error);
      return;
    }
    setForm({ title: "", agentId: "", steps: "", requiresApproval: false });
    setShowNew(false);
    refresh();
  };

  const move = async (id: string, status: string) => {
    await fetch("/api/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    refresh();
  };

  const approve = async (id: string) => {
    const r = await fetch("/api/tasks/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }).then((x) => x.json());
    if (r.error) alert(r.error);
    refresh();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this task?")) return;
    await fetch(`/api/tasks?id=${id}`, { method: "DELETE" });
    if (openLog === id) setOpenLog(null);
    refresh();
  };

  const agentName = (id: string | null) => agents.find((a) => a.id === id)?.name ?? "no agent";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div>
          <div className="text-[10px] font-semibold tracking-[0.28em] text-[#ff8c42] uppercase">task queue</div>
          <h1 className="font-display text-2xl font-black tracking-tight sm:text-3xl">
            Task Queue{" "}
            <span className="text-base font-normal opacity-50">
              · {tasks.filter((t) => t.status === "in_progress").length} active
            </span>
          </h1>
        </div>
        <div className="flex-1" />
        <button
          onClick={() => setShowNew((s) => !s)}
          className="glow-orange rounded-full bg-gradient-to-r from-[#ff6b1a] to-[#ff9a3d] px-4 py-2 text-sm font-bold text-white transition hover:scale-105"
        >
          + New task
        </button>
      </div>

      {showNew && (
        <Card>
          <SectionTitle kicker="queue" title="Create background task" />
          <div className="grid gap-2.5 sm:grid-cols-2">
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Task title (e.g. Refactor auth module)"
              className="glass rounded-xl px-3 py-2 text-sm outline-none"
            />
            <select
              value={form.agentId}
              onChange={(e) => setForm({ ...form, agentId: e.target.value })}
              className="glass rounded-xl bg-transparent px-3 py-2 text-sm outline-none"
            >
              <option value="">No agent (default provider)</option>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} · {a.provider}
                </option>
              ))}
            </select>
          </div>
          <textarea
            value={form.steps}
            onChange={(e) => setForm({ ...form, steps: e.target.value })}
            rows={4}
            placeholder={"One step per line. Prefix with ! for sensitive steps needing approval:\nPlan the refactor\n!Run the test suite\nWrite docs"}
            className="glass mt-2.5 w-full rounded-xl px-3 py-2 font-mono text-xs outline-none"
          />
          <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs opacity-70">
            <input
              type="checkbox"
              checked={form.requiresApproval}
              onChange={(e) => setForm({ ...form, requiresApproval: e.target.checked })}
              className="accent-[#ff6b1a]"
            />
            Require approval before the first step runs
          </label>
          <div className="mt-3 flex gap-2">
            <button onClick={create} className="rounded-full bg-gradient-to-r from-[#ff6b1a] to-[#ff9a3d] px-5 py-2 text-sm font-bold text-white">
              Queue + start ▶
            </button>
            <button onClick={() => setShowNew(false)} className="glass rounded-full px-4 py-2 text-sm">
              cancel
            </button>
          </div>
        </Card>
      )}

      {tasks.length === 0 && !showNew ? (
        <EmptyState icon="📋" title="Queue is empty" hint="Queue a multi-step background task above — prefix sensitive steps with ! to gate them behind approval." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {COLUMNS.map((col) => {
            const items = tasks.filter((t) =>
              col.id === "completed" ? t.status === "completed" : t.status === col.id
            );
            const failed = col.id === "todo" ? tasks.filter((t) => t.status === "failed") : [];
            return (
              <div key={col.id} className="glass rounded-2xl p-3">
                <div className="mb-2 flex items-center gap-2 px-1">
                  <span className="text-base">{col.icon}</span>
                  <span className="font-display text-sm font-bold">{col.label}</span>
                  <span className="ml-auto rounded-full bg-white/10 px-2 py-0.5 text-[11px] opacity-70">
                    {items.length + failed.length}
                  </span>
                </div>
                <div className="max-h-[60vh] space-y-2 overflow-y-auto">
                  {failed.map((t) => (
                    <TaskCard
                      key={t.id}
                      task={{ ...t, status: "failed" }}
                      agentName={agentName(t.agentId)}
                      openLog={openLog}
                      log={logs[t.id]}
                      onOpenLog={setOpenLog}
                      onMove={move}
                      onApprove={approve}
                      onRemove={remove}
                    />
                  ))}
                  {items.map((t) => (
                    <TaskCard
                      key={t.id}
                      task={t}
                      agentName={agentName(t.agentId)}
                      openLog={openLog}
                      log={logs[t.id]}
                      onOpenLog={setOpenLog}
                      onMove={move}
                      onApprove={approve}
                      onRemove={remove}
                    />
                  ))}
                  {items.length + failed.length === 0 && (
                    <div className="rounded-xl border border-dashed border-white/10 px-3 py-5 text-center text-xs opacity-40">
                      drop here
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TaskCard({
  task,
  agentName,
  openLog,
  log,
  onOpenLog,
  onMove,
  onApprove,
  onRemove,
}: {
  task: Task;
  agentName: string;
  openLog: string | null;
  log?: string;
  onOpenLog: (id: string | null) => void;
  onMove: (id: string, status: string) => void;
  onApprove: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const pct = Math.round((task.progress ?? 0) * 100);
  const pending = task.status === "awaiting_approval" && task.pendingStep != null ? task.steps[task.pendingStep] : null;
  return (
    <motion.div layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl bg-white/5 p-3">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold">{task.title}</div>
          <div className="truncate text-[11px] opacity-50">
            {agentName} · {task.provider}
          </div>
        </div>
        <Pill tone={STATUS_TONE[task.status] ?? "neutral"}>
          {task.status === "in_progress" ? `${pct}%` : task.status.replace("_", " ")}
        </Pill>
      </div>

      {/* progress bar */}
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-[#ff6b1a] to-[#8b5cf6]"
          animate={{ width: `${pct}%` }}
          transition={{ type: "spring", stiffness: 90, damping: 20 }}
        />
      </div>

      {/* steps */}
      <div className="mt-2 space-y-1">
        {task.steps.map((s, i) => (
          <div key={s.id} className="flex items-center gap-1.5 text-[11px]">
            <span
              className={cn(
                "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[9px]",
                s.done ? (s.ok === false ? "border-red-400 bg-red-400/20 text-red-300" : "border-emerald-400 bg-emerald-400/20 text-emerald-300") : i === task.currentStep && task.status === "in_progress" ? "border-[#ff6b1a] text-[#ff8c42]" : "border-white/20 opacity-50"
              )}
            >
              {s.done ? (s.ok === false ? "✕" : "✓") : i + 1}
            </span>
            <span className={cn("min-w-0 flex-1 truncate", s.done && "opacity-50 line-through")}>{s.label}</span>
            {s.sensitive && <span title="Requires approval">🔒</span>}
          </div>
        ))}
      </div>

      {task.status === "awaiting_approval" && (
        <div className="mt-2 rounded-lg border border-amber-400/40 bg-amber-400/10 p-2 text-[11px]">
          <div className="font-bold text-amber-300">✋ Approval needed</div>
          {pending && <div className="mt-0.5 opacity-80">Step {task.currentStep + 1}: “{pending.label}”</div>}
          <button
            onClick={() => onApprove(task.id)}
            className="mt-1.5 w-full rounded-full bg-gradient-to-r from-[#ff6b1a] to-[#ff9a3d] py-1.5 text-xs font-bold text-white transition hover:scale-[1.02]"
          >
            Approve ▶
          </button>
        </div>
      )}

      {task.error && <div className="mt-2 truncate text-[11px] text-red-300" title={task.error}>❌ {task.error.slice(0, 120)}</div>}

      <div className="mt-2 flex gap-1.5 text-[11px]">
        <button onClick={() => onOpenLog(openLog === task.id ? null : task.id)} className="opacity-60 hover:opacity-100 hover:underline">
          {openLog === task.id ? "hide log ▴" : "log ▾"}
        </button>
        {task.status !== "in_progress" && task.status !== "awaiting_approval" && (
          <button onClick={() => onMove(task.id, "in_progress")} className="opacity-60 hover:opacity-100 hover:underline">
            {task.status === "completed" || task.status === "failed" ? "restart" : "start"}
          </button>
        )}
        {task.status === "in_progress" && (
          <button onClick={() => onMove(task.id, "todo")} className="opacity-60 hover:opacity-100 hover:underline">
            pause
          </button>
        )}
        <button onClick={() => onRemove(task.id)} className="ml-auto opacity-60 hover:text-red-300 hover:underline">
          delete
        </button>
      </div>

      {openLog === task.id && (
        <pre className="term mt-2 max-h-48 overflow-y-auto rounded-xl bg-black/50 p-2.5 text-[11px] break-words whitespace-pre-wrap text-white/80">
          {(log || "— no output yet —").slice(-6000)}
        </pre>
      )}
    </motion.div>
  );
}
