import { promises as fs } from "fs";
import { NextResponse } from "next/server";
import { CONFIG_FILE, loadConfig } from "@/lib/config";
import { DEFAULT_PLATFORMS } from "@/lib/platforms";
import { detectProviders } from "@/lib/providers";
import { getAgents } from "@/lib/store";

async function mergedPlatforms() {
  const cfg = await loadConfig().catch(() => null);
  const over = ((cfg as any)?.platforms ?? {}) as Record<string, { role?: string; systemPrompt?: string }>;
  const detected = await detectProviders().catch(() => []);
  const installed = new Map(detected.map((d) => [d.id, d]));
  const agents = await getAgents().catch(() => []);
  const ids = new Set([...Object.keys(DEFAULT_PLATFORMS), ...Object.keys(over)]);
  return [...ids].map((id) => {
    const o = over[id] ?? {};
    return {
      id,
      role: o.role || DEFAULT_PLATFORMS[id]?.role || `${id} agent`,
      systemPrompt: o.systemPrompt || DEFAULT_PLATFORMS[id]?.systemPrompt || "",
      customized: Boolean(o.role || o.systemPrompt),
      installed: installed.get(id)?.installed ?? null,
      version: installed.get(id)?.version ?? null,
      agents: agents.filter((a) => a.provider === id).map((a) => ({ id: a.id, name: a.name })),
    };
  });
}

export async function GET() {
  return NextResponse.json({ platforms: await mergedPlatforms() });
}

export async function PUT(req: Request) {
  const body = await req.json().catch(() => ({}));
  const id = String(body.id ?? "");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const role = typeof body.role === "string" ? body.role.slice(0, 160) : undefined;
  const systemPrompt = typeof body.systemPrompt === "string" ? body.systemPrompt.slice(0, 8000) : undefined;

  let raw: Record<string, any> = {};
  try {
    raw = JSON.parse(await fs.readFile(CONFIG_FILE, "utf8"));
  } catch {}
  const platforms = { ...(raw.platforms ?? {}) };
  if (body.reset) {
    delete platforms[id];
  } else {
    platforms[id] = {
      ...(platforms[id] ?? {}),
      ...(role !== undefined ? { role } : {}),
      ...(systemPrompt !== undefined ? { systemPrompt } : {}),
    };
    // drop empty overrides so built-ins apply
    if (!platforms[id].role && !platforms[id].systemPrompt) delete platforms[id];
  }
  raw.platforms = platforms;
  await fs.writeFile(CONFIG_FILE, JSON.stringify(raw, null, 2) + "\n", "utf8");
  // server picks the new config up automatically (mtime-checked cache)
  return NextResponse.json({ platforms: await mergedPlatforms() });
}
