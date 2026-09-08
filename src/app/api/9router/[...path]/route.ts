import { NextRequest, NextResponse } from "next/server";

const UPSTREAM = "http://127.0.0.1:20128";
const PREFIX = "/api/9router";

function rewriteCookies(headers: Headers) {
  const raw = headers.getSetCookie?.() ?? [];
  if (!raw.length) return;
  headers.delete("set-cookie");
  for (const c of raw) {
    const fixed = c
      .replace(/;\s*Secure/gi, "")
      .replace(/;\s*SameSite=\w+/gi, "; SameSite=None");
    headers.append("set-cookie", fixed);
  }
}

function rewriteLocation(loc: string) {
  if (loc.startsWith("/") && !loc.startsWith(PREFIX)) {
    return `${PREFIX}${loc}`;
  }
  return loc;
}

/** Rewrite relative URLs in HTML so they route through this proxy. */
function rewriteHtml(html: string): string {
  return html
    // HTML attributes: href="/_next/...", src="/_next/..."
    .replace(/((?:href|src|action)=["'])\/_next\//g, `$1${PREFIX}/_next/`)
    // RSC flight data inside <script>: "/_next/static/..."
    .replace(/(\\?"|")\/_next\//g, `$1${PREFIX}/_next/`)
    // Other root-relative static assets: /manifest, /favicon, etc.
    .replace(/((?:href|src|action)=["'])\/(?!api\/|_next\/)([a-z])/g, `$1${PREFIX}/$2`);
}

async function proxy(req: NextRequest, path: string) {
  const url = new URL(req.url);
  const target = `${UPSTREAM}/${path}${url.search}`;

  const init: RequestInit = {
    method: req.method,
    headers: { host: new URL(UPSTREAM).host },
    redirect: "manual",
  };

  if (!["GET", "HEAD"].includes(req.method)) {
    init.body = req.body;
    // @ts-expect-error duplex is needed for streaming POST bodies
    init.duplex = "half";
  }

  try {
    const res = await fetch(target, init);
    const contentType = res.headers.get("content-type") || "";
    const isHtml = contentType.includes("text/html");

    const resHeaders = new Headers(res.headers);
    rewriteCookies(resHeaders);
    const loc = resHeaders.get("location");
    if (loc) resHeaders.set("location", rewriteLocation(loc));

    if (isHtml) {
      const html = await res.text();
      const rewritten = rewriteHtml(html);
      resHeaders.delete("content-length");
      return new NextResponse(rewritten, { status: res.status, headers: resHeaders });
    }

    return new NextResponse(res.body, { status: res.status, headers: resHeaders });
  } catch (e: any) {
    return NextResponse.json(
      { error: "9router proxy failed", message: e?.message },
      { status: 502 }
    );
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return proxy(req, path.join("/"));
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return proxy(req, path.join("/"));
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return proxy(req, path.join("/"));
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return proxy(req, path.join("/"));
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return proxy(req, path.join("/"));
}
