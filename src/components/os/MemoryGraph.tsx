"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Card, EmptyState, SectionTitle } from "@/components/os/ui";
import { cn } from "@/lib/utils";

const ForceGraph = dynamic(() => import("react-force-graph-2d"), { ssr: false });

export const TYPE_COLORS: Record<string, string> = {
  agent: "#ff6b1a",
  chat: "#8b5cf6",
  prompt: "#ffd166",
  file: "#22e6c8",
  idea: "#ff4d6d",
};

export interface GraphNode {
  id: string;
  label: string;
  type: string;
  detail?: string;
}

export interface GraphEdge {
  from: string;
  to: string;
  label?: string;
}

/** Shared memory-graph canvas. Self-fetching; bump `refreshSignal` to reload. */
export function MemoryGraph({
  heightClass = "h-[62vh]",
  refreshSignal = 0,
  selectedId,
  onSelect,
  linkToGraph = false,
}: {
  heightClass?: string;
  refreshSignal?: number;
  selectedId?: string | null;
  onSelect?: (node: GraphNode & { name: string }) => void;
  linkToGraph?: boolean;
}) {
  const [graph, setGraph] = useState<{ nodes: GraphNode[]; edges: GraphEdge[] }>({ nodes: [], edges: [] });

  const refresh = useCallback(() => {
    fetch("/api/graph").then((r) => r.json()).then(setGraph).catch(() => {});
  }, []);
  useEffect(refresh, [refresh, refreshSignal]);

  const data = {
    nodes: graph.nodes.map((n) => ({ name: n.label, ...n })),
    links: graph.edges.map((e) => ({ source: e.from, target: e.to, label: e.label })),
  };

  return (
    <Card className="overflow-hidden">
      <SectionTitle
        kicker="memory"
        title="Shared memory graph"
        right={
          <span className="flex items-center gap-2 text-xs opacity-50">
            {graph.nodes.length} nodes · {graph.edges.length} links
            {linkToGraph && (
              <Link href="/graph" className="text-[#ff8c42] opacity-100 hover:underline">
                open ▸
              </Link>
            )}
          </span>
        }
      />
      {graph.nodes.length === 0 ? (
        <EmptyState icon="⋈" title="Memory is empty" hint="Capture ideas, chats, and files as nodes — related items auto-link." />
      ) : (
        <div className={cn("overflow-hidden rounded-xl bg-black/30", heightClass)}>
          <ForceGraph
            graphData={data}
            nodeColor={(n: any) => TYPE_COLORS[n.type] ?? "#fff"}
            nodeLabel={(n: any) => `${n.name}${n.detail ? " — " + n.detail.slice(0, 80) : ""}`}
            linkColor={() => "rgba(255,255,255,0.18)"}
            backgroundColor="rgba(0,0,0,0)"
            onNodeClick={(n: any) => onSelect?.(n)}
            nodeCanvasObject={(n: any, ctx: CanvasRenderingContext2D, area: number) => {
              const r = Math.sqrt(area) * 1.1;
              ctx.fillStyle = TYPE_COLORS[n.type] ?? "#fff";
              ctx.beginPath();
              ctx.arc(n.x, n.y, r + 3, 0, Math.PI * 2);
              ctx.globalAlpha = 0.35;
              ctx.fill();
              ctx.globalAlpha = 1;
              ctx.beginPath();
              ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
              ctx.fill();
              if (selectedId && n.id === selectedId) {
                ctx.strokeStyle = "#fff";
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(n.x, n.y, r + 6, 0, Math.PI * 2);
                ctx.stroke();
              }
              ctx.font = "11px Inter, sans-serif";
              ctx.fillStyle = "#fff";
              ctx.fillText(String(n.name).slice(0, 24), n.x + r + 5, n.y + 4);
            }}
          />
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2 text-[11px] opacity-70">
        {Object.entries(TYPE_COLORS).map(([t, c]) => (
          <span key={t} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: c }} />{t}</span>
        ))}
      </div>
    </Card>
  );
}
