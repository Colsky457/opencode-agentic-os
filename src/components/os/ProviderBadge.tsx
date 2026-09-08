"use client";

const KNOWN: Record<string, { glyph: string; label: string; color: string }> = {
  claude: { glyph: "✦", label: "Claude", color: "#ff6b1a" },
  opencode: { glyph: "⬡", label: "opencode", color: "#22e6c8" },
  hermes: { glyph: "☿", label: "Hermes", color: "#c084fc" },
  antigravity: { glyph: "⬔", label: "Antigravity", color: "#6ea8fe" },
};

/** Tiny provider tag: glyph + label, colored dot. Purely presentational. */
export function ProviderBadge({ id, size = "xs" }: { id?: string | null; size?: "xs" | "sm" }) {
  const p = (id && KNOWN[id]) || { glyph: "?", label: id || "unknown", color: "#8b8fa8" };
  return (
    <span
      title={`runs on ${p.label}`}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-semibold ${size === "xs" ? "text-[11px]" : "text-xs"}`}
      style={{ borderColor: `${p.color}55`, background: `${p.color}18`, color: p.color }}
    >
      <span>{p.glyph}</span>
      {p.label}
    </span>
  );
}
