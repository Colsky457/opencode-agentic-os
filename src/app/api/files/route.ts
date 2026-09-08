import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { WORKSPACES_DIR } from "@/lib/store";

/** Resolve a user path safely inside workspaces/. Returns null on escape. */
function safeResolve(rel: string): string | null {
  const base = path.resolve(WORKSPACES_DIR());
  const target = path.resolve(base, rel || ".");
  if (target !== base && !target.startsWith(base + path.sep)) return null;
  return target;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const rel = searchParams.get("path") ?? "";
  const target = safeResolve(rel);
  if (!target) return NextResponse.json({ error: "path escape blocked" }, { status: 403 });
  try {
    const stat = await fs.stat(target);
    if (stat.isDirectory()) {
      await fs.mkdir(target, { recursive: true });
      const entries = await fs.readdir(target, { withFileTypes: true });
      const items = await Promise.all(
        entries
          .filter((e) => !e.name.startsWith("."))
          .map(async (e) => {
            const p = path.join(target, e.name);
            const s = await fs.stat(p);
            return {
              name: e.name,
              dir: e.isDirectory(),
              size: s.size,
              mtime: s.mtimeMs,
              path: path.relative(path.resolve(WORKSPACES_DIR()), p),
            };
          })
      );
      items.sort((a, b) => Number(b.dir) - Number(a.dir) || a.name.localeCompare(b.name));
      return NextResponse.json({ type: "dir", path: rel, items });
    }
    const content = await fs.readFile(target, "utf8").catch(() => null);
    if (content === null || content.length > 200_000)
      return NextResponse.json({ type: "file", path: rel, binary: true });
    return NextResponse.json({ type: "file", path: rel, content });
  } catch {
    await fs.mkdir(target, { recursive: true });
    return NextResponse.json({ type: "dir", path: rel, items: [] });
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const rel = String(body.path ?? "");
  const target = safeResolve(rel);
  if (!target) return NextResponse.json({ error: "path escape blocked" }, { status: 403 });
  if (body.mkdir) {
    await fs.mkdir(target, { recursive: true });
    return NextResponse.json({ ok: true });
  }
  const content = String(body.content ?? "").slice(0, 200_000);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content, "utf8");
  return NextResponse.json({ ok: true });
}
