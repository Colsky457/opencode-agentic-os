"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Card, Pill, SectionTitle } from "@/components/os/ui";

interface SkillMeta {
  id: string;
  name: string;
  icon: string;
  blurb: string;
}

type RunState = "idle" | "running" | "done" | "failed";

/** One-tap skill buttons: task-skills run via /api/skills, digest via /api/digest/run. */
export function SkillButtons() {
  const [skills, setSkills] = useState<SkillMeta[]>([]);
  const [runs, setRuns] = useState<Record<string, { state: RunState; taskId?: string }>>({});
  const [digestState, setDigestState] = useState<RunState>("idle");
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch("/api/skills").then((r) => r.json()).then((d) => setSkills(d.skills ?? [])).catch(() => {});
  }, []);

  const poll = useCallback(async () => {
    try {
      const d = await fetch("/api/tasks").then((r) => r.json());
      const byId = new Map<string, string>((d.tasks ?? []).map((t: any) => [t.id, t.status]));
      setRuns((prev) => {
        const next = { ...prev };
        let anyRunning = false;
        for (const [k, v] of Object.entries(next)) {
          if (v.state !== "running" || !v.taskId) continue;
          const s = byId.get(v.taskId);
          if (s === "completed") next[k] = { ...v, state: "done" };
          else if (s === "failed" || s === "awaiting_approval") next[k] = { ...v, state: s === "failed" ? "failed" : "running" };
          else anyRunning = true;
        }
        if (!anyRunning && timer.current) {
          clearInterval(timer.current);
          timer.current = null;
        }
        return next;
      });
    } catch {}
  }, []);

  const startPoll = useCallback(() => {
    if (!timer.current) timer.current = setInterval(poll, 3000);
  }, [poll]);

  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
  }, []);

  const runSkill = async (id: string) => {
    if (runs[id]?.state === "running") return;
    setRuns((p) => ({ ...p, [id]: { state: "running" } }));
    try {
      const d = await fetch("/api/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      }).then((r) => r.json());
      if (!d.task?.id) throw new Error();
      setRuns((p) => ({ ...p, [id]: { state: "running", taskId: d.task.id } }));
      startPoll();
    } catch {
      setRuns((p) => ({ ...p, [id]: { state: "failed" } }));
    }
  };

  const runDigest = async () => {
    if (digestState === "running") return;
    setDigestState("running");
    try {
      const r = await fetch("/api/digest/run", { method: "POST" });
      setDigestState(r.ok ? "done" : "failed");
    } catch {
      setDigestState("failed");
    }
  };

  const pill = (s: RunState) =>
    s === "idle" ? null : (
      <Pill tone={s === "running" ? "violet" : s === "done" ? "green" : "red"}>
        {s === "running" ? "● running" : s}
      </Pill>
    );

  return (
    <Card>
      <SectionTitle kicker="skills" title="One-tap skills" right={<Link href="/tasks" className="text-xs text-[#ff8c42] hover:underline">task log ▸</Link>} />
      <div className="grid grid-cols-2 gap-2.5">
        {skills.map((s) => {
          const st = runs[s.id]?.state ?? "idle";
          return (
            <button
              key={s.id}
              onClick={() => runSkill(s.id)}
              disabled={st === "running"}
              className="rounded-xl border border-white/10 bg-white/5 p-3 text-left transition hover:scale-[1.02] hover:border-[#ff6b1a]/50 disabled:opacity-70"
            >
              <div className="flex items-center justify-between">
                <span className="text-xl">{s.icon}</span>
                {pill(st)}
              </div>
              <div className="mt-1 text-sm font-bold">{s.name}</div>
              <div className="text-xs opacity-50">{st === "running" ? "Working in background…" : s.blurb}</div>
            </button>
          );
        })}
        <button
          onClick={runDigest}
          disabled={digestState === "running"}
          className="rounded-xl border border-white/10 bg-white/5 p-3 text-left transition hover:scale-[1.02] hover:border-[#ff6b1a]/50 disabled:opacity-70"
        >
          <div className="flex items-center justify-between">
            <span className="text-xl">🌙</span>
            {pill(digestState)}
          </div>
          <div className="mt-1 text-sm font-bold">Digest now</div>
          <div className="text-xs opacity-50">{digestState === "running" ? "Hermes is writing…" : "Nightly note on demand"}</div>
        </button>
      </div>
    </Card>
  );
}
