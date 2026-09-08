import { NextResponse } from "next/server";
import { approveTaskStep } from "@/lib/tasks";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const ok = await approveTaskStep(body.id);
  if (!ok) return NextResponse.json({ error: "nothing awaiting approval" }, { status: 409 });
  return NextResponse.json({ ok: true });
}
