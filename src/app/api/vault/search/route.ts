import { NextResponse } from "next/server";
import { searchVault } from "@/lib/vault";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") ?? "").trim().slice(0, 500);
  if (!q) return NextResponse.json({ hits: [], embedded: false });
  const k = Math.max(1, Math.min(12, Number(searchParams.get("k")) || 6));
  const { hits, embedded } = await searchVault(q, k);
  return NextResponse.json({ hits, embedded });
}
