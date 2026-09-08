import net from "net";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const host = searchParams.get("host") || "127.0.0.1";
  const port = Number(searchParams.get("port")) || 3000;
  if (port < 1024 || port > 65535) return NextResponse.json({ ok: false, error: "port must be 1024–65535" });
  const ok = await new Promise<boolean>((resolve) => {
    const srv = net.createServer();
    srv.once("error", () => resolve(false));
    srv.once("listening", () => srv.close(() => resolve(true)));
    srv.listen(port, host);
  });
  return NextResponse.json(ok ? { ok: true } : { ok: false, error: `${host}:${port} is already in use` });
}
