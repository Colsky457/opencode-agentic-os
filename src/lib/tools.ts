import { allRunners } from "./runners";
import { getToolPermissions, saveToolPermissions, type ToolLevel } from "./store";
import { uid } from "./utils";

export interface ToolDef {
  id: string;
  label: string;
  kind: "cli" | "shell" | "fleet";
  detail: string;
}

/** The full tool catalog: one entry per provider CLI plus shell + fleet. */
export function toolCatalog(): ToolDef[] {
  const tools: ToolDef[] = allRunners().map((r) => ({
    id: `cli:${r.id}`,
    label: `${r.label} CLI`,
    kind: "cli" as const,
    detail: `Spawn the ${r.label} command-line bridge (chat, arena, tasks, automations).`,
  }));
  tools.push(
    {
      id: "shell",
      label: "Shell scripts",
      kind: "shell",
      detail: "Run local shell commands (automation script actions).",
    },
    {
      id: "fleet",
      label: "Fleet processes",
      kind: "fleet",
      detail: "Start agent background processes. Stopping is always allowed for safety.",
    }
  );
  return tools;
}

export type Decision =
  | { decision: "allow" }
  | { decision: "deny"; reason: string }
  | { decision: "pending"; approvalId: string };

function levelLabel(tool: string): string {
  if (tool.startsWith("cli:")) {
    const known: Record<string, string> = { claude: "Claude Code", opencode: "opencode", hermes: "Hermes", antigravity: "Antigravity" };
    return known[tool.slice(4)] ?? tool;
  }
  return tool;
}

/**
 * Single choke point for tool gating. Global default wins unless a
 * per-agent override exists. "ask" mints a (deduped) pending approval and
 * reports pending; approvals are single-use.
 */
export async function checkTool(tool: string, agentId: string | null, summary: string): Promise<Decision> {
  const perms = await getToolPermissions();
  const level: ToolLevel = (agentId && perms.overrides[agentId]?.[tool]) || perms.defaults[tool] || "allow";
  if (level === "allow") return { decision: "allow" };
  if (level === "disabled") {
    return { decision: "deny", reason: `Tool ${levelLabel(tool)} is disabled in the Tool Registry.` };
  }
  // ask → spend an unconsumed grant, else dedupe/mint a pending request
  const grant = [...perms.approvals]
    .reverse()
    .find((a) => a.tool === tool && (a.agentId ?? null) === (agentId ?? null) && a.status === "approved" && !a.consumed);
  if (grant) {
    grant.consumed = true;
    await saveToolPermissions(perms);
    return { decision: "allow" };
  }
  const open = perms.approvals.find((a) => a.tool === tool && (a.agentId ?? null) === (agentId ?? null) && a.status === "pending");
  if (open) return { decision: "pending", approvalId: open.id };
  const approval = {
    id: uid("tap"),
    tool,
    agentId,
    summary: summary.slice(0, 300),
    status: "pending" as const,
    consumed: false,
    createdAt: Date.now(),
    decidedAt: null,
  };
  perms.approvals.push(approval);
  await saveToolPermissions(perms);
  return { decision: "pending", approvalId: approval.id };
}

/** Operator decision on a pending approval. Approvals are single-use grants. */
export async function decideApproval(approvalId: string, approve: boolean): Promise<boolean> {
  const perms = await getToolPermissions();
  const a = perms.approvals.find((x) => x.id === approvalId);
  if (!a || a.status !== "pending") return false;
  a.status = approve ? "approved" : "denied";
  a.decidedAt = Date.now();
  await saveToolPermissions(perms);
  return true;
}

/**
 * Helper for callers: returns null when allowed, otherwise an Error to surface.
 * On "ask", auto-consumes nothing — the operator approves in the registry,
 * then the caller retries (or the UI Approve button retries for them).
 */
export async function gateTool(tool: string, agentId: string | null, summary: string): Promise<null | Error> {
  const d = await checkTool(tool, agentId, summary);
  if (d.decision === "allow") return null;
  if (d.decision === "deny") return new Error(d.reason);
  return new Error(`Tool ${levelLabel(tool)} needs approval in the Tool Registry (request ${d.approvalId}).`);
}
