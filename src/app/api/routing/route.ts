import { promises as fs } from "fs";
import { NextResponse } from "next/server";
import { CONFIG_FILE, loadConfig } from "@/lib/config";
import { DEFAULT_KEYWORDS, routePrompt, routingConfig } from "@/lib/routing";
import { allRunners } from "@/lib/runners";

export async function GET() {
  const { keywords, fallback } = routingConfig();
  return NextResponse.json({
    keywords,
    fallback,
    providers: allRunners().map((r) => ({ id: r.id, label: r.label, glyph: r.glyph })),
  });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const text = String(body.text ?? "").slice(0, 2000);
  if (!text.trim()) return NextResponse.json({ error: "text required" }, { status: 400 });
  const ids = allRunners().map((r) => r.id);
  const decision = routePrompt(text, ids);
  const runner = allRunners().find((r) => r.id === decision.provider);
  return NextResponse.json({
    provider: decision.provider,
    matched: decision.matched,
    label: runner?.label ?? decision.provider,
    glyph: runner?.glyph ?? "•",
  });
}

export async function PUT(req: Request) {
  const body = await req.json().catch(() => ({}));
  const keywords: Record<string, string[]> = {};
  const raw = body.keywords ?? {};
  for (const id of Object.keys(DEFAULT_KEYWORDS)) {
    const list = raw[id];
    if (list === undefined) continue;
    if (!Array.isArray(list)) return NextResponse.json({ error: `keywords.${id} must be an array` }, { status: 400 });
    keywords[id] = list.map(String).map((s) => s.trim()).filter(Boolean).slice(0, 40);
  }
  let fallback = "claude";
  if (body.fallback !== undefined) {
    if (typeof body.fallback !== "string" || !allRunners().some((r) => r.id === body.fallback)) {
      return NextResponse.json({ error: "unknown fallback provider" }, { status: 400 });
    }
    fallback = body.fallback;
  }

  let file: Record<string, any> = {};
  try {
    file = JSON.parse(await fs.readFile(CONFIG_FILE, "utf8"));
  } catch {}
  const prev = (file.routing ?? {}) as { keywords?: Record<string, string[]>; fallback?: string };
  file.routing = {
    keywords: { ...(prev.keywords ?? {}), ...keywords },
    fallback: body.fallback !== undefined ? fallback : (prev.fallback ?? "claude"),
  };
  await fs.writeFile(CONFIG_FILE, JSON.stringify(file, null, 2) + "\n", "utf8");
  // server picks the new config up automatically (mtime-checked cache)
  return NextResponse.json({ ok: true, ...routingConfig() });
}
