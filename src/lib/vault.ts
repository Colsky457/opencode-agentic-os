import { promises as fs } from "fs";
import path from "path";
import { loadConfigSync, resolvePath } from "./config";
import { DATA_DIR } from "./store";

export interface VaultChunk {
  id: string;
  file: string;
  title: string;
  chunkIndex: number;
  text: string;
  embedding: number[] | null;
}

interface FileEntry {
  mtime: number;
  chunks: VaultChunk[];
}

export interface VaultIndex {
  version: 1;
  files: Record<string, FileEntry>;
  updatedAt: number;
}

const INDEX_FILE = "vault-index.json";
const MODEL_ID = "Xenova/all-MiniLM-L6-v2";
const CHUNK_CHARS = 2000;
const CHUNK_OVERLAP = 200;

function indexPath() {
  return path.join(DATA_DIR(), INDEX_FILE);
}

export function uploadsDir() {
  return path.join(DATA_DIR(), "uploads");
}

export function vaultRoots(): string[] {
  const roots: string[] = [];
  try {
    roots.push(resolvePath(loadConfigSync().paths.brain));
  } catch {}
  roots.push(uploadsDir());
  return roots;
}

export async function loadIndex(): Promise<VaultIndex> {
  try {
    const raw = await fs.readFile(indexPath(), "utf8");
    const parsed = JSON.parse(raw);
    if (parsed && parsed.version === 1 && parsed.files) return parsed as VaultIndex;
  } catch {}
  return { version: 1, files: {}, updatedAt: Date.now() };
}

async function saveIndex(idx: VaultIndex) {
  idx.updatedAt = Date.now();
  await fs.mkdir(DATA_DIR(), { recursive: true });
  await fs.writeFile(indexPath(), JSON.stringify(idx), "utf8");
}

export function chunkText(text: string): string[] {
  const paras = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const chunks: string[] = [];
  let buf = "";
  for (const p of paras) {
    if ((buf + "\n\n" + p).length > CHUNK_CHARS && buf) {
      chunks.push(buf);
      buf = buf.slice(-CHUNK_OVERLAP);
    }
    buf = buf ? buf + "\n\n" + p : p;
  }
  if (buf.trim()) chunks.push(buf);
  // hard-split pathological single-paragraph blobs
  const out: string[] = [];
  for (const c of chunks) {
    if (c.length <= CHUNK_CHARS * 1.5) out.push(c);
    else for (let i = 0; i < c.length; i += CHUNK_CHARS) out.push(c.slice(i, i + CHUNK_CHARS));
  }
  return out.filter((c) => c.trim().length > 20);
}

async function walkMarkdown(dir: string, out: string[] = [], depth = 0): Promise<string[]> {
  if (depth > 6) return out;
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e.name.startsWith(".")) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules") continue;
      await walkMarkdown(full, out, depth + 1);
    } else if (/\.(md|markdown|txt)$/i.test(e.name)) {
      out.push(full);
    } else if (/\.pdf$/i.test(e.name)) {
      out.push(full);
    }
  }
  return out;
}

async function extractPdf(abs: string): Promise<string> {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const data = new Uint8Array(await fs.readFile(abs));
  const doc = await getDocument({ data, useSystemFonts: true }).promise;
  const pages: string[] = [];
  const n = Math.min(doc.numPages, 100);
  for (let i = 1; i <= n; i++) {
    const page = await getPageText(doc, i);
    if (page.trim()) pages.push(page);
  }
  await doc.cleanup().catch(() => {});
  return pages.join("\n\n");
}

async function getPageText(doc: any, i: number): Promise<string> {
  const page = await doc.getPage(i);
  const tc = await page.getTextContent();
  return tc.items.map((it: any) => (typeof it.str === "string" ? it.str : "")).join(" ");
}

// ---------- embeddings (lazy, optional) ----------
type Extractor = (text: string, opts?: any) => Promise<any>;
let extractorPromise: Promise<Extractor | null> | null = null;
let embedError: string | null = null;

export function embedStatus(): { ready: boolean; loading: boolean; error: string | null } {
  return { ready: false, loading: extractorPromise !== null, error: embedError };
}

async function getExtractor(): Promise<Extractor | null> {
  if (!extractorPromise) {
    extractorPromise = (async () => {
      try {
        const { pipeline } = await import("@xenova/transformers");
        // Termux/Android has no onnxruntime-node binding (stubbed to the web
        // build in package.json): force single-threaded WASM inference.
        try {
          const backend = await import("@xenova/transformers/src/backends/onnx.js");
          const eps: string[] = backend.executionProviders;
          const ci = eps.indexOf("cpu");
          if (ci >= 0) eps.splice(ci, 1);
          if (backend.ONNX?.env?.wasm) backend.ONNX.env.wasm.numThreads = 1;
        } catch {}
        const pipe = await pipeline("feature-extraction", MODEL_ID);
        embedError = null;
        return (async (text: string) => pipe(text, { pooling: "mean", normalize: true })) as Extractor;
      } catch (e) {
        embedError = e instanceof Error ? e.message.slice(0, 200) : "embed load failed";
        return null;
      }
    })();
  }
  return extractorPromise;
}

export async function embedTexts(texts: string[]): Promise<(number[] | null)[]> {
  const ex = await getExtractor();
  if (!ex) return texts.map(() => null);
  const out: (number[] | null)[] = [];
  for (const t of texts) {
    try {
      const res = await ex(t.slice(0, 2000));
      const arr = res?.tolist?.()?.[0] ?? res?.data;
      out.push(Array.isArray(arr) ? Array.from(arr as number[]) : null);
    } catch {
      out.push(null);
    }
  }
  return out;
}

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

