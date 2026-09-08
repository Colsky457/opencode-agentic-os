import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { indexVault, uploadsDir } from "@/lib/vault";

function safeName(name: string) {
  const base = path.basename(name).replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
  return base || "upload";
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const saved: string[] = [];
    await fs.mkdir(uploadsDir(), { recursive: true });
    for (const [, value] of form.entries()) {
      if (typeof value === "string") continue;
      const file = value as File;
      const name = safeName(file.name || "upload");
      if (!/\.(md|markdown|txt|pdf)$/i.test(name)) continue;
      const buf = Buffer.from(await file.arrayBuffer());
      if (!buf.length || buf.length > 15 * 1024 * 1024) continue;
      const stamp = Date.now().toString(36);
      const dest = path.join(uploadsDir(), `${stamp}-${name}`);
      await fs.writeFile(dest, buf);
      saved.push(dest);
    }
    if (!saved.length) return NextResponse.json({ error: "no valid .md or .pdf files" }, { status: 400 });
    // index in background; UI polls status
    void indexVault().catch(() => {});
    return NextResponse.json({ ok: true, files: saved.map((s) => path.basename(s)) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "upload failed" }, { status: 500 });
  }
}
