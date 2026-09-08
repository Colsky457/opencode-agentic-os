import { NextResponse } from "next/server";
import { allRunners, getRunner } from "@/lib/runners";
import { gateTool } from "@/lib/tools";
import { logUsage } from "@/lib/store";
import { uid } from "@/lib/utils";

const MODES = {
  review: "Act as a senior code reviewer. Review the response below for correctness, bugs, security issues, and style. Be specific and cite lines where possible.",
  critique: "Act as a sharp critic. Critique the response below: challenge weak reasoning, surface hidden assumptions, and suggest concrete improvements.",
  debug: "Act as a debugging expert. Find flaws, edge cases, and failure modes in the response below, then propose fixes.",
} as const;

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const originalPrompt = String(body.prompt ?? "").trim().slice(0, 4000);
  const responseText = String(body.responseText ?? "").trim().slice(0, 12000);
  const from = String(body.from ?? "unknown");
  const toId = String(body.to ?? "");
  const mode = (["review", "critique", "debug"] as const).includes(body.mode) ? body.mode : "review";

  if (!originalPrompt || !responseText) {
    return NextResponse.json({ error: "prompt and responseText required" }, { status: 400 });
  }
  const reviewer = allRunners().find((r) => r.id === toId);
  if (!reviewer) return NextResponse.json({ error: "unknown reviewer provider" }, { status: 400 });

  const prompt = `${MODES[mode as keyof typeof MODES]}\n\nOriginal user prompt:\n${originalPrompt}\n\nResponse from ${from} to evaluate:\n${responseText}`;
  let text = "";
  try {
    const blocked = await gateTool(`cli:${reviewer.id}`, null, `Arena cross-review (${mode})`);
    if (blocked) return NextResponse.json({ error: blocked.message }, { status: 403 });
    const meta = await getRunner(reviewer.id).chat({
      prompt,
      onDelta: (t) => {
        text += t;
      },
    });
    await logUsage({
      id: uid("u"),
      ts: Date.now(),
      agentId: null,
      sessionId: null,
      inputTokens: meta.inputTokens,
      outputTokens: meta.outputTokens,
      costUsd: meta.costUsd,
      durationMs: meta.durationMs,
      ok: !meta.isError,
      error: meta.errorText ?? undefined,
      provider: reviewer.id,
    });
    if (meta.isError) return NextResponse.json({ error: meta.errorText ?? "review failed" }, { status: 502 });
    return NextResponse.json({
      provider: reviewer.id,
      label: reviewer.label,
      glyph: reviewer.glyph,
      color: reviewer.color,
      mode,
      from,
      text: text || "(empty response)",
      usage: { input: meta.inputTokens, output: meta.outputTokens, cost: meta.costUsd, ms: meta.durationMs },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "review failed" }, { status: 500 });
  }
}
