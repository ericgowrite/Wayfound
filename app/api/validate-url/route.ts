import { NextResponse } from "next/server";

export interface ValidateResult {
  valid: boolean;
  finalUrl: string | null;
  status: number;
  reason: string;
}

/** Extract the root domain (e.g. "booking.com" from "www.booking.com") */
function rootDomain(hostname: string): string {
  const parts = hostname.replace(/^www\./, "").split(".");
  return parts.slice(-2).join(".");
}

function sameDomain(urlA: string, urlB: string): boolean {
  try {
    return rootDomain(new URL(urlA).hostname) === rootDomain(new URL(urlB).hostname);
  } catch {
    return false;
  }
}

async function tryHead(url: string, signal: AbortSignal): Promise<Response> {
  const res = await fetch(url, {
    method: "HEAD",
    redirect: "follow",
    signal,
    headers: { "User-Agent": "Mozilla/5.0 (compatible; ViyaWay/1.0)" },
  });
  // Some servers reject HEAD — fall back to GET
  if (res.status === 405) {
    return fetch(url, {
      method: "GET",
      redirect: "follow",
      signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ViyaWay/1.0)" },
    });
  }
  return res;
}

export async function POST(request: Request): Promise<NextResponse<ValidateResult>> {
  let url: string;
  try {
    ({ url } = await request.json());
  } catch {
    return NextResponse.json({ valid: false, finalUrl: null, status: 0, reason: "bad_request" });
  }

  // Sanitise — only allow http/https
  if (!url || !/^https?:\/\//i.test(url)) {
    return NextResponse.json({ valid: false, finalUrl: null, status: 0, reason: "invalid_url" });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);

  try {
    const res = await tryHead(url, controller.signal);
    clearTimeout(timer);

    const finalUrl = res.url || url;
    const status = res.status;

    // 404 → definitively missing
    if (status === 404) {
      return NextResponse.json({ valid: false, finalUrl: null, status, reason: "not_found" });
    }

    // Cross-domain redirect after 200 → suspicious
    if (status >= 200 && status < 300 && !sameDomain(url, finalUrl)) {
      return NextResponse.json({ valid: false, finalUrl: null, status, reason: "cross_domain_redirect" });
    }

    // 2xx same domain, or 3xx to same domain (already followed) → valid
    if (status >= 200 && status < 400) {
      return NextResponse.json({ valid: true, finalUrl, status, reason: "ok" });
    }

    // 403/405/5xx — site exists but blocks crawlers; treat as uncertain but valid
    if (status === 403 || status === 405 || status >= 500) {
      return NextResponse.json({ valid: true, finalUrl: url, status, reason: "blocked_or_error" });
    }

    return NextResponse.json({ valid: false, finalUrl: null, status, reason: "unexpected_status" });
  } catch (e) {
    clearTimeout(timer);
    const reason = (e instanceof Error && e.name === "AbortError") ? "timeout" : "network_error";
    return NextResponse.json({ valid: false, finalUrl: null, status: 0, reason });
  }
}
