import { promises as fs } from "fs";
import { readFileSync, statSync } from "fs";
import os from "os";
import path from "path";

export interface ProviderEntry {
  bin: string;
  enabled: boolean;
}

export interface OsConfig {
  server: { host: string; port: number };
  paths: { brain: string; data: string; workspaces: string };
  providers: { default: string } & Record<string, ProviderEntry | string>;
  chat: { models: string[]; permissionMode: string };
  ui: { theme: string; demoMode: boolean };
  digest: { enabled: boolean; time: string; noteDir: string; maxChars: number; retries: number; fallback: string };
  platforms: Record<string, { role: string; systemPrompt: string }>;
  routing: { keywords: Record<string, string[]>; fallback: string };
}

export const CONFIG_FILE = path.join(process.cwd(), "os.config.json");

const DEFAULTS: OsConfig = {
  server: { host: "127.0.0.1", port: 3000 },
  paths: { brain: "~/brain", data: "./data", workspaces: "./workspaces" },
  providers: {
    default: "claude",
    claude: { bin: "claude", enabled: true },
    codex: { bin: "codex", enabled: false },
    gemini: { bin: "gemini", enabled: false },
    opencode: { bin: "opencode", enabled: false },
  },
  chat: { models: ["default", "opus", "sonnet", "haiku"], permissionMode: "dontAsk" },
  ui: { theme: "system", demoMode: false },
  digest: { enabled: true, time: "20:00", noteDir: "Daily Notes", maxChars: 12000, retries: 3, fallback: "claude" },
  platforms: {},
  routing: {
    keywords: {
      claude: ["architect", "plan", "review", "design"],
      opencode: ["build", "refactor", "fix code", "test", "git"],
      hermes: ["note", "journal", "goal", "summary", "quick question"],
    },
    fallback: "claude",
  },
};

/** Expand ~ and resolve relative paths against the project root. */
export function resolvePath(p: string): string {
  if (p.startsWith("~")) p = path.join(os.homedir(), p.slice(1));
  if (!path.isAbsolute(p)) p = path.resolve(process.cwd(), p);
  return p;
}

function deepMerge<T>(base: T, over: Record<string, unknown>): T {
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(over)) {
    if (v && typeof v === "object" && !Array.isArray(v) && typeof out[k] === "object" && out[k] !== null) {
      out[k] = deepMerge(out[k] as Record<string, unknown>, v as Record<string, unknown>);
    } else if (v !== undefined) {
      out[k] = v;
    }
  }
  return out as T;
}

let cache: OsConfig | null = null;
let cacheMtime = 0;

/** mtime of os.config.json, or 0 when missing. */
function fileMtime(): number {
  try {
    return statSync(CONFIG_FILE).mtimeMs;
  } catch {
    return 0;
  }
}

function applyEnv(merged: OsConfig): OsConfig {
  if (process.env.OS_PORT) merged.server.port = Number(process.env.OS_PORT) || merged.server.port;
  if (process.env.OS_HOST) merged.server.host = process.env.OS_HOST;
  if (process.env.BRAIN_DIR) merged.paths.brain = process.env.BRAIN_DIR;
  if (process.env.CLAUDE_BIN) {
    const c = merged.providers.claude as ProviderEntry;
    if (c && typeof c === "object") c.bin = process.env.CLAUDE_BIN;
  }
  return merged;
}

function fromFile(file: Record<string, unknown>): OsConfig {
  return applyEnv(deepMerge<OsConfig>({ ...DEFAULTS }, file));
}

export async function loadConfig(): Promise<OsConfig> {
  const mtime = fileMtime();
  if (cache && mtime === cacheMtime) return cache;
  let file: Record<string, unknown> = {};
  try {
    file = JSON.parse(await fs.readFile(CONFIG_FILE, "utf8"));
  } catch {
    // missing/unparseable → defaults (first-run wizard writes it)
  }
  cache = fromFile(file);
  cacheMtime = mtime;
  return cache;
}

/** Sync loader for server hot paths (store/brain/claude). Never throws. */
export function loadConfigSync(): OsConfig {
  const mtime = fileMtime();
  if (cache && mtime === cacheMtime) return cache;
  try {
    const file = JSON.parse(readFileSync(CONFIG_FILE, "utf8"));
    cache = fromFile(file);
  } catch {
    cache = fromFile({});
  }
  cacheMtime = mtime;
  return cache;
}

/** Sync read for hot paths — call loadConfig() once at startup/route entry first. */
export function getConfig(): OsConfig {
  if (!cache) throw new Error("config not loaded — call loadConfig() first");
  return cache;
}

export async function configExists(): Promise<boolean> {
  try {
    await fs.access(CONFIG_FILE);
    return true;
  } catch {
    return false;
  }
}

export function defaultBin(id: string): string {
  return id === "antigravity" ? "agy" : id;
}

export function providerBin(cfg: OsConfig, id: string): string {
  const p = cfg.providers[id] as ProviderEntry | undefined;
  return p && typeof p === "object" && p.bin ? p.bin : defaultBin(id);
}

export function defaultProvider(cfg: OsConfig): string {
  const d = cfg.providers.default;
  return typeof d === "string" && d ? d : "claude";
}
