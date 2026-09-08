import { loadConfigSync } from "./config";

export const DEFAULT_KEYWORDS: Record<string, string[]> = {
  claude: ["architect", "plan", "review", "design"],
  opencode: ["build", "refactor", "fix code", "test", "git"],
  hermes: ["note", "journal", "goal", "summary", "quick question"],
};

export interface RouteDecision {
  provider: string;
  matched: string[];
  auto: true;
}

function keywordsFor(provider: string): string[] {
  try {
    const cfg = loadConfigSync();
    const custom = (cfg.routing?.keywords as Record<string, unknown> | undefined)?.[provider];
    if (Array.isArray(custom) && custom.length) return custom.map(String).filter(Boolean);
  } catch {}
  return DEFAULT_KEYWORDS[provider] ?? [];
}

function esc(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Word-boundary match tolerant of simple plurals (goal/goals, summary/summaries). */
function wordHit(needle: string, lower: string): boolean {
  const base = esc(needle);
  const plural = needle.endsWith("y") ? `${esc(needle.slice(0, -1))}(?:y|ies)` : `${base}(?:s|es)?`;
  return new RegExp(`\\b${plural}\\b`).test(lower);
}

/**
 * Score a prompt against each provider's keyword list.
 * Multi-word phrases match as substrings; single words match on word boundaries.
 * Highest score wins; ties break toward config order, then fallback provider.
 * Pass candidates to constrain routing (e.g. lock to an agent's provider).
 */
export function routePrompt(text: string, candidates?: string[]): RouteDecision {
  const lower = text.toLowerCase();
  let cfg: { keywords?: Record<string, unknown>; fallback?: string } = {};
  try {
    cfg = loadConfigSync().routing ?? {};
  } catch {}
  const ids =
    candidates?.length
      ? candidates
      : ["claude", "opencode", "hermes"].filter((id) => keywordsFor(id).length > 0);
  const fallback = typeof cfg.fallback === "string" && cfg.fallback ? cfg.fallback : "claude";

  let best = "";
  let bestScore = 0;
  let bestMatched: string[] = [];
  for (const id of ids) {
    const words = keywordsFor(id);
    let score = 0;
    const matched: string[] = [];
    for (const w of words) {
      const needle = w.toLowerCase().trim();
      if (!needle) continue;
      const hit = needle.includes(" ") ? lower.includes(needle) : wordHit(needle, lower);
      if (hit) {
        score += needle.includes(" ") ? 2 : 1;
        matched.push(w);
      }
    }
    if (score > bestScore) {
      bestScore = score;
      best = id;
      bestMatched = matched;
    }
  }
  if (!best) {
    const fb = ids.includes(fallback) ? fallback : (ids[0] ?? "claude");
    return { provider: fb, matched: [], auto: true };
  }
  return { provider: best, matched: bestMatched, auto: true };
}

export function routingConfig(): { keywords: Record<string, string[]>; fallback: string } {
  const out: Record<string, string[]> = {};
  for (const id of Object.keys(DEFAULT_KEYWORDS)) out[id] = keywordsFor(id);
  let fallback = "claude";
  try {
    const f = loadConfigSync().routing?.fallback;
    if (typeof f === "string" && f) fallback = f;
  } catch {}
  return { keywords: out, fallback };
}
