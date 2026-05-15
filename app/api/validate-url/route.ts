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

/** Try to validate a single URL. Returns the result or null on hard failure. */
async function checkUrl(url: string): Promise<ValidateResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);

  try {
    const res = await tryHead(url, controller.signal);
    clearTimeout(timer);

    const finalUrl = res.url || url;
    const status = res.status;

    if (status === 404) {
      return { valid: false, finalUrl: null, status, reason: "not_found" };
    }
    if (status >= 200 && status < 300 && !sameDomain(url, finalUrl)) {
      return { valid: false, finalUrl: null, status, reason: "cross_domain_redirect" };
    }
    if (status >= 200 && status < 400) {
      return { valid: true, finalUrl, status, reason: "ok" };
    }
    if (status === 403 || status === 405 || status >= 500) {
      return { valid: true, finalUrl: url, status, reason: "blocked_or_error" };
    }
    return { valid: false, finalUrl: null, status, reason: "unexpected_status" };
  } catch (e) {
    clearTimeout(timer);
    const reason = (e instanceof Error && e.name === "AbortError") ? "timeout" : "network_error";
    return { valid: false, finalUrl: null, status: 0, reason };
  }
}

/**
 * Generate fallback URL variants for common name mismatches.
 * e.g. sanctuarybeachresort.com → thesanctuarybeachresort.com, and vice versa.
 */
function generateUrlVariants(url: string): string[] {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    const parts = host.split(".");
    if (parts.length < 2) return [];

    const name = parts.slice(0, -1).join("."); // e.g. "sanctuarybeachresort"
    const tld = parts.slice(-1)[0]; // e.g. "com"
    const variants: string[] = [];

    // Try adding "the" prefix
    if (!name.startsWith("the")) {
      variants.push(`${parsed.protocol}//www.the${name}.${tld}${parsed.pathname}`);
    }
    // Try removing "the" prefix
    if (name.startsWith("the") && name.length > 3) {
      variants.push(`${parsed.protocol}//www.${name.slice(3)}.${tld}${parsed.pathname}`);
    }
    // Try adding "hotel" suffix
    if (!name.endsWith("hotel")) {
      variants.push(`${parsed.protocol}//www.${name}hotel.${tld}${parsed.pathname}`);
    }
    // Try adding "resort" suffix
    if (!name.endsWith("resort")) {
      variants.push(`${parsed.protocol}//www.${name}resort.${tld}${parsed.pathname}`);
    }

    return variants;
  } catch {
    return [];
  }
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

  // Try the original URL first
  const primary = await checkUrl(url);
  if (primary.valid) {
    return NextResponse.json(primary);
  }

  // If primary fails, try common name variants (the/hotel/resort prefixes/suffixes)
  const variants = generateUrlVariants(url);
  for (const variant of variants) {
    const result = await checkUrl(variant);
    if (result.valid) {
      return NextResponse.json(result);
    }
  }

  // All attempts failed — return the original failure
  return NextResponse.json(primary);
}
