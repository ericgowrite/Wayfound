/**
 * Server-side URL validation, shared between:
 *  - app/api/validate-url/route.ts (client-triggered, lazy check on card expand)
 *  - app/api/search|score routes (synchronous check before a result is ever
 *    returned to the client — MVP backlog #4, link accuracy)
 */

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

/**
 * Block requests to private/loopback addresses to prevent SSRF.
 * Cloud Run's own metadata endpoint (169.254.169.254) and internal VPC
 * ranges are also covered.
 */
export function isPrivateAddress(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return /^(localhost|127\.|0\.0\.0\.0|::1$|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.|169\.254\.|fc00:|fe80:)/i.test(hostname);
  } catch {
    return true; // unparseable → treat as private
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
export async function checkUrl(url: string): Promise<ValidateResult> {
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
    // Hotel/venue sites frequently block server-side probes (bot detection, GCP IP
    // blocklists). A failed probe is NOT evidence that the URL is wrong — it's
    // evidence the server rejected us. Keep the original URL and let the client-side
    // expand-time check (which uses the real browser) surface any actual bad links.
    return { valid: true, finalUrl: url, status: 0, reason };
  }
}

/**
 * Generate fallback URL variants for common name mismatches.
 * e.g. sanctuarybeachresort.com → thesanctuarybeachresort.com, and vice versa.
 */
export function generateUrlVariants(url: string): string[] {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    const parts = host.split(".");
    if (parts.length < 2) return [];

    const name = parts.slice(0, -1).join("."); // e.g. "sanctuarybeachresort"
    const tld = parts.slice(-1)[0]; // e.g. "com"
    const variants: string[] = [];

    if (!name.startsWith("the")) {
      variants.push(`${parsed.protocol}//www.the${name}.${tld}${parsed.pathname}`);
    }
    if (name.startsWith("the") && name.length > 3) {
      variants.push(`${parsed.protocol}//www.${name.slice(3)}.${tld}${parsed.pathname}`);
    }
    if (!name.endsWith("hotel")) {
      variants.push(`${parsed.protocol}//www.${name}hotel.${tld}${parsed.pathname}`);
    }
    if (!name.endsWith("resort")) {
      variants.push(`${parsed.protocol}//www.${name}resort.${tld}${parsed.pathname}`);
    }

    return variants;
  } catch {
    return [];
  }
}

/** Full check: original URL, then name-variant fallbacks. Mirrors the route's logic. */
export async function checkUrlWithVariants(url: string): Promise<ValidateResult> {
  if (!url || !/^https?:\/\//i.test(url)) {
    return { valid: false, finalUrl: null, status: 0, reason: "invalid_url" };
  }
  if (isPrivateAddress(url)) {
    return { valid: false, finalUrl: null, status: 0, reason: "private_address" };
  }

  const primary = await checkUrl(url);
  if (primary.valid) return primary;

  for (const variant of generateUrlVariants(url)) {
    const result = await checkUrl(variant);
    if (result.valid) return result;
  }

  return primary;
}

/**
 * Build a Google Maps search link as a guaranteed-working fallback.
 * Maps is reliable and shows a rich hotel panel (photos, rating, "Check availability").
 */
export function mapsFallbackUrl(
  propertyName: string,
  destination?: string,
  dates?: { start: string; end: string },
  partySize?: number
): string {
  void dates; void partySize; // reserved for future use when a stable date-aware URL format is confirmed
  const query = destination ? `${propertyName}, ${destination}` : propertyName;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/**
 * Validate a result's source URL before it's ever shown to a user. Returns
 * the validated URL (using the resolved finalUrl if a redirect occurred) or
 * a Maps search fallback if nothing validated. Never returns a known-bad link.
 */
export async function validateOrFallback(
  url: string | undefined,
  propertyName: string,
  destination?: string,
  dates?: { start: string; end: string },
  partySize?: number
): Promise<string> {
  if (!url) return mapsFallbackUrl(propertyName, destination, dates, partySize);
  const result = await checkUrlWithVariants(url);
  if (result.valid && result.finalUrl) return result.finalUrl;
  return mapsFallbackUrl(propertyName, destination, dates, partySize);
}

/**
 * Validate every result's source link before it's returned to the client or
 * persisted — no result should ever reach a user with a known-broken link
 * (MVP backlog #4). Runs in parallel; each result's source is replaced
 * in place with either the validated URL or a Maps fallback.
 */
export async function validateResultLinks<T extends { name: string; source: string }>(
  results: T[],
  destination?: string,
  dates?: { start: string; end: string },
  partySize?: number
): Promise<T[]> {
  return Promise.all(
    results.map(async (r) => ({
      ...r,
      source: await validateOrFallback(r.source, r.name, destination, dates, partySize),
    }))
  );
}