function keywordScore(query: string, text: string): number {
  const terms = query.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2);
  if (!terms.length) return 0;
  const hay = text.toLowerCase();
  let hits = 0;
  for (const t of new Set(terms)) {
    if (hay.includes(t)) hits++;
  }
  return hits / new Set(terms).size;
}

// ---------- indexing ----------
export interface IndexProgress {
  running: boolean;
  total: number;
  done: number;
  current: string;
  embedded: number;
  errors: string[];
}

const progress: IndexProgress = { running: false, total: 0, done: 0, current: "", embedded: 0, errors: [] };

export function indexProgress(): IndexProgress {
  return { ...progress, errors: [...progress.errors] };
}

export async function indexVault(onFile?: (rel: string) => void): Promise<{ files: number; chunks: number; embedded: number; errors: string[] }> {
  if (progress.running) return { files: 0, chunks: 0, embedded: 0, errors: ["index already running"] };
  progress.running = true;
  progress.done = 0;
  progress.embedded = 0;
  progress.errors = [];
  progress.current = "";
  try {
    const idx = await loadIndex();
    const seen = new Set<string>();
    const allFiles: string[] = [];
    for (const root of vaultRoots()) {
      for (const f of await walkMarkdown(root)) {
        allFiles.push(f);
        seen.add(f);
      }
    }
    // drop removed files
    for (const f of Object.keys(idx.files)) {
      if (!seen.has(f)) delete idx.files[f];
    }
    progress.total = allFiles.length;

    // figure out which files changed
    const todo: string[] = [];
    for (const f of allFiles) {
      try {
        const stat = await fs.stat(f);
        if (idx.files[f]?.mtime === stat.mtimeMs) {
          progress.done++;
          continue;
        }
        todo.push(f);
      } catch {
        progress.done++;
      }
    }

    // warm embeddings (downloads model on first use; may fail → keyword fallback)
    await getExtractor();

    for (const f of todo) {
      progress.current = path.basename(f);
      try {
        const stat = await fs.stat(f);
        const raw = f.toLowerCase().endsWith(".pdf") ? await extractPdf(f) : await fs.readFile(f, "utf8");
        const title = raw.split("\n").find((l) => l.trim().replace(/^#+\s*/, ""))?.trim().replace(/^#+\s*/, "").slice(0, 120) || path.basename(f);
        const parts = chunkText(raw);
        const embs = await embedTexts(parts);
        const chunks: VaultChunk[] = parts.map((text, i) => ({
          id: `${f}#${i}`,
          file: f,
          title,
          chunkIndex: i,
          text,
          embedding: embs[i],
        }));
        idx.files[f] = { mtime: stat.mtimeMs, chunks };
        progress.embedded += chunks.filter((c) => c.embedding).length;
        onFile?.(f);
      } catch (e) {
        progress.errors.push(`${path.basename(f)}: ${e instanceof Error ? e.message.slice(0, 120) : "failed"}`);
      }
      progress.done++;
    }
    await saveIndex(idx);
    const counts = Object.values(idx.files).reduce(
      (acc, f) => ({ chunks: acc.chunks + f.chunks.length, embedded: acc.embedded + f.chunks.filter((c) => c.embedding).length }),
      { chunks: 0, embedded: 0 }
    );
    return { files: Object.keys(idx.files).length, ...counts, errors: [...progress.errors] };
  } finally {
    progress.running = false;
    progress.current = "";
  }
}

export interface SearchHit {
  id: string;
  file: string;
  title: string;
  chunkIndex: number;
  text: string;
  score: number;
  method: "semantic" | "keyword";
}

export async function searchVault(query: string, k = 6): Promise<{ hits: SearchHit[]; embedded: boolean }> {
  const idx = await loadIndex();
  const chunks = Object.values(idx.files).flatMap((f) => f.chunks);
  if (!chunks.length) return { hits: [], embedded: false };

  // skip the ~90MB model download entirely when nothing is embedded yet
  const anyEmbedded = chunks.some((c) => c.embedding);
  const [qEmb] = anyEmbedded ? await embedTexts([query]) : [null];
  const scored = chunks.map((c) => {
    let score = 0;
    let method: SearchHit["method"] = "keyword";
    const kw = keywordScore(query, c.text);
    if (qEmb && c.embedding) {
      score = cosine(qEmb, c.embedding) * 0.7 + kw * 0.3;
      method = "semantic";
    } else {
      score = kw;
    }
    return { c, score, method };
  });
  const hits = scored
    .filter((s) => s.score > 0.02)
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((s) => ({
      id: s.c.id,
      file: s.c.file,
      title: s.c.title,
      chunkIndex: s.c.chunkIndex,
      text: s.c.text.slice(0, 600),
      score: Math.round(s.score * 1000) / 1000,
      method: s.method,
    }));
  return { hits, embedded: !!qEmb };
}

export async function indexStats() {
  const idx = await loadIndex();
  const files = Object.keys(idx.files);
  let chunks = 0;
  let embedded = 0;
  for (const f of Object.values(idx.files)) {
    chunks += f.chunks.length;
    embedded += f.chunks.filter((c) => c.embedding).length;
  }
  return {
    files: files.length,
    chunks,
    embedded,
    updatedAt: idx.updatedAt,
    embedError,
    fileList: files.map((f) => ({ file: f, chunks: idx.files[f].chunks.length })).slice(0, 200),
  };
}
