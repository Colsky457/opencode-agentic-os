"use client";

import { DashFrame } from "@/components/os/DashFrame";

export default function RouterPage() {
  return (
    <div className="space-y-4">
      <DashFrame
        kicker="gateway"
        title="Router · 9router"
        url="/api/9router/dashboard"
        target="router"
        downHint="9router isn't responding — it normally runs as a background tray process. (Never stop it from here: Hermes' models route through it.)"
        loginHint="Embedded login is blocked by your browser. Open 9router in a full tab to log in."
      />
    </div>
  );
}
