"use client";

import { useMemo } from "react";
import type { AgentStatus } from "@/lib/store";

/** Deterministic string hash (xfnv1a). SSR-safe: pure function of props. */
function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hexToHsl(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || "");
  if (!m) return [22, 90, 55];
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

const STATUS_DOT: Record<AgentStatus, string> = {
  running: "#34d399",
  idle: "#8b8fa8",
  error: "#f87171",
};

interface Props {
  seed: string;
  seedNum?: number;
  color?: string;
  name?: string;
  size?: number;
  status?: AgentStatus | null;
  ring?: boolean;
}

/**
 * Generative geometric avatar — deterministic SVG from agent id.
 * Gradient anchored on the agent color + one of 6 motifs + initial.
 */
export function AgentAvatar({ seed, seedNum = 0, color = "#ff6b1a", name = "?", size = 44, status = null, ring = true }: Props) {
  const art = useMemo(() => {
    const rnd = mulberry32(hashStr(`${seed}:${seedNum}`));
    const motif = Math.floor(rnd() * 6);
    const [h, s, l] = hexToHsl(color);
    const h2 = (h + 45 + Math.floor(rnd() * 60)) % 360;
    const gid = `g${hashStr(seed).toString(36)}${seedNum}`;
    const shapes: React.ReactNode[] = [];
    const W = "rgba(255,255,255,0.85)";
    const Wf = "rgba(255,255,255,0.28)";
    if (motif === 0) {
      // orbits
      for (let i = 0; i < 3; i++) {
        shapes.push(
          <ellipse key={i} cx="32" cy="32" rx={10 + i * 8 + rnd() * 4} ry={6 + i * 5} fill="none" stroke={i === 1 ? W : Wf} strokeWidth={i === 1 ? 2.4 : 1.4} transform={`rotate(${-30 + rnd() * 60} 32 32)`} />
        );
      }
      shapes.push(<circle key="c" cx={20 + rnd() * 24} cy={18 + rnd() * 28} r="3.4" fill={W} />);
    } else if (motif === 1) {
      // rings
      for (let i = 0; i < 4; i++) {
        shapes.push(<circle key={i} cx="32" cy="32" r={7 + i * 6} fill="none" stroke={i === 2 ? W : Wf} strokeWidth={i === 2 ? 2.4 : 1.4} strokeDasharray={i % 2 ? "4 3" : undefined} />);
      }
    } else if (motif === 2) {
      // peaks
      const y = 40 + rnd() * 8;
      shapes.push(<polyline key="p" points={`6,${y + 8} 20,${y - 12} 30,${y} 42,${y - 18} 58,${y + 8}`} fill="none" stroke={W} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />);
      shapes.push(<circle key="s" cx={44 + rnd() * 8} cy={12 + rnd() * 8} r="3" fill={Wf} />);
    } else if (motif === 3) {
      // grid dots
      for (let x = 0; x < 4; x++)
        for (let y = 0; y < 4; y++) {
          const big = rnd() > 0.72;
          shapes.push(<circle key={`${x}-${y}`} cx={16 + x * 10.5} cy={16 + y * 10.5} r={big ? 3 : 1.5} fill={big ? W : Wf} />);
        }
    } else if (motif === 4) {
      // waves
      for (let i = 0; i < 3; i++) {
        const y = 22 + i * 9;
        shapes.push(<path key={i} d={`M8,${y} Q18,${y - 7} 28,${y} T48,${y} T64,${y}`} fill="none" stroke={i === 1 ? W : Wf} strokeWidth={i === 1 ? 2.6 : 1.5} strokeLinecap="round" transform="translate(-2,0)" />);
      }
    } else {
      // burst
      const cx = 32;
      const cy = 32;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + rnd() * 0.3;
        const r1 = 9;
        const r2 = 15 + rnd() * 9;
        shapes.push(<line key={i} x1={cx + Math.cos(a) * r1} y1={cy + Math.sin(a) * r1} x2={cx + Math.cos(a) * r2} y2={cy + Math.sin(a) * r2} stroke={i % 3 === 0 ? W : Wf} strokeWidth={i % 3 === 0 ? 2.6 : 1.5} strokeLinecap="round" />);
      }
      shapes.push(<circle key="core" cx={cx} cy={cy} r="5" fill={W} />);
    }
    return { shapes, h, s, l, h2, gid };
  }, [seed, seedNum, color]);

  const initial = (name.trim()[0] || "?").toUpperCase();
  const dot = status ? STATUS_DOT[status] : null;

  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        role="img"
        aria-label={`${name} avatar`}
        style={{
          borderRadius: size * 0.32,
          boxShadow: ring ? `0 0 ${size / 2}px ${color}44, inset 0 0 0 1px rgba(255,255,255,.18)` : undefined,
          border: ring ? `1px solid ${color}66` : undefined,
        }}
      >
        <defs>
          <linearGradient id={art.gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={`hsl(${art.h} ${art.s}% ${Math.min(art.l + 8, 62)}%)`} />
            <stop offset="100%" stopColor={`hsl(${art.h2} 75% 42%)`} />
          </linearGradient>
        </defs>
        <rect width="64" height="64" fill={`url(#${art.gid})`} />
        {art.shapes}
        <text x="32" y="42" textAnchor="middle" fontFamily="Space Grotesk, Inter, sans-serif" fontWeight="800" fontSize="24" fill="rgba(255,255,255,0.92)" style={{ textShadow: "0 1px 6px rgba(0,0,0,.4)" }}>
          {initial}
        </text>
      </svg>
      {dot && (
        <span
          title={status ?? ""}
          style={{
            position: "absolute",
            right: -1,
            bottom: -1,
            width: Math.max(10, size * 0.28),
            height: Math.max(10, size * 0.28),
            borderRadius: 99,
            background: dot,
            border: "2px solid #0b0e1d",
            boxShadow: status === "running" ? `0 0 8px ${dot}` : undefined,
          }}
        />
      )}
    </span>
  );
}
