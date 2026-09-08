import { NextResponse } from "next/server";
import { ainodeStats, backfillAinodes } from "@/lib/ainode";
import { loadConfigSync, resolvePath } from "@/lib/config";
import { WORKSPACES_DIR } from "@/lib/store";

export async function GET() {
  return NextResponse.json(ainodeStats());
}

export async function POST() {
  const brain = resolvePath(loadConfigSync().paths.brain);
  const result = await backfillAinodes([WORKSPACES_DIR(), brain]);
  return NextResponse.json({ ...result, ...ainodeStats() });
}
