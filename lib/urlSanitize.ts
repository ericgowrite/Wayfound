/**
 * Shared URL sanitization — runs on both server (lib/gemini.ts) and client (ResultCard).
 * Blocks known spam/redirect aggregator domains and affiliate URL patterns
 * before a URL is stored or displayed.
 */

const BLOCKED_DOMAINS = new Set([
  "uzapas.com",
  "onestoparticle.com",
]);

const REDIRECT_PATH_RE = /\/(xr|r|go|redirect|click|out|track|ref|redir|rewarded)\.(php|asp|aspx|cgi)\b|\/(rewarded|bounced|gateway|relay)(\/|\?|$)/i;

const AD_PARAM_RE = /[?&](ctaText|ctaButtonText|ctaImg|clientId=\d|brand=test|destination=[a-z-]+-jobs)/i;

export function isSpamUrl(url: string): boolean {
  if (!url || !/^https?:\/\//i.test(url)) return false;
  if (REDIRECT_PATH_RE.test(url)) return true;
  if (AD_PARAM_RE.test(url)) return true;
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (BLOCKED_DOMAINS.has(host)) return true;
  } catch {
    return true;
  }
  return false;
}

export function sanitizeUrl(url: string | undefined): string {
  if (!url) return "";
  const match = url.match(/https?:\/\/[^\s"')]+/);
  if (!match) return "";
  const cleaned = match[0].replace(/[.,;)"']+$/, "");
  return isSpamUrl(cleaned) ? "" : cleaned;
}
