import { NextResponse } from "next/server";
import { indexProgress, indexStats, indexVault } from "@/lib/vault";

export async function GET() {
  const [stats, prog] = [await indexStats(), indexProgress()];
  return NextResponse.json({ ...stats, progress: prog });
}

export async function POST() {
  const prog = indexProgress();
  if (prog.running) return NextResponse.json({ started: false, reason: "already running", progress: prog });
  // fire and forget — UI polls GET for progress
  void indexVault().catch(() => {});
  return NextResponse.json({ started: true });
}
