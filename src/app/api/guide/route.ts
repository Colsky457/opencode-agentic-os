import { NextResponse } from "next/server";
import { getGuideDone, saveGuideDone } from "@/lib/store";

export async function GET() {
  return NextResponse.json({ done: await getGuideDone() });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const n = Number(body.lesson);
  if (!Number.isInteger(n) || n < 1 || n > 6) return NextResponse.json({ error: "bad lesson" }, { status: 400 });
  const done = await getGuideDone();
  const next = body.complete === false ? done.filter((d) => d !== n) : [...new Set([...done, n])];
  await saveGuideDone(next);
  return NextResponse.json({ done: next });
}
