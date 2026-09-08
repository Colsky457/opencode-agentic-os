import { NextResponse } from "next/server";
import { dayStamp } from "@/lib/brain";
import { runDigest } from "@/lib/digest";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const day = typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : dayStamp();
  try {
    const result = await runDigest(day);
    return NextResponse.json(result, { status: result.ok ? 200 : 502 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "digest crashed" }, { status: 500 });
  }
}
