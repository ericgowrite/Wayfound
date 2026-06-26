import { ValidateResult } from "@/app/api/validate-url/route";

const CACHE_KEY_PREFIX = "viya:url-valid:";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const REPORTS_KEY = "viya:url-reports";

interface CacheEntry {
  result: ValidateResult;
  timestamp: number;
}

/** In-memory cache for this session (avoids redundant API calls for same URL) */
const sessionCache = new Map<string, ValidateResult>();

function readLocalCache(url: string): ValidateResult | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY_PREFIX + url);
    if (!raw) return null;
    const entry: CacheEntry = JSON.parse(raw);
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
      localStorage.removeItem(CACHE_KEY_PREFIX + url);
      return null;
    }
    return entry.result;
  } catch {
    return null;
  }
}

function writeLocalCache(url: string, result: ValidateResult): void {
  try {
    const entry: CacheEntry = { result, timestamp: Date.now() };
    localStorage.setItem(CACHE_KEY_PREFIX + url, JSON.stringify(entry));
  } catch {
    // Storage full — ignore
  }
}

/**
 * Validate a source URL.
 * Checks session cache → localStorage cache → server API (in that order).
 * Caches the result for 24 hours.
 */
export async function validateUrl(url: string): Promise<ValidateResult> {
  // 1. Session cache
  const cached = sessionCache.get(url);
  if (cached) return cached;

  // 2. localStorage cache
  const localCached = readLocalCache(url);
  if (localCached) {
    sessionCache.set(url, localCached);
    return localCached;
  }

  // 3. API call
  try {
    const { fetchWithAuth } = await import("@/lib/fetchWithAuth");
    const res = await fetchWithAuth("/api/validate-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const result: ValidateResult = await res.json();
    sessionCache.set(url, result);
    writeLocalCache(url, result);
    return result;
  } catch {
    const fallback: ValidateResult = { valid: false, finalUrl: null, status: 0, reason: "client_error" };
    return fallback;
  }
}

// ── Report Issue ──────────────────────────────────────────────────────────────

export interface UrlReport {
  resultId: string;
  resultName: string;
  reportedUrl: string;
  timestamp: string;
}

/**
 * Log a user-reported bad URL to localStorage.
 * Stored under "viya:url-reports" as a JSON array (newest first, max 200 entries).
 */
export function reportBadUrl(report: UrlReport): void {
  try {
    const existing: UrlReport[] = JSON.parse(localStorage.getItem(REPORTS_KEY) ?? "[]");
    const updated = [report, ...existing].slice(0, 200);
    localStorage.setItem(REPORTS_KEY, JSON.stringify(updated));

    // Also invalidate the cache for this URL so it re-checks next time
    sessionCache.delete(report.reportedUrl);
    localStorage.removeItem(CACHE_KEY_PREFIX + report.reportedUrl);

    console.info("[VIYA] URL reported:", report);
  } catch {
    // ignore storage errors
  }
}

/** Retrieve all stored reports (for debugging / review). */
export function getUrlReports(): UrlReport[] {
  try {
    return JSON.parse(localStorage.getItem(REPORTS_KEY) ?? "[]");
  } catch {
    return [];
  }
}

// ── Link Recovery ─────────────────────────────────────────────────────────────

/**
 * Ask the server to find a replacement URL for a named result via Google Places.
 * Returns null if nothing found or on any error — callers degrade gracefully.
 */
export async function findReplacementUrl(params: {
  name: string;
  category?: string;
  destination?: string;
}): Promise<string | null> {
  try {
    const { fetchWithAuth } = await import("@/lib/fetchWithAuth");
    const res = await fetchWithAuth("/api/find-url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data.url === "string" ? data.url : null;
  } catch {
    return null;
  }
}
