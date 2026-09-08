"use client";

import { DashFrame } from "@/components/os/DashFrame";

export default function RouterPage() {
  return (
    <div className="space-y-4">
      <DashFrame
        kicker="gateway"
        title="Router · 9router"
        url="http://127.0.0.1:20128/dashboard"
        target="router"
        downHint="9router isn't responding — it normally runs as a background tray process. (Never stop it from here: Hermes' models route through it.)"
      />
      <p className="text-center text-[11px] opacity-40">
        Change models, keys, and routing inside the panel — or <a href="http://127.0.0.1:20128/dashboard" target="_blank" rel="noreferrer" className="text-[#ff8c42] hover:underline">open in a tab ↗</a>
      </p>
    </div>
  );
}
