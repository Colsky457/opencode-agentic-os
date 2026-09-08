import { NextResponse } from "next/server";
import { getPrompts, savePrompts, type PromptTemplate } from "@/lib/store";
import { uid } from "@/lib/utils";

export async function GET() {
  return NextResponse.json({ prompts: await getPrompts() });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const prompts = await getPrompts();
  const p: PromptTemplate = {
    id: uid("pr"),
    title: String(body.title ?? "Untitled").slice(0, 80),
    body: String(body.body ?? "").slice(0, 8000),
    tags: Array.isArray(body.tags) ? body.tags.map(String).slice(0, 8) : [],
    uses: 0,
    createdAt: Date.now(),
  };
  prompts.unshift(p);
  await savePrompts(prompts);
  return NextResponse.json({ prompt: p });
}

export async function PATCH(req: Request) {
  const body = await req.json().catch(() => ({}));
  const prompts = await getPrompts();
  const p = prompts.find((x) => x.id === body.id);
  if (!p) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (typeof body.title === "string") p.title = body.title.slice(0, 80);
  if (typeof body.body === "string") p.body = body.body.slice(0, 8000);
  if (Array.isArray(body.tags)) p.tags = body.tags.map(String).slice(0, 8);
  if (body.used) p.uses += 1;
  await savePrompts(prompts);
  return NextResponse.json({ prompt: p });
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const prompts = await getPrompts();
  await savePrompts(prompts.filter((p) => p.id !== searchParams.get("id")));
  return NextResponse.json({ ok: true });
}
