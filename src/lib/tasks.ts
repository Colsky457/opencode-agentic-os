import { promises as fs } from "fs";
import path from "path";
import { agentWorkspace } from "./claude";
import { resolveSystemPrompt } from "./platforms";
import { getRunner } from "./runners";
import { gateTool } from "./tools";
import { DATA_DIR, getAgents, getTasks, saveTasks, type BgTask } from "./store";

const running = new Set<string>();

export function taskLogPath(id: string) {
  return path.join(DATA_DIR(), "tasks", `${id}.log`);
}

export async function appendTaskLog(id: string, text: string) {
  try {
    const p = taskLogPath(id);
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.appendFile(p, text + "\n", "utf8");
  } catch {}
}

export async function readTaskLog(id: string, maxBytes = 20000): Promise<string> {
  try {
    const p = taskLogPath(id);
    const stat = await fs.stat(p);
    const start = Math.max(0, stat.size - maxBytes);
    const fh = await fs.open(p, "r");
    const buf = Buffer.alloc(stat.size - start);
    await fh.read(buf, 0, buf.length, start);
    await fh.close();
    return buf.toString("utf8");
  } catch {
    return "";
  }
}

function needsGate(task: BgTask, idx: number): boolean {
  const step = task.steps[idx];
  if (!step) return false;
  if (task.approvedSteps.includes(step.id)) return false;
  return step.sensitive || (task.requiresApproval && idx === 0);
}

/** Advance a task through its steps. Safe to call repeatedly; guarded per task. */
export async function runTaskLoop(taskId: string) {
  if (running.has(taskId)) return;
  running.add(taskId);
  try {
    for (;;) {
      const tasks = await getTasks();
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;
      if (task.status === "completed" || task.status === "failed") return;
      if (task.status !== "in_progress") return;

      const idx = task.currentStep;
      const step = task.steps[idx];
      if (!step) {
        task.status = "completed";
        task.pendingStep = null;
        task.updatedAt = Date.now();
        await saveTasks(tasks);
        await appendTaskLog(task.id, `\n✅ Task completed.`);
        return;
      }

      if (needsGate(task, idx)) {
        task.status = "awaiting_approval";
        task.pendingStep = idx;
        task.updatedAt = Date.now();
        await saveTasks(tasks);
        await appendTaskLog(task.id, `\n⏸ Paused: step ${idx + 1} "${step.label}" needs approval.`);
        return;
      }

      const agents = await getAgents();
      const agent = agents.find((a) => a.id === task.agentId) ?? null;
      const runner = getRunner(agent?.provider ?? task.provider);
      const cwd = agent ? agentWorkspace(agent.id) : path.join(DATA_DIR(), "tmp");
      const agentPart = agent
        ? `You are ${agent.name}. ${agent.persona}. ${agent.systemPrompt}`
        : undefined;
      const prompt = `Task "${task.title}", step ${idx + 1}/${task.steps.length} — ${step.label}:\n${step.prompt}`;

      await appendTaskLog(task.id, `\n━━━ Step ${idx + 1}/${task.steps.length}: ${step.label} (${runner.label}) ━━━`);
      const startedAt = Date.now();
      let acc = "";
      try {
        const blocked = await gateTool(`cli:${runner.id}`, agent?.id ?? null, `Task "${task.title}" step ${idx + 1}`);
        if (blocked) throw blocked;
        const meta = await runner.chat({
          prompt,
          model: agent?.model || undefined,
          systemPrompt: resolveSystemPrompt(runner.id, agentPart) || undefined,
          cwd,
          onDelta: (t) => {
            acc += t;
            void appendTaskLog(task.id, t);
          },
        });
        if (meta.isError) throw new Error(meta.errorText ?? `${runner.label} step failed`);
        const fresh = await getTasks();
        const cur = fresh.find((t) => t.id === taskId);
        if (!cur || cur.status !== "in_progress") return;
        const s = cur.steps[idx];
        if (s) {
          s.done = true;
          s.ok = true;
        }
        cur.currentStep = idx + 1;
        cur.updatedAt = Date.now();
        await saveTasks(fresh);
        await appendTaskLog(task.id, `\n✔ Step done in ${((Date.now() - startedAt) / 1000).toFixed(1)}s · ${meta.inputTokens}+${meta.outputTokens} tokens.`);
      } catch (e) {
        const fresh = await getTasks();
        const cur = fresh.find((t) => t.id === taskId);
        if (cur) {
          const s = cur.steps[idx];
          if (s) {
            s.done = true;
            s.ok = false;
          }
          cur.status = "failed";
          cur.error = e instanceof Error ? e.message : "step failed";
          cur.updatedAt = Date.now();
          await saveTasks(fresh);
        }
        await appendTaskLog(task.id, `\n❌ Step failed: ${e instanceof Error ? e.message : "unknown error"}`);
        return;
      }
    }
  } finally {
    running.delete(taskId);
  }
}

/** Approve the pending step and resume the loop. */
export async function approveTaskStep(taskId: string): Promise<boolean> {
  const tasks = await getTasks();
  const task = tasks.find((t) => t.id === taskId);
  if (!task || task.status !== "awaiting_approval" || task.pendingStep == null) return false;
  const step = task.steps[task.pendingStep];
  if (step && !task.approvedSteps.includes(step.id)) task.approvedSteps.push(step.id);
  task.status = "in_progress";
  task.pendingStep = null;
  task.updatedAt = Date.now();
  await saveTasks(tasks);
  await appendTaskLog(task.id, `\n✅ Approved by operator — resuming.`);
  void runTaskLoop(taskId);
  return true;
}
