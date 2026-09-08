import { spawn } from "child_process";
import { NextResponse } from "next/server";
import { dayStamp } from "@/lib/brain";
import { loadConfigSync, providerBin } from "@/lib/config";
import { getDigestRuns } from "@/lib/store";

function sh(bin: string, args: string[], timeoutMs = 20000): Promise<string> {
  return new Promise((resolve) => {
    const p = spawn(bin, args, { timeout: timeoutMs, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    p.stdout.on("data", (d) => (out += d.toString()));
    p.on("error", () => resolve(""));
    p.on("close", () => resolve(out));
  });
}

export async function GET() {
  const cfg = loadConfigSync();
  const bin = providerBin(cfg, "hermes");
  const [list, status, runsOut, records] = await Promise.all([
    sh(bin, ["cron", "list"]),
    sh(bin, ["cron", "status"]),
    sh(bin, ["cron", "runs", "--limit", "5"]).catch(() => ""),
    getDigestRuns(),
  ]);
  const today = dayStamp();
  const todays = records.filter((r) => r.date === today);
  const last = records[records.length - 1] ?? null;
  return NextResponse.json({
    date: today,
    digest: cfg.digest ?? null,
    cron: {
      list: list.slice(0, 4000),
      status: status.slice(0, 1000),
      runs: runsOut.slice(0, 4000),
      hasJob: /agentic-digest/i.test(list),
      schedulerUp: /running|active|ok|up\b/i.test(status),
    },
    today: todays[todays.length - 1] ?? null,
    last,
    history: records.slice(-10).reverse(),
  });
}
