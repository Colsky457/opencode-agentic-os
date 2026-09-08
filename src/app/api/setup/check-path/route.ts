import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { resolvePath } from "@/lib/config";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const raw = String(body.path ?? "").trim();
  if (!raw) return NextResponse.json({ ok: false, error: "path required" }, { status: 400 });
  try {
    const resolved = resolvePath(raw);
    await fs.mkdir(resolved, { recursive: true });
    const probe = path.join(resolved, ".claudeos-write-test");
    await fs.writeFile(probe, "ok", "utf8");
    await fs.unlink(probe);
    // also ensure the Agentic OS subfolder is creatable
    await fs.mkdir(path.join(resolved, "Agentic OS"), { recursive: true });
    return NextResponse.json({ ok: true, resolved });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "not writable" });
  }
}
