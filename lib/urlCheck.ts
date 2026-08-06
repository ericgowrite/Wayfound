/**
 * Server-side URL validation, shared between:
 *  - app/api/validate-url/route.ts (client-triggered, lazy check on card expand)
 *  - app/api/search|score routes (synchronous check before a result is ever
 *    returned to the client — MVP backlog #4, link accuracy)
 *
 * CACHING: checkUrlWithVariants() is cache-first. Results are stored in the
 * urlValidationCache Firestore collection keyed by hostname for 30 days.
 * Cache hits skip all outbound HTTP — this is the primary cost-reduction
 * mechanism for URL validation egress.
 *
 * LAZY VALIDATION (separate change, not yet implemented):
 * Removing validateResultLinks() from api/search and api/search/more routes
 * and relying solely on the client calling /api/validate-url on card expand
 * would eliminate all synchronous validation egress. The infrastructure
 * (/api/validate-url route + this cache) is already in place. Deferring
 * until product sign-off on showing unvalidated links in initial results.
 */

import { adminDb } from "@/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import { isSpamUrl } from "@/lib/urlSanitize";

const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const CACHE_COLLECTION = "urlValidationCache";

/** Hostname-based cache key — strips www, ignores path/query so all
 *  paths under the same host share one entry. */
function domainCacheKey(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.slice(0, 200); // unparseable: use raw string, truncated
  }
}

async function getCachedValidation(url: string): Promise<ValidateResult | null> {
  try {
    const doc = await adminDb.collection(CACHE_COLLECTION).doc(domainCacheKey(url)).get();
    if (!doc.exists) return null;
    const d = doc.data()!;
    if ((d.expiresAt as Timestamp).toMillis() < Date.now()) return null;
    return { valid: d.isValid, finalUrl: d.finalUrl ?? null, status: d.status ?? 0, reason: "cached" };
  } catch {
    return null; // cache read failure is non-fatal — fall through to live check
  }
}

async function setCachedValidation(url: string, result: ValidateResult): Promise<void> {
  try {
    const now = Timestamp.now();
    await adminDb.collection(CACHE_COLLECTION).doc(domainCacheKey(url)).set({
      domain: domainCacheKey(url),
      isValid: result.valid,
      finalUrl: result.finalUrl,
      status: result.status,
      reason: result.reason,
      lastChecked: now,
      expiresAt: Timestamp.fromMillis(Date.now() + CACHE_TTL_MS),
    });
  } catch {
    // cache write failure is non-fatal
  }
}

export interface ValidateResult {
  valid: boolean;
  finalUrl: string | null;
  status: number;
  reason: string;
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
    headers: { "User-Agent": "Mozilla/5.0 (compatible; Wayfound/1.0)" },
  });
  // Some servers reject HEAD — fall back to GET
  if (res.status === 405) {
    return fetch(url, {
      method: "GET",
      redirect: "follow",
      signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Wayfound/1.0)" },
    });
  }
  return res;
}

// ── Content validation ────────────────────────────────────────────────────────

const GENERIC_WORDS = new Set([
  "hotel", "hotels", "resort", "resorts", "inn", "lodge", "motel", "suites",
  "spa", "the", "a", "an", "and", "of", "at", "in", "by", "de", "el", "la",
  "le", "les", "los", "las", "del", "restaurant", "restaurants", "cafe",
  "bar", "bistro", "grill", "kitchen", "house", "club", "villa", "villas",
  "boutique", "collection", "properties", "property", "group",
]);

/** Extract the distinctive tokens from a property name for content matching. */
export function distinctiveTokens(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !GENERIC_WORDS.has(w));
}

