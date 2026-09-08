"use client";

import { AgentAvatar } from "@/components/os/AgentAvatar";

/** Tiny markdown-lite renderer: bold, inline code, fences, bullets, checklists, callouts. No deps. */
export function renderMarkdown(
  src: string,
  opts?: { checked?: Set<string>; onToggleCheck?: (id: string, text: string) => void }
) {
  const lines = src.split("\n");
  const out: React.ReactNode[] = [];
  let inFence = false;
  let fence: string[] = [];
  let list: { text: string; check: boolean | null }[] = [];
  let quote: string[] = [];

  const flushList = () => {
    if (list.length) {
      const checks = list.some((li) => li.check !== null);
      out.push(
        <ul key={`ul-${out.length}`} className={checks ? "my-1.5 space-y-1" : "my-1.5 list-disc space-y-0.5 pl-5"}>
          {list.map((li, i) => (
            <li key={i} className={checks ? "flex items-start gap-2 list-none" : undefined}>
              {li.check !== null ? (
                <CheckBox
                  done={opts?.checked?.has(`${out.length}:${li.text}`) ?? li.check}
                  interactive={Boolean(opts?.onToggleCheck)}
                  onClick={() => opts?.onToggleCheck?.(`${out.length}:${li.text}`, li.text)}
                />
              ) : null}
              <span className={li.check !== null ? "opacity-90" : undefined}>{inline(li.text)}</span>
            </li>
          ))}
        </ul>
      );
      list = [];
    }
  };
  const flushQuote = () => {
    if (quote.length) {
      out.push(
        <div key={`q-${out.length}`} className="my-2 rounded-xl border border-[#ffd166]/35 bg-[#ffd166]/8 px-3 py-2 text-[0.95em]">
          {quote.map((q, i) => (
            <p key={i}>{inline(q)}</p>
          ))}
        </div>
      );
      quote = [];
    }
  };
  const flushFence = () => {
    if (fence.length) {
      out.push(
        <pre key={`f-${out.length}`} className="term my-2 overflow-x-auto rounded-xl bg-black/45 p-2.5 text-[12.5px]">
          {fence.join("\n")}
        </pre>
      );
      fence = [];
    }
  };

  lines.forEach((ln, i) => {
    if (ln.trim().startsWith("```")) {
      if (inFence) {
        inFence = false;
        flushFence();
      } else {
        inFence = true;
        flushList();
      }
      return;
    }
    if (inFence) {
      fence.push(ln);
      return;
    }
    const qm = /^>\s?(.*)/.exec(ln);
    if (qm) {
      flushList();
      quote.push(qm[1]);
      return;
    }
    flushQuote();
    const check = /^[-*•]\s+\[([ xX])\]\s+(.*)/.exec(ln);
    if (check) {
      list.push({ text: check[2], check: check[1].toLowerCase() === "x" });
      return;
    }
    const bullet = /^[-*•]\s+(.*)/.exec(ln);
    if (bullet) {
      list.push({ text: bullet[1], check: null });
      return;
    }
    flushList();
    if (!ln.trim()) {
      out.push(<div key={i} className="h-2" />);
      return;
    }
    const h = /^(#{1,3})\s+(.*)/.exec(ln);
    if (h) {
      out.push(
        <div key={i} className="mt-1 font-display font-bold">
          {inline(h[2])}
        </div>
      );
      return;
    }
    out.push(<p key={i}>{inline(ln)}</p>);
  });
  flushList();
  flushQuote();
  flushFence();
  return out;
}

function CheckBox({ done, interactive, onClick }: { done: boolean; interactive: boolean; onClick: () => void }) {
  if (!interactive) {
    return (
      <span
        className={`mt-0.5 flex shrink-0 items-center justify-center rounded-md border text-[11px] font-black ${done ? "border-emerald-400 bg-emerald-400/25 text-emerald-300" : "border-white/30 opacity-70"}`}
        style={{ width: 18, height: 18 }}
      >
        {done ? "✓" : ""}
      </span>
    );
  }
  return (
    <button
      onClick={onClick}
      aria-pressed={done}
      className={`mt-0.5 flex shrink-0 items-center justify-center rounded-md border text-[11px] font-black transition hover:scale-110 ${done ? "border-emerald-400 bg-emerald-400/25 text-emerald-300" : "border-white/30 opacity-70 hover:opacity-100"}`}
      style={{ width: 18, height: 18 }}
    >
      {done ? "✓" : ""}
    </button>
  );
}

function inline(s: string): React.ReactNode[] {
  // `code` and **bold**
  const parts = s.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith("`") && p.endsWith("`") && p.length > 2)
      return (
        <code key={i} className="rounded-md bg-black/35 px-1.5 py-0.5 font-mono text-[0.85em]">
          {p.slice(1, -1)}
        </code>
      );
    if (p.startsWith("**") && p.endsWith("**") && p.length > 4) return <strong key={i}>{p.slice(2, -2)}</strong>;
    return <span key={i}>{p}</span>;
  });
}

export function TypingDots({ label }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 py-1" aria-label={label ?? "typing"}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="inline-block h-2 w-2 rounded-full bg-current opacity-60"
          style={{ animation: `typing-bounce 1.1s ${i * 0.18}s infinite` }}
        />
      ))}
    </span>
  );
}

export function formatClock(ts: number) {
  return new Date(ts).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function dayLabel(ts: number) {
  const d = new Date(ts);
  const today = new Date();
  const yest = new Date(Date.now() - 86400000);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yest.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export function SpeakerAvatar({
  who,
  agent,
  size = 32,
}: {
  who: "user" | "assistant";
  agent?: { id: string; name: string; color: string; avatarSeed?: number; status?: "idle" | "running" | "error" } | null;
  size?: number;
}) {
  if (who === "user") {
    return (
      <span
        className="inline-flex shrink-0 items-center justify-center font-display font-black text-white"
        style={{
          width: size,
          height: size,
          borderRadius: size * 0.34,
          fontSize: size * 0.42,
          background: "linear-gradient(135deg,#3b4160,#1b1f3a)",
          border: "1px solid rgba(255,255,255,.16)",
        }}
      >
        ◉
      </span>
    );
  }
  if (agent) {
    return <AgentAvatar seed={agent.id} seedNum={agent.avatarSeed ?? 0} color={agent.color} name={agent.name} size={size} status={agent.status ?? null} />;
  }
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center text-white"
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.34,
        fontSize: size * 0.44,
        background: "linear-gradient(135deg,#ff6b1a,#8b5cf6)",
        boxShadow: "0 0 14px rgba(255,107,26,.45)",
      }}
    >
      ✦
    </span>
  );
}
