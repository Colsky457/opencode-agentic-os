"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useOs } from "@/lib/os-store";

const LINES = [
  "initializing mission control…",
  "linking providers…",
  "waking agent fleet…",
  "mapping shared memory…",
  "systems nominal. welcome, commander.",
];

export function BootSequence() {
  const booted = useOs((s) => s.booted);
  const set = useOs((s) => s.set);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (booted) return;
    if (step >= LINES.length) {
      const t = setTimeout(() => set({ booted: true }), 450);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setStep((s) => s + 1), step === 0 ? 350 : 300);
    return () => clearTimeout(t);
  }, [step, booted, set]);

  if (booted) return null;

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#05060f]"
      exit={{ opacity: 0, scale: 1.04 }}
      transition={{ duration: 0.5 }}
    >
      <div className="w-[min(420px,88vw)]">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl ring-conic p-[2px]"
        >
          <div className="flex h-full w-full items-center justify-center rounded-3xl bg-[#05060f] text-4xl">
            ◈
          </div>
        </motion.div>
        <div className="font-display mb-1 text-center text-2xl font-bold tracking-tight">
          AGENTIC<span className="shimmer-text">OS</span>
        </div>
        <div className="mb-6 text-center text-xs tracking-[0.3em] text-white/40 uppercase">
          mission control
        </div>
        <div className="glass rounded-2xl p-4">
          <div className="term min-h-[132px] text-white/70">
            {LINES.slice(0, step).map((l, i) => (
              <motion.div key={l} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}>
                <span className="text-[#22e6c8]">▸ </span>
                {l}
                {i === step - 1 && step < LINES.length && <span className="stream-caret" />}
              </motion.div>
            ))}
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-[#ff6b1a] via-[#8b5cf6] to-[#22e6c8]"
              animate={{ width: `${(step / LINES.length) * 100}%` }}
              transition={{ type: "spring", stiffness: 120, damping: 20 }}
            />
          </div>
        </div>
        <button
          onClick={() => set({ booted: true })}
          className="mx-auto mt-4 block text-xs text-white/30 hover:text-white/70"
        >
          skip ▸
        </button>
      </div>
    </motion.div>
  );
}