/** Pull text from title/h1/og:title/twitter:title/meta description/JSON-LD out of raw HTML. */
function extractPageSignals(html: string): string {
  // Strip HTML tags from a captured group so nested elements don't cause empty matches
  const stripTags = (s: string) => s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

  const title = stripTags(html.match(/<title[^>]*>([\s\S]{0,400}?)<\/title>/i)?.[1] ?? "");
  const h1 = stripTags(html.match(/<h1[^>]*>([\s\S]{0,200}?)<\/h1>/i)?.[1] ?? "");
  const ogTitle =
    html.match(/property=["']og:title["'][^>]*content=["']([^"']{0,200})["']/i)?.[1] ??
    html.match(/content=["']([^"']{0,200})["'][^>]*property=["']og:title["']/i)?.[1] ?? "";
  const twitterTitle =
    html.match(/name=["']twitter:title["'][^>]*content=["']([^"']{0,200})["']/i)?.[1] ??
    html.match(/content=["']([^"']{0,200})["'][^>]*name=["']twitter:title["']/i)?.[1] ?? "";
  const metaDesc =
    html.match(/name=["']description["'][^>]*content=["']([^"']{0,300})["']/i)?.[1] ??
    html.match(/content=["']([^"']{0,300})["'][^>]*name=["']description["']/i)?.[1] ?? "";
  // JSON-LD "name" field — covers schema.org Hotel, Restaurant, TouristAttraction, etc.
  const jsonLdName = (html.match(/"name"\s*:\s*"([^"]{1,200})"/gi) ?? [])
    .map((m) => m.replace(/^"name"\s*:\s*"/i, "").replace(/"$/, ""))
    .join(" ");

  return [title, h1, ogTitle, twitterTitle, metaDesc, jsonLdName]
    .join(" ")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ");
}

const PARKED_SIGNALS = [
  "domain for sale", "buy this domain", "this domain is for sale",
  "domain parking", "parked domain", "godaddy", "sedoparking",
  "hugedomains", "dan.com", "afternic", "flippa",
  "coming soon", "under construction",
];

/**
 * After a URL resolves successfully, fetch its HTML and verify the property
 * name appears in the page signals (title / h1 / og:title / meta description).
 * Returns false if the page looks parked/wrong, true if it looks correct or
 * if we can't tell (bot-blocked, timeout, non-HTML).
 */
async function contentMatchesProperty(url: string, propertyName: string): Promise<boolean> {
  const tokens = distinctiveTokens(propertyName);
  if (tokens.length === 0) return true; // can't evaluate — don't block

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);

  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Wayfound/1.0)",
        "Accept": "text/html",
        "Range": "bytes=0-10000", // request only the first ~10KB
      },
    });
    clearTimeout(timer);

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) return true; // PDF, redirect to app store, etc. — don't block

    const text = await res.text();
    const html = text.slice(0, 12000); // guard against Range header being ignored

    const pageText = extractPageSignals(html);

    // Hard fail: page is clearly a parked domain
    if (PARKED_SIGNALS.some((sig) => pageText.includes(sig))) return false;

    // Soft fail: none of the distinctive property tokens appear anywhere in the page signals
    const anyTokenFound = tokens.some((t) => pageText.includes(t));
    return anyTokenFound;
  } catch (e) {
    clearTimeout(timer);
    // DNS failure = domain doesn't exist → block it
    const causeCode: string = (e as { cause?: { code?: string } })?.cause?.code ?? "";
    if (causeCode === "ENOTFOUND" || causeCode === "EAI_AGAIN") return false;
    // Other failures (timeout, ECONNREFUSED) = real domain, bot-blocked → pass through
    return true;
  }
}

/** Try to validate a single URL. Returns the result or null on hard failure. */
export async function checkUrl(url: string, propertyName?: string): Promise<ValidateResult> {
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
    if (status >= 200 && status < 400) {
      // URL resolves — now verify the page is actually for this property.
      if (propertyName) {
        const matches = await contentMatchesProperty(finalUrl, propertyName);
        if (!matches) {
          return { valid: false, finalUrl: null, status, reason: "content_mismatch" };
        }
      }
      return { valid: true, finalUrl, status, reason: "ok" };
    }
    if (status === 403 || status === 405 || status >= 500) {
      // Server rejected our probe — can't content-validate, assume valid.
      return { valid: true, finalUrl: url, status, reason: "blocked_or_error" };
    }
    return { valid: false, finalUrl: null, status, reason: "unexpected_status" };
  } catch (e) {
    clearTimeout(timer);
    // DNS resolution failure = domain doesn't exist = definitively wrong URL.
    // Distinguish from bot-blocking (ECONNREFUSED, timeout) where the domain IS real.
    const causeCode: string = (e as { cause?: { code?: string } })?.cause?.code ?? "";
    if (causeCode === "ENOTFOUND" || causeCode === "EAI_AGAIN") {
      return { valid: false, finalUrl: null, status: 0, reason: "dns_failure" };
    }
    const reason = (e instanceof Error && e.name === "AbortError") ? "timeout" : "network_error";
    // network_error / timeout = server rejected our probe (bot detection, GCP blocklist).
    // The domain is real; we just can't verify content. Keep the URL.
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

/** Full check: cache first, then original URL, then name-variant fallbacks.
 *  Results (valid or invalid) are cached for 30 days by hostname. */
export async function checkUrlWithVariants(url: string, propertyName?: string): Promise<ValidateResult> {
  if (!url || !/^https?:\/\//i.test(url)) {
    return { valid: false, finalUrl: null, status: 0, reason: "invalid_url" };
  }
  if (isPrivateAddress(url)) {
    return { valid: false, finalUrl: null, status: 0, reason: "private_address" };
  }

  // Skip cache when content validation is possible — a hostname cached as "valid"
  // before content checking was introduced may be a parked domain.
  // Cache is still used for speed on known-good domains.
  const cached = await getCachedValidation(url);
  if (cached && cached.reason !== "content_mismatch") return cached;

  const primary = await checkUrl(url, propertyName);
  if (primary.valid) {
    await setCachedValidation(url, primary);
    return primary;
  }

  for (const variant of generateUrlVariants(url)) {
    const result = await checkUrl(variant, propertyName);
    if (result.valid) {
      await setCachedValidation(url, result);
      return result;
    }
  }

  await setCachedValidation(url, primary);
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
  const result = await checkUrlWithVariants(url, propertyName);
  if (result.valid && result.finalUrl && !isSpamUrl(result.finalUrl)) return result.finalUrl;
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
