import { NextResponse } from "next/server";
import { configExists, loadConfig } from "@/lib/config";
import { detectProviders } from "@/lib/providers";

export async function GET() {
  const [exists, cfg, providers] = await Promise.all([
    configExists(),
    loadConfig().catch(() => null),
    detectProviders(),
  ]);
  return NextResponse.json({
    needsSetup: !exists,
    providers,
    config: cfg
      ? {
          server: cfg.server,
          paths: cfg.paths,
          defaultProvider: typeof cfg.providers.default === "string" ? cfg.providers.default : "claude",
          bins: Object.fromEntries(
            Object.entries(cfg.providers)
              .filter(([, v]) => v && typeof v === "object")
              .map(([k, v]) => [k, (v as { bin: string }).bin])
          ),
        }
      : null,
  });
}
