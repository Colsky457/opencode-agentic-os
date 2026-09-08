import { NextResponse } from "next/server";
import { ensureScheduler, executeAutomation } from "@/lib/automations";
import { getAutomations } from "@/lib/store";

/**
 * Git webhook endpoint. Wire it from a post-commit hook, CI, or anything else:
 *   curl -X POST http://127.0.0.1:3000/api/hooks/git \
 *     -H 'Content-Type: application/json' \
 *     -d '{"repo":"my-app","branch":"main"}'
 */
export async function POST(req: Request) {
  ensureScheduler();
  const body = await req.json().catch(() => ({}));
  const repo = typeof body.repo === "string" ? body.repo : typeof body.repository === "string" ? body.repository : "";
  const branch =
    typeof body.branch === "string"
      ? body.branch
      : typeof body.ref === "string"
        ? body.ref.replace(/^refs\/heads\//, "")
        : "";

  const all = await getAutomations();
  const matched = all.filter((a) => {
    if (!a.enabled || a.trigger.kind !== "git") return false;
    if (a.trigger.repo && repo && a.trigger.repo !== repo) return false;
    if (a.trigger.branch && branch && a.trigger.branch !== branch) return false;
    return true;
  });

  const results = await Promise.all(matched.map(async (a) => ({ id: a.id, ...(await executeAutomation(a.id, "git")) })));
  return NextResponse.json({ matched: matched.length, results });
}
