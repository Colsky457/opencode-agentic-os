"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 120, damping: 18 }}
      className={cn("glass rounded-2xl p-4 sm:p-5", className)}
    >
      {children}
    </motion.section>
  );
}

export function SectionTitle({ kicker, title, right }: { kicker: string; title: string; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        <div className="text-[10px] font-semibold tracking-[0.28em] text-[#ff8c42] uppercase">{kicker}</div>
        <h2 className="font-display text-lg font-bold tracking-tight sm:text-xl">{title}</h2>
      </div>
      {right}
    </div>
  );
}

export function EmptyState({ icon, title, hint }: { icon: string; title: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/15 px-4 py-10 text-center">
      <div className="mb-2 text-3xl opacity-60">{icon}</div>
      <div className="font-display font-bold">{title}</div>
      <div className="mx-auto mt-1 max-w-sm text-sm opacity-60">{hint}</div>
    </div>
  );
}

export function Pill({ tone = "neutral", children }: { tone?: "neutral" | "green" | "amber" | "red" | "violet"; children: ReactNode }) {
  const tones = {
    neutral: "border-white/15 bg-white/8",
    green: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",
    amber: "border-amber-400/40 bg-amber-400/10 text-amber-300",
    red: "border-red-400/40 bg-red-400/10 text-red-300",
    violet: "border-[#8b5cf6]/40 bg-[#8b5cf6]/15 text-[#c4b0ff]",
  } as const;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs", tones[tone])}>
      {children}
    </span>
  );
}
