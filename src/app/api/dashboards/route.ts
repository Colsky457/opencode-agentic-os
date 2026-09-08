import { spawn } from "child_process";
import { NextResponse } from "next/server";
import { loadConfigSync, providerBin } from "@/lib/config";

const HERMES_URL = "http://127.0.0.1:9119";
const ROUTER_URL = "http://127.0.0.1:20128/dashboard";

async function probe(url: string, ms = 4000): Promise<boolean> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(ms), redirect: "manual" });
    return r.status < 500;
  } catch {
    return false;
  }
}

export async function GET() {
  const [hermesUp, routerUp] = await Promise.all([probe(HERMES_URL), probe(ROUTER_URL)]);
  return NextResponse.json({
    hermes: { up: hermesUp, url: HERMES_URL },
    router: { up: routerUp, url: ROUTER_URL },
  });
}

function sh(bin: string, args: string[], waitMs = 25000): Promise<{ code: number | null; out: string }> {
  return new Promise((resolve) => {
    const p = spawn(bin, args, { timeout: waitMs, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    p.stdout.on("data", (d) => (out += d.toString()));
    p.stderr.on("data", (d) => (out += d.toString()));
    p.on("error", (e) => resolve({ code: null, out: e.message }));
    p.on("close", (code) => resolve({ code, out: out.slice(-2000) }));
  });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  if (body.target !== "hermes" || !["start", "stop"].includes(body.action)) {
    return NextResponse.json({ error: "only hermes start|stop is supported" }, { status: 400 });
  }
  const bin = providerBin(loadConfigSync(), "hermes");
  if (body.action === "stop") {
    const r = await sh(bin, ["dashboard", "--stop"]);
    return NextResponse.json({ ok: r.code === 0, out: r.out });
  }
  // start: fire-and-forget — the CLI daemonizes its own processes; don't hold the request
  const child = spawn(bin, ["dashboard"], { detached: true, stdio: "ignore" });
  child.on("error", () => {});
  child.unref();
  return NextResponse.json({ ok: true });
}
