"use client";

import { useTheme } from "next-themes";
import { useEffect, useRef } from "react";

/** Lightweight canvas starfield/particles. Disabled for reduced motion + light mode. */
export function ParticleField({ density = 70 }: { density?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const { resolvedTheme } = useTheme();

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (resolvedTheme === "light") return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let w = (canvas.width = canvas.offsetWidth);
    let h = (canvas.height = canvas.offsetHeight);
    const onResize = () => {
      w = canvas.width = canvas.offsetWidth;
      h = canvas.height = canvas.offsetHeight;
    };
    window.addEventListener("resize", onResize);

    const colors = ["#ff6b1a", "#8b5cf6", "#22e6c8", "#ffd166", "#ffffff"];
    const pts = Array.from({ length: density }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() * 1.8 + 0.4,
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.25,
      c: colors[Math.floor(Math.random() * colors.length)],
      a: Math.random() * 0.6 + 0.15,
      tw: Math.random() * Math.PI * 2,
    }));

    const tick = () => {
      ctx.clearRect(0, 0, w, h);
      for (const p of pts) {
        p.x += p.vx;
        p.y += p.vy;
        p.tw += 0.02;
        if (p.x < 0) p.x = w;
        if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h;
        if (p.y > h) p.y = 0;
        ctx.globalAlpha = p.a * (0.6 + 0.4 * Math.sin(p.tw));
        ctx.fillStyle = p.c;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, [density, resolvedTheme]);

  return <canvas ref={ref} className="pointer-events-none absolute inset-0 h-full w-full opacity-70" />;
}
