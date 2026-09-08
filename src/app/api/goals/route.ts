import { NextResponse } from "next/server";
import { syncGoalsIndex, type BrainGoal } from "@/lib/brain";
import { getGoals, saveGoals, type Goal } from "@/lib/store";
import { uid } from "@/lib/utils";

const toBrain = (g: Goal): BrainGoal => ({
  id: g.id,
  title: g.title,
  notes: g.notes,
  status: g.status,
  due: g.due || undefined,
  createdAt: g.createdAt,
  updatedAt: g.updatedAt,
});

const sync = (goals: Goal[]) => {
  syncGoalsIndex(goals.map(toBrain)).catch(() => {});
};

export async function GET() {
  const goals = await getGoals();
  goals.sort((a, b) => {
    const rank = (s: Goal["status"]) => (s === "active" ? 0 : s === "done" ? 1 : 2);
    return rank(a.status) - rank(b.status) || b.updatedAt - a.updatedAt;
  });
  // heal: ensure the vault index exists even if goals only ever read
  sync(goals);
  return NextResponse.json({ goals });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const title = String(body.title ?? "").trim().slice(0, 120);
  if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });
  const goals = await getGoals();
  const now = Date.now();
  const g: Goal = {
    id: uid("goal"),
    title,
    notes: String(body.notes ?? "").slice(0, 4000),
    status: "active",
    due: String(body.due ?? "").slice(0, 20),
    createdAt: now,
    updatedAt: now,
  };
  goals.unshift(g);
  await saveGoals(goals);
  sync(goals);
  return NextResponse.json({ goal: g });
}

export async function PATCH(req: Request) {
  const body = await req.json().catch(() => ({}));
  const goals = await getGoals();
  const g = goals.find((x) => x.id === body.id);
  if (!g) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (typeof body.title === "string" && body.title.trim()) g.title = body.title.trim().slice(0, 120);
  if (typeof body.notes === "string") g.notes = body.notes.slice(0, 4000);
  if (["active", "done", "archived"].includes(body.status)) g.status = body.status;
  if (typeof body.due === "string") g.due = body.due.slice(0, 20);
  g.updatedAt = Date.now();
  await saveGoals(goals);
  sync(goals);
  return NextResponse.json({ goal: g });
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const goals = await getGoals();
  const kept = goals.filter((x) => x.id !== searchParams.get("id"));
  await saveGoals(kept);
  sync(kept);
  return NextResponse.json({ ok: true });
}
