import { NextResponse } from "next/server";
import { resolveSystemPrompt } from "@/lib/platforms";
import { allRunners, getRunner } from "@/lib/runners";
import { gateTool } from "@/lib/tools";
import { logUsage } from "@/lib/store";
import { uid } from "@/lib/utils";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const prompt = String(body.prompt ?? "").trim().slice(0, 8000);
  if (!prompt) return NextResponse.json({ error: "prompt required" }, { status: 400 });

  const wanted: string[] = Array.isArray(body.providers) ? body.providers.map(String) : [];
  const runners = allRunners().filter((r) => (wanted.length ? wanted.includes(r.id) : true));
  if (!runners.length) return NextResponse.json({ error: "no providers selected" }, { status: 400 });

  const model = typeof body.model === "string" && body.model ? body.model : undefined;
  const userSystem = typeof body.systemPrompt === "string" && body.systemPrompt ? body.systemPrompt : undefined;

  const results = await Promise.all(
    runners.map(async (runner) => {
      const startedAt = Date.now();
      let text = "";
      try {
        const blocked = await gateTool(`cli:${runner.id}`, null, `Arena: ${prompt.slice(0, 120)}`);
        if (blocked) throw blocked;
        const meta = await runner.chat({
          prompt,
          model,
          systemPrompt: resolveSystemPrompt(runner.id, userSystem) || undefined,
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
          provider: runner.id,
        });
        return {
          provider: runner.id,
          label: runner.label,
          glyph: runner.glyph,
          color: runner.color,
          streaming: runner.supportsStreaming,
          ok: !meta.isError,
          text: text || "(empty response)",
          error: meta.errorText ?? null,
          usage: { input: meta.inputTokens, output: meta.outputTokens, cost: meta.costUsd, ms: meta.durationMs },
        };
      } catch (e) {
        const error = e instanceof Error ? e.message : "arena run failed";
        await logUsage({
          id: uid("u"),
          ts: Date.now(),
          agentId: null,
          sessionId: null,
          inputTokens: 0,
          outputTokens: 0,
          costUsd: 0,
          durationMs: Date.now() - startedAt,
          ok: false,
          error,
          provider: runner.id,
        });
        return {
          provider: runner.id,
          label: runner.label,
          glyph: runner.glyph,
          color: runner.color,
          streaming: runner.supportsStreaming,
          ok: false,
          text: "",
          error,
          usage: null,
        };
      }
    })
  );

  return NextResponse.json({ results });
}
