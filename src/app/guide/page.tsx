"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, SectionTitle } from "@/components/os/ui";
import { GUIDE_META, LESSONS } from "@/lib/guide";

export default function GuideHub() {
  const [done, setDone] = useState<number[]>([]);
  const [exported, setExported] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/guide").then((r) => r.json()).then((d) => setDone(d.done ?? [])).catch(() => {});
  }, []);

  const exportVault = async () => {
    const r = await fetch("/api/guide/export", { method: "POST" }).then((x) => x.json()).catch(() => null);
    if (r?.path) setExported(r.path);
  };

  const pct = Math.round((done.length / LESSONS.length) * 100);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="text-center">
        <div className="text-5xl">📖</div>
        <h1 className="font-display mt-2 text-3xl font-black tracking-tight">{GUIDE_META.title}</h1>
        <p className="mt-1 opacity-60">{GUIDE_META.subtitle}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link href="/guide/fast" className="glass group overflow-hidden rounded-3xl p-5 transition hover:scale-[1.02]">
          <div className="text-4xl transition group-hover:scale-110">🚀</div>
          <div className="font-display mt-2 text-xl font-black">Fast track</div>
          <div className="text-sm opacity-60">Running in ~10 minutes. One page, checkboxes, zero jargon.</div>
          <div className="mt-3 inline-block rounded-full bg-gradient-to-r from-[#ff6b1a] to-[#ff9a3d] px-4 py-1.5 text-xs font-bold text-white">start →</div>
        </Link>
        <Link href="/guide/lesson/1" className="glass group overflow-hidden rounded-3xl p-5 transition hover:scale-[1.02]">
          <div className="text-4xl transition group-hover:scale-110">🏗️</div>
          <div className="font-display mt-2 text-xl font-black">Full rebuild course</div>
          <div className="text-sm opacity-60">{LESSONS.length} lessons with copy-paste prompts for Claude.</div>
          <div className="mt-3 flex items-center gap-2">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
              <motion.div className="h-full rounded-full bg-gradient-to-r from-[#22e6c8] to-[#4da6ff]" animate={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs font-bold">{done.length}/{LESSONS.length}</span>
          </div>
        </Link>
      </div>

      <Card>
        <SectionTitle kicker="course" title="Lessons" right={<span className="text-xs opacity-50">{done.length}/{LESSONS.length} complete</span>} />
        <div className="space-y-1.5">
          {LESSONS.map((l) => (
            <Link key={l.n} href={`/guide/lesson/${l.n}`} className="flex items-center gap-3 rounded-2xl bg-white/5 px-3.5 py-2.5 transition hover:bg-white/10">
              <span className="text-2xl">{done.includes(l.n) ? "✅" : l.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold">Lesson {l.n}: {l.title}</span>
                <span className="block text-[11px] opacity-50">~{l.minutes} min · {l.goals.length} goals</span>
              </span>
              <span className="text-xs opacity-40">→</span>
            </Link>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle kicker="vault" title="Take it with you" />
        <p className="text-sm opacity-60">The whole guide (fast track + all lessons) as one markdown file in your Obsidian vault.</p>
        <button onClick={exportVault} className="mt-2.5 rounded-full bg-gradient-to-r from-[#ff6b1a] to-[#ff9a3d] px-5 py-2 text-sm font-bold text-white transition hover:scale-105">
          🧠 Save guide to vault
        </button>
        {exported && <div className="mt-2 font-mono text-[11px] text-emerald-300">✓ saved → {exported}</div>}
      </Card>
    </div>
  );
}
