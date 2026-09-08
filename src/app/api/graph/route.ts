import { NextResponse } from "next/server";
import { autoLink, getGraph, saveGraph } from "@/lib/store";
import { uid } from "@/lib/utils";

export async function GET() {
  return NextResponse.json(await getGraph());
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const g = await getGraph();
  const node = {
    id: uid("n"),
    label: String(body.label ?? "Untitled").slice(0, 120),
    type: (["agent", "chat", "prompt", "file", "idea"] as const).includes(body.type) ? body.type : ("idea" as const),
    detail: String(body.detail ?? "").slice(0, 500),
  };
  g.nodes.push(node);
  autoLink(node.label, g.nodes, g.edges, node.id);
  if (body.linksTo) {
    for (const t of (Array.isArray(body.linksTo) ? body.linksTo : [body.linksTo]).map(String).slice(0, 5)) {
      if (g.nodes.some((n) => n.id === t)) g.edges.push({ from: node.id, to: t, label: String(body.linkLabel ?? "linked") });
    }
  }
  await saveGraph(g);
  return NextResponse.json({ node });
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const g = await getGraph();
  g.nodes = g.nodes.filter((n) => n.id !== id);
  g.edges = g.edges.filter((e) => e.from !== id && e.to !== id);
  await saveGraph(g);
  return NextResponse.json({ ok: true });
}
