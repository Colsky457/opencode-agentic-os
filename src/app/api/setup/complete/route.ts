import { promises as fs } from "fs";
import { NextResponse } from "next/server";
import { CONFIG_FILE, loadConfig } from "@/lib/config";
import { KNOWN_PROVIDERS } from "@/lib/providers";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const current = await loadConfig().catch(() => null);
  const prevProviders = (current?.providers ?? {}) as Record<string, unknown>;

  const bins = (body.bins ?? {}) as Record<string, string>;
  const providers: Record<string, unknown> = { default: String(body.defaultProvider || "claude") };
  for (const { id } of KNOWN_PROVIDERS) {
    const prev = prevProviders[id] as { enabled?: boolean } | undefined;
    providers[id] = {
      bin: String(bins[id] || id),
      enabled: id === "claude" ? true : Boolean(body.enabled?.[id] ?? prev?.enabled ?? false),
    };
  }

  const config = {
    server: {
      host: String(body.host || "127.0.0.1"),
      port: Math.min(65535, Math.max(1024, Number(body.port) || 3000)),
    },
    paths: {
      brain: String(body.vault || "~/brain"),
      data: "./data",
      workspaces: "./workspaces",
    },
    providers,
    chat: current?.chat ?? { models: ["default", "opus", "sonnet", "haiku"], permissionMode: "dontAsk" },
    ui: current?.ui ?? { theme: "system", demoMode: false },
    digest: current?.digest ?? { enabled: true, time: "20:00", noteDir: "Daily Notes", maxChars: 12000, retries: 3, fallback: "claude" },
    platforms: current?.platforms ?? {},
    routing: current?.routing ?? undefined,
  };

  await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2) + "\n", "utf8");
  // server picks the new config up automatically (mtime-checked cache)
  return NextResponse.json({ ok: true, config });
}
