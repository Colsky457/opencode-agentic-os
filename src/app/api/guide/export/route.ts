import { NextResponse } from "next/server";
import { exportGuideToBrain, osDir } from "@/lib/brain";
import { GUIDE_META, guideVaultMarkdown } from "@/lib/guide";
import path from "path";

export async function POST() {
  const md = guideVaultMarkdown();
  const p = await exportGuideToBrain(md, GUIDE_META.vaultPath);
  return NextResponse.json({ ok: Boolean(p), path: p ? path.join(osDir(), GUIDE_META.vaultPath) : null });
}
