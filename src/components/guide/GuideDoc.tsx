"use client";

import { useEffect, useState } from "react";
import { renderMarkdown } from "@/components/chat/bits";

function loadChecks(key: string): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(`guide-checks:${key}`) ?? "[]"));
  } catch {
    return new Set();
  }
}

/** Markdown doc with tappable checklists (persisted per docKey). */
export function GuideDoc({ md, docKey }: { md: string; docKey: string }) {
  const [checked, setChecked] = useState<Set<string>>(new Set());

  useEffect(() => {
    setChecked(loadChecks(docKey));
  }, [docKey]);

  const toggle = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        localStorage.setItem(`guide-checks:${docKey}`, JSON.stringify([...next]));
      } catch {}
      return next;
    });
  };

  return (
    <div className="space-y-1 text-[15px] leading-relaxed [&_pre]:text-[13px]">
      {renderMarkdown(md, { checked, onToggleCheck: (id) => toggle(id) })}
    </div>
  );
}

export function PromptBlock({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {}
  };
  return (
    <div className="mt-3 overflow-hidden rounded-2xl border border-[#8b5cf6]/35 bg-[#8b5cf6]/8">
      <div className="flex items-center gap-2 px-3.5 pt-3 text-xs font-bold tracking-wide text-[#c4b0ff] uppercase">
        🤖 Paste this into Claude Code
        <span className="flex-1" />
        <button onClick={copy} className="rounded-full bg-[#8b5cf6]/25 px-3 py-1 font-bold normal-case hover:bg-[#8b5cf6]/40">
          {copied ? "✓ copied!" : "copy 📋"}
        </button>
      </div>
      <pre className="term overflow-x-auto p-3.5 whitespace-pre-wrap text-white/85">{text}</pre>
    </div>
  );
}
