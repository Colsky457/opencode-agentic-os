import { spawn } from "child_process";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { NextResponse } from "next/server";
import { loadConfigSync } from "@/lib/config";

const JOB = "agentic-digest";
const SCRIPT = "nightly-digest.sh";

function sh(bin: string, args: string[], timeoutMs = 30000): Promise<{ out: string; code: number | null }> {
  return new Promise((resolve) => {
    const p = spawn(bin, args, { timeout: timeoutMs, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    p.stdout.on("data", (d) => (out += d.toString()));
    p.stderr.on("data", (d) => (out += d.toString()));
    p.on("error", (e) => resolve({ out: e.message, code: -1 }));
    p.on("close", (code) => resolve({ out, code }));
  });
}

export async function POST() {
  const steps: string[] = [];
  try {
    const cfg = loadConfigSync();
    const { providerBin } = await import("@/lib/config");
    const bin = providerBin(cfg, "hermes");
    const url = `http://${cfg.server.host}:${cfg.server.port}/api/digest/run`;

    // 1. script with baked-in URL
    const dir = path.join(os.homedir(), ".hermes", "scripts");
    await fs.mkdir(dir, { recursive: true });
    const script = `#!/bin/sh\n# agentic-digest trigger — managed by AgenticOS. Do not edit by hand.\n# Fires POST ${url} (gather → Hermes → fallback → vault note).\ncurl -sf -m 570 -X POST "${url}" -H 'Content-Type: application/json' -d '{}' || echo "digest trigger failed (server down?)"\n`;
    await fs.writeFile(path.join(dir, SCRIPT), script, { mode: 0o755 });
    steps.push(`script → ${path.join(dir, SCRIPT)}`);

    // 2. cron job (skip if present)
    const list = await sh(bin, ["cron", "list"]);
    if (/agentic-digest/i.test(list.out)) {
      steps.push("cron job already exists");
    } else {
      const time = cfg.digest?.time || "20:00";
      const [hh, mm] = time.split(":").map((n) => Number(n));
      const schedule = `${Number.isFinite(mm) ? mm : 0} ${Number.isFinite(hh) ? hh : 20} * * *`;
      const created = await sh(bin, ["cron", "create", schedule, "--name", JOB, "--script", SCRIPT, "--no-agent"]);
      if (created.code !== 0) {
        return NextResponse.json({ ok: false, steps, error: created.out.slice(0, 1000) }, { status: 502 });
      }
      steps.push(`cron job created (${schedule} daily)`);
    }
    return NextResponse.json({ ok: true, steps });
  } catch (e) {
    return NextResponse.json({ ok: false, steps, error: e instanceof Error ? e.message : "install failed" }, { status: 500 });
  }
}
