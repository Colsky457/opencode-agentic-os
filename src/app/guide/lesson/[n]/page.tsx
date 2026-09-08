"use client";

import Link from "next/link";
import { notFound, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Card } from "@/components/os/ui";
import { GuideDoc, PromptBlock } from "@/components/guide/GuideDoc";
import { LESSONS } from "@/lib/guide";
import { cn } from "@/lib/utils";

export default function LessonPage() {
  const params = useParams();
  const n = Number(params.n);
  const lesson = LESSONS.find((l) => l.n === n);
  const [done, setDone] = useState<number[]>([]);

  useEffect(() => {
    fetch("/api/guide").then((r) => r.json()).then((d) => setDone(d.done ?? [])).catch(() => {});
  }, []);

  if (!lesson) return notFound();

  const isDone = done.includes(n);
  const toggleDone = async () => {
    const r = await fetch("/api/guide", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lesson: n, complete: !isDone }),
    }).then((x) => x.json()).catch(() => null);
    if (r?.done) setDone(r.done);
  };

  const prev = LESSONS.find((l) => l.n === n - 1);
  const next = LESSONS.find((l) => l.n === n + 1);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center gap-2 text-xs">
        <Link href="/guide" className="opacity-50 hover:opacity-90 hover:underline">← all lessons</Link>
        <span className="flex-1" />
        <span className="opacity-50">Lesson {n} of {LESSONS.length} · ~{lesson.minutes} min</span>
      </div>

      <Card className="rounded-3xl">
        <GuideDoc md={lesson.body} docKey={`lesson-${n}`} />
        <PromptBlock text={lesson.prompt} />
        <div className="mt-3 flex items-center gap-2 rounded-2xl bg-white/5 px-3.5 py-2.5 text-xs">
          <span className="opacity-50">📁 See it built:</span>
          <code className="font-mono text-[#22e6c8]">{lesson.codeRef.path}</code>
          <span className="opacity-40">({lesson.codeRef.label})</span>
        </div>
        <button
          onClick={toggleDone}
          className={cn(
            "mt-4 w-full rounded-full py-2.5 text-sm font-bold transition hover:scale-[1.01]",
            isDone ? "bg-emerald-500/25 text-emerald-300" : "bg-gradient-to-r from-[#ff6b1a] to-[#ff9a3d] text-white"
          )}
        >
          {isDone ? "✅ Lesson complete — tap to undo" : "Mark lesson complete ✓"}
        </button>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        {prev ? (
          <Link href={`/guide/lesson/${prev.n}`} className="glass rounded-2xl p-3.5 transition hover:scale-[1.01]">
            <div className="text-[11px] opacity-50">← previous</div>
            <div className="truncate text-sm font-bold">{prev.icon} {prev.title}</div>
          </Link>
        ) : <span />}
        {next ? (
          <Link href={`/guide/lesson/${next.n}`} className="glass rounded-2xl p-3.5 text-right transition hover:scale-[1.01]">
            <div className="text-[11px] opacity-50">next →</div>
            <div className="truncate text-sm font-bold">{next.icon} {next.title}</div>
          </Link>
        ) : (
          <Link href="/guide" className="rounded-2xl bg-gradient-to-r from-[#22e6c8] to-[#4da6ff] p-3.5 text-right text-white transition hover:scale-[1.01]">
            <div className="text-[11px] opacity-80">you did it 🎉</div>
            <div className="truncate text-sm font-bold">Back to hub</div>
          </Link>
        )}
      </div>
    </div>
  );
}
