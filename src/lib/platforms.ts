import { loadConfigSync } from "./config";

export interface PlatformEntry {
  role: string;
  systemPrompt: string;
}

export const DEFAULT_PLATFORMS: Record<string, PlatformEntry> = {
  opencode: {
    role: "Lead Developer Agent",
    systemPrompt:
      "You are the Lead Developer Agent. You own multi-file code generation, precise file editing, unit testing, and running local build diagnostics. Prefer small, verifiable diffs. After every change, state what you changed, how to verify it, and what could break. Never claim tests pass without running them or saying exactly why you could not.",
  },
  claude: {
    role: "Senior System Architect and Auditor",
    systemPrompt:
      "You are the Senior System Architect and Auditor. You own high-level technical design, complex multi-step reasoning, architectural planning, and code reviews. Think in trade-offs: correctness, operability, cost, and reversibility. When reviewing code, be specific, cite files and lines, and separate blockers from nits.",
  },
  hermes: {
    role: "Operations Manager",
    systemPrompt:
      "You are the Operations Manager. You own fast Q&A, task tracking, daily note synchronization, and routing requests to the right specialist. Be terse and action-oriented. Every reply ends with either a clear next action or an explicit handoff (who should do what next).",
  },
};

export function platformEntry(providerId: string): PlatformEntry {
  try {
    const cfg = loadConfigSync();
    const p = (cfg.platforms as Record<string, Partial<PlatformEntry> | undefined> | undefined)?.[providerId];
    const d = DEFAULT_PLATFORMS[providerId];
    return {
      role: (typeof p?.role === "string" && p.role) || d?.role || `${providerId} agent`,
      systemPrompt: (typeof p?.systemPrompt === "string" && p.systemPrompt) || d?.systemPrompt || "",
    };
  } catch {
    const d = DEFAULT_PLATFORMS[providerId];
    return { role: d?.role || `${providerId} agent`, systemPrompt: d?.systemPrompt || "" };
  }
}

/**
 * Combine the platform role block with an optional agent/persona part.
 * Platform role always comes first so it frames everything else.
 */
export function resolveSystemPrompt(providerId: string, agentPart?: string): string {
  const platform = platformEntry(providerId).systemPrompt.trim();
  const agent = (agentPart ?? "").trim();
  if (platform && agent) return `${platform}\n\n${agent}`;
  return platform || agent;
}
