import { mkdirSync } from "fs";
import { promises as fs } from "fs";
import path from "path";
import { DatabaseSync } from "node:sqlite";
import { DATA_DIR } from "./store";

// AgentOS-FS §3: Semantic Inode (A-Inode) catalog, backed by SQLite.
// Token counts are estimated (chars/4); embeddings stay NULL until the
// vault embedder is wired in. One row per indexed file, keyed by abs path.

export const CAP_READ = 0b00000001;
export const CAP_EDIT = 0b00000010;

const INDEXABLE = new Set([".md", ".markdown", ".txt", ".ts", ".tsx", ".js", ".mjs", ".py", ".rs", ".sh"]);
const SKIP_DIRS = new Set(["node_modules", ".next", ".git", ".venv", "venv", "__pycache__", ".hermes"]);

let db: DatabaseSync | null = null;

export function ainodeDb(): DatabaseSync {
  if (!db) {
    mkdirSync(DATA_DIR(), { recursive: true });
    db = new DatabaseSync(path.join(DATA_DIR(), "a_fs.db"));
    db.exec(`CREATE TABLE IF NOT EXISTS ainodes (
      path TEXT PRIMARY KEY,
      bytes INTEGER NOT NULL DEFAULT 0,
      tokens INTEGER NOT NULL DEFAULT 0,
      l0 TEXT NOT NULL DEFAULT '',
      l1 TEXT NOT NULL DEFAULT '',
      l2 TEXT NOT NULL DEFAULT '[]',
      embedding BLOB,
      author_agent TEXT,
      conversation TEXT,
      capabilities INTEGER NOT NULL DEFAULT 3,
      snapshot TEXT,
      updated_at INTEGER NOT NULL DEFAULT 0
    )`);
  }
  return db;
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function isText(buf: Buffer): boolean {
  const n = Math.min(buf.length, 8000);
  for (let i = 0; i < n; i++) if (buf[i] === 0) return false;
  return true;
}

function digests(text: string): { l0: string; l1: string; l2: string[] } {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const l0 = (lines[0] ?? "").replace(/^#+\s*/, "").slice(0, 120);
  const paras = text.split(/\n{2,}/).map((p) => p.trim().replace(/^#+\s*/, "")).filter(Boolean);
  const l1 = (paras[0] ?? l0).slice(0, 500);
  const l2: string[] = [];
  const sym = /^(?:export\s+(?:default\s+|async\s+)?)?(?:function|class|const|let|fn|def)\s+([A-Za-z_$][\w$]*)/;
  for (const ln of lines) {
    const m = sym.exec(ln.trim());
    if (m && !l2.includes(m[1])) l2.push(m[1]);
    if (l2.length >= 40) break;
  }
  return { l0, l1, l2 };
}

/** Index (or re-index) one file. No-op for missing/binary/unindexable paths. */
export async function upsertAinode(absPath: string): Promise<boolean> {
  try {
    if (!INDEXABLE.has(path.extname(absPath).toLowerCase())) return false;
    const stat = await fs.stat(absPath);
    if (!stat.isFile() || stat.size > 500_000) return false;
    const buf = await fs.readFile(absPath);
    if (!isText(buf)) return false;
    const text = buf.toString("utf8");
    const { l0, l1, l2 } = digests(text);
    ainodeDb()
      .prepare(
        `INSERT INTO ainodes (path, bytes, tokens, l0, l1, l2, capabilities, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, 3, ?)
         ON CONFLICT(path) DO UPDATE SET bytes=excluded.bytes, tokens=excluded.tokens,
           l0=excluded.l0, l1=excluded.l1, l2=excluded.l2, updated_at=excluded.updated_at`
      )
      .run(absPath, stat.size, estimateTokens(text), l0, l1, JSON.stringify(l2), Date.now());
    return true;
  } catch {
    return false;
  }
}

async function walk(dir: string, out: string[]): Promise<void> {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (e.name.startsWith(".") && e.name !== ".agents") continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      await walk(p, out);
    } else if (e.isFile()) {
      out.push(p);
    }
  }
}

/** Full backfill over workspace + vault roots. Returns {files, indexed}. */
export async function backfillAinodes(roots: string[]): Promise<{ files: number; indexed: number }> {
  const found: string[] = [];
  for (const r of roots) await walk(r, found);
  let indexed = 0;
  for (const f of found) {
    if (await upsertAinode(f)) indexed++;
  }
  return { files: found.length, indexed };
}

export function ainodeStats(): { rows: number } {
  try {
    const r = ainodeDb().prepare("SELECT COUNT(*) AS n FROM ainodes").get() as { n: number };
    return { rows: r.n };
  } catch {
    return { rows: 0 };
  }
}
