import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { vaultRoots } from "@/lib/vault";

const ALLOWED = new Set([".md", ".markdown", ".txt"]);

/** Resolve a path, ensuring it stays inside a vault root. Null on escape. */
function safeResolve(p: string): string | null {
  if (!p) return null;
  const target = path.resolve(p);
  for (const root of vaultRoots()) {
    const base = path.resolve(root);
    if (target === base || target.startsWith(base + path.sep)) return target;
  }
  return null;
}

export async function GET(req: Request) {
  const p = new URL(req.url).searchParams.get("path") ?? "";
  const target = safeResolve(p);
  if (!target || !ALLOWED.has(path.extname(target).toLowerCase()))
    return NextResponse.json({ error: "blocked" }, { status: 403 });
  try {
    const content = await fs.readFile(target, "utf8");
    if (content.length > 200_000) return NextResponse.json({ type: "file", path: target, binary: true });
    return NextResponse.json({ type: "file", path: target, content });
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const target = safeResolve(String(body.path ?? ""));
  if (!target || !ALLOWED.has(path.extname(target).toLowerCase()))
    return NextResponse.json({ error: "blocked" }, { status: 403 });
  const content = String(body.content ?? "").slice(0, 200_000);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content, "utf8");
  return NextResponse.json({ ok: true });
}
