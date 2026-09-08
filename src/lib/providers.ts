import { spawn } from "child_process";
import { defaultBin, loadConfigSync } from "./config";

export interface ProviderInfo {
  id: string;
  label: string;
  bin: string;
  installed: boolean;
  version: string | null;
  supported: boolean; // full runner implemented in this app
  installHint: string;
}

export const KNOWN_PROVIDERS: Omit<ProviderInfo, "installed" | "version" | "bin">[] = [
  { id: "claude", label: "Claude Code", supported: true, installHint: "npm install -g @anthropic-ai/claude-code" },
  { id: "codex", label: "Muse", supported: false, installHint: "npm install -g @openai/codex" },
  { id: "gemini", label: "Gemini CLI", supported: false, installHint: "npm install -g @google/gemini-cli" },
  { id: "opencode", label: "opencode", supported: true, installHint: "npm install -g opencode-ai" },
  { id: "hermes", label: "Hermes", supported: true, installHint: "See https://github.com/anomalyco/opencode Hermes install docs" },
  { id: "antigravity", label: "Antigravity", supported: true, installHint: "Install the Antigravity CLI (provides the `agy` binary)" },
];

function binVersion(bin: string): Promise<string | null> {
  return new Promise((resolve) => {
    const p = spawn(bin, ["--version"], { timeout: 12000, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    p.stdout.on("data", (d) => (out += d.toString()));
    p.on("error", () => resolve(null));
    p.on("close", (code) => {
      if (code !== 0 && !out.trim()) return resolve(null);
      resolve(out.trim().split("\n")[0].slice(0, 60) || null);
    });
  });
}

function configuredBin(id: string): string {
  try {
    const cfg = loadConfigSync();
    const p = cfg.providers[id] as { bin?: string } | undefined;
    if (p && typeof p === "object" && p.bin) return p.bin;
  } catch {}
  return defaultBin(id);
}

/** Probe every known AI CLI. Safe to call from API routes. Cached 5 min. */
let detectCache: { at: number; data: ProviderInfo[] } | null = null;
export async function detectProviders(): Promise<ProviderInfo[]> {
  if (detectCache && Date.now() - detectCache.at < 5 * 60 * 1000) return detectCache.data;
  const defs = KNOWN_PROVIDERS.map((d) => ({ ...d, bin: configuredBin(d.id) }));
  const results = await Promise.all(
    defs.map(async (d) => {
      const version = await binVersion(d.bin);
      return { ...d, installed: version !== null, version };
    })
  );
  detectCache = { at: Date.now(), data: results };
  return results;
}

/** Bust the detection cache (Settings re-detect button). */
export function refreshDetections() {
  detectCache = null;
}

/** The configured default provider id, falling back to first installed/supported. */
export async function resolveDefaultProvider(): Promise<string> {
  try {
    const cfg = loadConfigSync();
    const d = cfg.providers.default;
    if (typeof d === "string" && d) return d;
  } catch {}
  const found = await detectProviders();
  return found.find((p) => p.installed && p.supported)?.id ?? "claude";
}
