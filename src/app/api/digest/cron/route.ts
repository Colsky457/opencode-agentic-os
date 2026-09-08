import { spawn } from "child_process";
import { NextResponse } from "next/server";
import { providerBin, loadConfigSync } from "@/lib/config";

const JOB = "agentic-digest";

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

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? "");
  if (!["pause", "resume", "run"].includes(action)) {
    return NextResponse.json({ ok: false, error: "action must be pause|resume|run" }, { status: 400 });
  }
  const bin = providerBin(loadConfigSync(), "hermes");
  const { out, code } = await sh(bin, ["cron", action, JOB]);
  return NextResponse.json({ ok: code === 0, out: out.slice(0, 2000) });
}
