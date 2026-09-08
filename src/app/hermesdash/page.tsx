"use client";

import { DashFrame } from "@/components/os/DashFrame";

export default function HermesDashPage() {
  return (
    <div className="space-y-4">
      <DashFrame
        kicker="console"
        title="Hermes Board"
        url="http://127.0.0.1:9119"
        target="hermes"
        canControl
        downHint="The Hermes web UI isn't running — start it with one tap, or run `hermes dashboard` in a terminal."
      />
    </div>
  );
}
