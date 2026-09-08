"use client";

import Link from "next/link";
import { Card } from "@/components/os/ui";
import { GuideDoc } from "@/components/guide/GuideDoc";
import { FAST_TRACK_MD } from "@/lib/guide";

export default function FastTrackPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href="/guide" className="text-xs opacity-50 hover:opacity-90 hover:underline">← guide hub</Link>
      <Card className="rounded-3xl">
        <GuideDoc md={FAST_TRACK_MD} docKey="fast" />
      </Card>
      <Link href="/guide/lesson/1" className="glass block rounded-3xl p-5 text-center transition hover:scale-[1.01]">
        <div className="text-3xl">🏗️</div>
        <div className="font-display mt-1 font-black">Want the full story? Start the rebuild course →</div>
      </Link>
    </div>
  );
}
