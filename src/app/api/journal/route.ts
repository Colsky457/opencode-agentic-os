import { NextResponse } from "next/server";
import { appendJournalToBrain, dayStamp } from "@/lib/brain";
import { getJournal, saveJournal, type JournalEntry } from "@/lib/store";
import { uid } from "@/lib/utils";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const day = searchParams.get("day");
  const all = await getJournal();
  const list = day ? all.filter((e) => dayStamp(e.ts) === day) : all;
  list.sort((a, b) => b.ts - a.ts);
  return NextResponse.json({ entries: list.slice(0, 200) });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const title = String(body.title ?? "").trim().slice(0, 120) || "Untitled entry";
  const alle = await getJournal();
  const entry: JournalEntry = {
    id: uid("jr"),
    title,
    body: String(body.body ?? "").slice(0, 8000),
    mood: String(body.mood ?? "").slice(0, 24),
    ts: typeof body.ts === "number" ? body.ts : Date.now(),
  };
  alle.push(entry);
  await saveJournal(alle);
  appendJournalToBrain(entry).catch(() => {});
  return NextResponse.json({ entry });
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const all = await getJournal();
  // note: brain daily file keeps history (append-only memory); store entry removed
  await saveJournal(all.filter((e) => e.id !== searchParams.get("id")));
  return NextResponse.json({ ok: true });
}
