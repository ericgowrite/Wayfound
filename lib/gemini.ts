import { createHash } from "node:crypto";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Profile, ScoredOption, SearchCategory, DeepDiveResult, ChatMessage, LoadingContentItem } from "@/types";
import { v4 as uuidv4 } from "uuid";
import { buildSystemPrompt, auditResponse } from "@/lib/ai-instructions";
import { combineProfiles } from "@/lib/scoring";
import { adminDb } from "@/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";
import { logSearchQuality } from "@/lib/qualityMonitor";

// ── Gemini search result cache ────────────────────────────────────────────────
// Caches searchAndScore() results for 24 hours, keyed by a hash of the query,
// category, combined profile weights, and destination. Same user re-running a
// search, or two users with identical profiles searching the same query, share
// one Gemini call. alignmentScore is recomputed by attachTravelerScores() on
// every hit so scoring stays correct. fitExplanation is the only stale field.

type RawResult = Omit<ScoredOption, "id" | "searchId" | "status" | "notes">;
const SEARCH_CACHE_COLLECTION = "searchQueryCache";
const SEARCH_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function searchCacheKey(
  query: string,
  category: SearchCategory,
  profiles: Profile[],
  destination?: string,
  partySize?: number,
  intent?: string
): string {
  const combined = combineProfiles(profiles);
  const input = JSON.stringify({
    q: query.toLowerCase().trim(),
    cat: category,
    dest: (destination || "").toLowerCase().trim(),
    party: partySize || 1,
    intent: intent || "",
    // Round axis weights to 2dp so tiny float differences don't split entries.
    weights: Object.fromEntries(
      (Object.entries(combined.axisWeights) as [string, number][]).map(
        ([k, v]) => [k, Math.round(v * 100)]
      )
    ),
    dealbreakers: [...combined.dealbreakers].sort(),
    thresholds: combined.thresholds,
  });
  return createHash("sha256").update(input).digest("hex").slice(0, 32);
}

async function getCachedSearch(key: string): Promise<RawResult[] | null> {
  try {
    const doc = await adminDb.collection(SEARCH_CACHE_COLLECTION).doc(key).get();
    if (!doc.exists) return null;
    const d = doc.data()!;
    if ((d.expiresAt as Timestamp).toMillis() < Date.now()) return null;
    const results = d.results as RawResult[];
    // Treat a cached empty array as a miss — a prior Gemini failure shouldn't
    // lock users out for 24 hours.
    if (results.length === 0) return null;
    return results;
  } catch {
    return null; // cache failure is non-fatal — fall through to Gemini
  }
}

async function setCachedSearch(
  key: string,
  query: string,
  category: SearchCategory,
  results: RawResult[]
): Promise<void> {
  // Don't cache empty result sets — a failed Gemini call shouldn't be served
  // to subsequent users for 24 hours.
  if (results.length === 0) return;
  try {
    await adminDb.collection(SEARCH_CACHE_COLLECTION).doc(key).set({
      query,
      category,
      results,
      cachedAt: Timestamp.now(),
      expiresAt: Timestamp.fromMillis(Date.now() + SEARCH_CACHE_TTL_MS),
    });
  } catch {
    // cache write failure is non-fatal
  }
}

// Lazy singleton — initialized on first call so a missing env var surfaces as
// a runtime 500 from the route handler rather than crashing the build.
let _client: GoogleGenerativeAI | null = null;
function getClient(): GoogleGenerativeAI {
  if (!_client) {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) throw new Error("[VIYA] GOOGLE_API_KEY environment variable is not set");
    _client = new GoogleGenerativeAI(apiKey);
  }
  return _client;
}

// ── Retry logic ───────────────────────────────────────────────────────────────

// Errors worth retrying: Gemini capacity spikes and rate limits are transient
const RETRYABLE = /503|high.?demand|overload|429|quota|rate.?limit|resource.?exhaust/i;
const PRIMARY_MODEL = "gemini-2.5-flash";
const FALLBACK_MODEL = "gemini-2.0-flash";
const MAX_ATTEMPTS = 3;   // 1 initial + 2 retries
const BASE_DELAY_MS = 800;

async function withRetry<T>(fn: (model: string) => Promise<T>): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    // Switch to fallback model on the final retry so we get a fresh capacity pool
    const model = attempt < MAX_ATTEMPTS - 1 ? PRIMARY_MODEL : FALLBACK_MODEL;
    try {
      return await fn(model);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!RETRYABLE.test(msg)) throw e; // non-retryable — surface immediately
      lastError = e;
      // Exponential backoff with jitter: 800ms, ~1.6s, (then switches model)
      const delay = BASE_DELAY_MS * Math.pow(2, attempt) + Math.random() * 400;
      console.warn(`[VIYA-AI] Gemini ${model} attempt ${attempt + 1} failed (${msg.slice(0, 60)}…) — retrying in ${Math.round(delay)}ms`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError;
}

// ── Transport helpers ─────────────────────────────────────────────────────────


const GEMINI_TIMEOUT_MS = 30_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Gemini call timed out after ${ms}ms`)), ms)
    ),
  ]);
}

// gemini-2.5-flash thinks by default; disable for structured JSON tasks where
// reasoning tokens add latency without improving output quality.
// Only applies to 2.5 models — 2.0 models don't support thinkingConfig.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function noThinking(model: string): object {
  return model.includes("2.5")
    ? { generationConfig: { thinkingConfig: { thinkingBudget: 0 } } as any }
    : {};
}

async function callWithSearch(systemPrompt: string, userPrompt: string): Promise<{ text: string }> {
  return withRetry(async (model) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const m = getClient().getGenerativeModel({ model, tools: [{ googleSearch: {} } as any], systemInstruction: systemPrompt, ...noThinking(model) });
    const result = await withTimeout(m.generateContent(userPrompt), GEMINI_TIMEOUT_MS);
    return { text: result.response.text() };
  });
}

async function callPlain(systemPrompt: string, userPrompt: string): Promise<string> {
  return withRetry(async (model) => {
    const m = getClient().getGenerativeModel({ model, systemInstruction: systemPrompt, ...noThinking(model) });
    const result = await withTimeout(m.generateContent(userPrompt), GEMINI_TIMEOUT_MS);
    return result.response.text();
  });
}

// ── Parsers ───────────────────────────────────────────────────────────────────

function parseArray(raw: string): Omit<ScoredOption, "id" | "searchId" | "status" | "notes">[] {
  const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  const match = cleaned.match(/\[[\s\S]*\]/);
  if (!match) throw new Error("Could not parse JSON array from Gemini response");
  return JSON.parse(match[0]);
}

function parseObject(raw: string): Omit<ScoredOption, "id" | "searchId" | "status" | "notes"> {
  const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Could not parse JSON object from Gemini response");
  return JSON.parse(match[0]);
}

// ── Sanitizers ────────────────────────────────────────────────────────────────

/**
 * Extract the first valid https?:// URL from a string.
 * Guards against Gemini concatenating multiple URLs into one field.
 */
// Domains confirmed to be spam/redirect aggregators — never use as a source URL.
// When blocked, the client-side Places recovery finds the real property page.
const BLOCKED_SOURCE_DOMAINS = new Set([
  "uzapas.com",
]);

// Redirect script path patterns — these are tracking/affiliate relay scripts,
// not the actual property page. Block regardless of domain.
const REDIRECT_SCRIPT_RE = /\/(xr|r|go|redirect|click|out|track|ref|redir)\.(php|asp|aspx|cgi)\b/i;

function sanitizeSourceUrl(raw: string | undefined): string {
  if (!raw) return "";
  const match = raw.match(/https?:\/\/[^\s"')]+/);
  if (!match) return "";
  const url = match[0].replace(/[.,;)"']+$/, "");

  // Block redirect script patterns (e.g. /xr.php?e=..., /r.php?url=...)
  if (REDIRECT_SCRIPT_RE.test(url)) return "";

  // Block known spam/redirect aggregator domains
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (BLOCKED_SOURCE_DOMAINS.has(host)) return "";
  } catch {
    return "";
  }

  return url;
}

/**
 * Extract a URL explicitly provided by the user in their input string.
 * Matches full https?:// URLs or bare domains (e.g. "aromacoffeeandtea.com").
 * Returns a normalised https:// URL, or null if none found.
 */
export function extractUserUrl(input: string): string | null {
  const fullMatch = input.match(/https?:\/\/[^\s,)]+/);
  if (fullMatch) return fullMatch[0].replace(/[.,;)]+$/, "");

  const bareMatch = input.match(/(?:^|\s)((?:www\.)?[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\/[^\s,)]*)?)/);
  if (bareMatch) return `https://${bareMatch[1].replace(/[.,;)]+$/, "")}`;

  return null;
}

const DEFAULT_AXIS_SCORES = {
  calm: 0.5, designSincerity: 0.5, valueIntegrity: 0.5,
  socialPermeability: 0.5, autonomy: 0.5, novelty: 0.5, locationFriction: 0.5,
};

// Strip Gemini grounding citation markers like [3], [12, 41], [2, 14, 33, 41]
function stripCitations(text: string): string {
  return text.replace(/\s*\[\d+(?:,\s*\d+)*\]/g, "").trim();
}

function hydrate(
  item: Omit<ScoredOption, "id" | "searchId" | "status" | "notes">,
  searchId: string
): ScoredOption {
  return {
    // Spread first so explicit overrides below take precedence
    ...item,
    // Guard every field Gemini might omit on degraded responses
    name: item.name ?? "Unknown",
    description: stripCitations(item.description ?? ""),
    price: item.price ?? "",
    alignmentScore: typeof item.alignmentScore === "number" ? item.alignmentScore : 0,
    fitExplanation: stripCitations(item.fitExplanation ?? ""),
    axisScores: item.axisScores ?? DEFAULT_AXIS_SCORES,
    // Injected fields
    id: uuidv4(),
    searchId,
    status: "new" as const,
    notes: "",
    source: sanitizeSourceUrl(item.source),
    thresholdViolations: (item.thresholdViolations ?? []).map(stripCitations),
    watchOutFor: (item.watchOutFor ?? []).map(stripCitations),
    dealbreakersTriggered: (item.dealbreakersTriggered ?? []).map(stripCitations),
    tradeoffs: (item.tradeoffs ?? []).map(stripCitations),
  };
}

// ── Shared prompt fragments ───────────────────────────────────────────────────

const SOURCE_INSTRUCTION = `"source": "Official property website URL retrieved from search results. Prefer the property's own domain over OTA/aggregator pages (booking.com, tripadvisor.com, expedia.com, hotels.com, marriott.com, etc.). Skip redirect/tracking URLs and sponsored search results. If no official property URL appeared, omit this field entirely."`;

const TEXT_FIELD_RULES = `LANGUAGE RULES for all text fields (fitExplanation, tradeoffs, watchOutFor, description):
- Never use internal axis dimension names: calm, designSincerity, valueIntegrity, socialPermeability, autonomy, novelty, locationFriction.
- Use plain language instead: pace, atmosphere / aesthetic, value for money, social setting, independence, familiarity, convenience.
- Do not mention numeric axis scores or weights.`;

const RESULT_SELECTION_RULE = `RESULT SELECTION: Skip pure sponsored listings, OTA-only booking pages with no property-specific content, and redirect/tracking URLs. Include results that have an identifiable official property website.`;

const AXIS_SCHEMA = `"axisScores": {
    "calm": 0.0-1.0,
    "designSincerity": 0.0-1.0,
    "valueIntegrity": 0.0-1.0,
    "socialPermeability": 0.0-1.0,
    "autonomy": 0.0-1.0,
    "novelty": 0.0-1.0,
    "locationFriction": 0.0-1.0
  }`;

const AXIS_GUIDE = `Axis scoring guide:
CRITICAL: Axis scores describe the PROPERTY'S objective characteristics — what it IS, not how well it matches this traveler.
Score each axis based on the property itself. Do NOT adjust axis scores based on the traveler's type, weights, or preferences.
The same property should receive the same axis scores regardless of who is searching. Personalization is applied mathematically after scoring.

- calm: 0=very high energy/stimulating, 1=very peaceful/calm
- designSincerity: 0=staged/generic/touristy, 1=authentic/genuine
- valueIntegrity: 0=overpriced/poor value, 1=excellent value for money
- socialPermeability: 0=highly social/forced interaction, 1=very private
- autonomy: 0=highly programmed/scheduled, 1=fully self-directed
- novelty: 0=very exotic/unfamiliar, 1=very familiar/predictable
- locationFriction: 0=remote/hard to access, 1=very convenient/easy`;

function thresholdLine(profile: Profile): string {
  const entries = (Object.entries(profile.thresholds) as [string, number | undefined][])
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k} < ${v}`);
  const thresholdStr = entries.length > 0 ? entries.join(", ") : "none";
  return `Profile thresholds (list axis name in thresholdViolations if its score falls below): ${thresholdStr}.
Dealbreakers: ${profile.dealbreakers.join("; ")}`;
}

/**
 * Build profile context for the Gemini prompt.
 *
 * Solo   → returns combined profile JSON + empty group instruction.
 * Group  → returns combined-weights profile for scoring + per-traveler
 *           summaries + instruction to write a group-aware fitExplanation.
 */
function buildGroupContext(profiles: Profile[]): {
  scoringProfile: Profile;
  profileSection: string;
  fitExplanationInstruction: string;
} {
  if (profiles.length === 0) throw new Error("buildGroupContext called with empty profiles array");
  if (profiles.length <= 1) {
    const p = profiles[0];
    return {
      scoringProfile: p,
      profileSection: `TRAVELER PROFILE:\n${JSON.stringify(p, null, 2)}`,
      fitExplanationInstruction: `"fitExplanation": "2-3 sentences explaining why this fits or doesn't fit the profile"`,
    };
  }

  const combined = combineProfiles(profiles);
  const names = profiles.map((p) => p.name).join(" and ");

  // Top-3 axes by weight for each traveler — gives Gemini specific anchors
  const travelerSummaries = profiles
    .map((p) => {
      const topAxes = (Object.entries(p.axisWeights) as [string, number][])
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([k]) => k)
        .join(", ");
      return `  - ${p.name} (${p.enneagramType}): top priorities — ${topAxes}; dealbreakers: ${p.dealbreakers.join("; ")}`;
    })
    .join("\n");

  return {
    scoringProfile: combined,
    profileSection: `GROUP TRIP — ${names}

SCORING PROFILE (combined weights — use for axis scores and alignmentScore):
${JSON.stringify(combined, null, 2)}

INDIVIDUAL TRAVELERS — reference each by name in fitExplanation:
${travelerSummaries}`,
    fitExplanationInstruction: `"fitExplanation": "2-4 sentences covering ALL travelers by name (${names}). Reference what specifically works (or doesn't) for each person based on their individual priorities. Integrate naturally — don't just list. Example structure: 'Works well for both [names]. [Name1] will appreciate [specific fit]. [Name2] benefits from [specific fit]. [Any concern for either traveler].' If profiles are very similar, say so briefly without repeating."`,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

// Trip context (destination, dates, party size) is given as default context.
// The query string overrides destination whenever it already names a different place.
function tripContextLine(
  destination?: string,
  dates?: { start: string; end: string },
  partySize?: number
): string {
  const lines: string[] = [];
  if (destination?.trim()) {
    lines.push(
      `TRIP DESTINATION: ${destination.trim()} — If the query does not already name a different location, search within or near this destination. If the query does name a different location, defer to the query.`
    );
  }
  if (dates?.start && dates?.end) {
    lines.push(`TRIP DATES: ${dates.start} to ${dates.end} — factor this into availability and seasonal relevance when scoring.`);
  }
  if (partySize && partySize > 1) {
    lines.push(`PARTY SIZE: ${partySize} people — factor this into capacity, pricing tier, and suitability.`);
  }
  return lines.length > 0 ? "\n" + lines.join("\n") : "";
}

export async function searchAndScore(
  query: string,
  category: SearchCategory,
  searchId: string,
  profiles: Profile[],
  destination?: string,
  dates?: { start: string; end: string },
  partySize?: number,
  skipCache?: boolean,
  intent?: string
): Promise<ScoredOption[]> {
  // Cache check — dates excluded from key intentionally (24h TTL prevents
  // stale seasonal results; including dates destroys hit rate for re-searches).
  const cacheKey = searchCacheKey(query, category, profiles, destination, partySize, intent);
  if (!skipCache) {
    const cached = await getCachedSearch(cacheKey);
    if (cached) {
      console.log(`[VIYA-AI] search cache hit: "${query}" (${category})`);
      return cached.map((item) => hydrate(item, searchId));
    }
  }

  const systemPrompt = buildSystemPrompt("search");
  const { scoringProfile, profileSection, fitExplanationInstruction } = buildGroupContext(profiles);

  const intentLine = intent
    ? `\nTRAVELER INTENT: "${intent}" — Weight results toward options that genuinely serve this intent alongside the personality profile. Do not reference the intent key literally in output text; let it inform selection and fit scoring naturally.`
    : "";

  const prompt = `
${profileSection}${intentLine}

QUERY: "${query}" (category: ${category})
${tripContextLine(destination, dates, partySize)}

Search the web for this query, then score each result against the profile.

For each option found (aim for 4-8 results), return a JSON array:
[{
  "name": "Option name",
  ${SOURCE_INSTRUCTION},
  "description": "Brief description",
  "price": "Price if available",
  ${AXIS_SCHEMA},
  "alignmentScore": 0-100,
  "thresholdViolations": ["axis names that fall below profile thresholds"],
  "watchOutFor": ["potential concern based on inference — use sparingly, default []"],
  "dealbreakersTriggered": ["confirmed dealbreaker with explicit evidence only — prefer []"],
  ${fitExplanationInstruction},
  "tradeoffs": ["plain language tradeoff — e.g. 'Higher price point for what it offers' not 'low valueIntegrity'"]
}]

Return ONLY a valid JSON array. No markdown, no explanation outside the JSON.

${TEXT_FIELD_RULES}

${RESULT_SELECTION_RULE}

${AXIS_GUIDE}

${thresholdLine(scoringProfile)}`.trim();

  const { text: raw } = await callWithSearch(systemPrompt, prompt);
  auditResponse(raw, "search");
  const items = parseArray(raw);
  // Write to cache before hydrating so the stored items have no UUID fields.
  await setCachedSearch(cacheKey, query, category, items);
  const hydrated = items.map((item) => hydrate(item, searchId));
  // Fire quality audit in background — non-fatal, never blocks the response.
  void logSearchQuality(searchId, query, category, hydrated);
  return hydrated;
}

export async function searchMoreOptions(
  query: string,
  category: SearchCategory,
  searchId: string,
  profiles: Profile[],
  alreadySeen: string[],
  destination?: string,
  dates?: { start: string; end: string },
  partySize?: number
): Promise<ScoredOption[]> {
  const systemPrompt = buildSystemPrompt("moreOptions");
  const { scoringProfile, profileSection, fitExplanationInstruction } = buildGroupContext(profiles);
  const avoidList = alreadySeen.map((n) => `- ${n}`).join("\n");

  const prompt = `
${profileSection}

QUERY: "${query}" (category: ${category})
${tripContextLine(destination, dates, partySize)}

ALREADY SHOWN TO USER — do NOT return these again:
${avoidList}

Search for more options matching this query. Find 4-6 genuinely different options not listed above.
Prioritize results that score highest against this profile's axis weights.
${profiles.length > 1 ? `This is a group trip — find options that work well for all travelers.` : ""}

Return a JSON array using the same structure:
[{
  "name": "Option name",
  ${SOURCE_INSTRUCTION},
  "description": "Brief description",
  "price": "Price if available",
  ${AXIS_SCHEMA},
  "alignmentScore": 0-100,
  "thresholdViolations": ["axis names that fall below profile thresholds"],
  "watchOutFor": ["potential concern based on inference — use sparingly, default []"],
  "dealbreakersTriggered": ["confirmed dealbreaker with explicit evidence only — prefer []"],
  ${fitExplanationInstruction},
  "tradeoffs": ["plain language tradeoff — e.g. 'Higher price point for what it offers' not 'low valueIntegrity'"]
}]

Return ONLY valid JSON array. No markdown.

${TEXT_FIELD_RULES}

${RESULT_SELECTION_RULE}

${AXIS_GUIDE}

${thresholdLine(scoringProfile)}`.trim();

  const { text: raw } = await callWithSearch(systemPrompt, prompt);
  auditResponse(raw, "moreOptions");
  const items = parseArray(raw);
  const hydrated = items.map((item) => hydrate(item, searchId));
  void logSearchQuality(searchId, query, category, hydrated);
  return hydrated;
}

export async function generateComparison(
  options: ScoredOption[],
  profiles: Profile[]
): Promise<string> {
  const systemPrompt = buildSystemPrompt("comparison");
  const isGroup = profiles.length > 1;
  const names = profiles.map((p) => p.name).join(" and ");
  const travelerContext = isGroup
    ? `${names} (group trip)`
    : `${profiles[0]?.name ?? "the traveler"} (Type ${profiles[0]?.enneagramType ?? ""})`;

  const prompt = `Compare these ${options.length} travel options for ${travelerContext}:

${options.map((o, i) => `OPTION ${i + 1}: ${o.name}
- Overall fit: ${o.alignmentScore}%
- Why it fits: ${o.fitExplanation}
- Watch out for: ${o.tradeoffs.join(", ")}`).join("\n\n")}

Write a 3-4 sentence comparison focusing on which option best fits ${isGroup ? `the group (${names})` : "the traveler"} and why.
${isGroup ? `Reference individual travelers by name where their priorities differ.` : ""}
Highlight the key differentiators. Be direct and specific.

CRITICAL RULES:
- Do NOT use any internal dimension names in your response. Never write: calm, designSincerity, valueIntegrity, socialPermeability, autonomy, novelty, locationFriction. Instead use plain language: pace, atmosphere, value, social setting, independence, familiarity, convenience.
- Do NOT mention numeric axis scores or weight values.
- Write in plain conversational language a traveler would understand.`;

  const raw = await callPlain(systemPrompt, prompt);
  auditResponse(raw, "comparison");
  return raw;
}

export async function generateDeepDive(
  option: ScoredOption,
  profiles: Profile[]
): Promise<DeepDiveResult> {
  const systemPrompt = buildSystemPrompt("deepDive");

  const isGroup = profiles.length > 1;
  const names = profiles.map((p) => p.name).join(" and ");
  const travelerIntro = isGroup
    ? `${names} (group trip)`
    : `${profiles[0]?.name ?? "the traveler"} (travel type: ${profiles[0]?.enneagramType ?? ""})`;

  const travelerSummaries = isGroup
    ? `\nINDIVIDUAL TRAVELERS (reference each by name in whyItFits and bottomLine):\n` +
      profiles
        .map((p) => {
          const topAxes = (Object.entries(p.axisWeights) as [string, number][])
            .sort(([, a], [, b]) => b - a)
            .slice(0, 3)
            .map(([k]) => k)
            .join(", ");
          return `  - ${p.name} (${p.enneagramType}): top priorities — ${topAxes}; dealbreakers: ${p.dealbreakers.join("; ")}`;
        })
        .join("\n")
    : "";

  const whyItFitsInstruction = isGroup
    ? `"whyItFits": ["3-6 reasons this option works for the group — reference individual travelers by name where their priorities differ. E.g. '${profiles[0]?.name} will appreciate X, while ${profiles[1]?.name} benefits from Y.' For shared strengths, say 'Both ${names} will appreciate...'"]`
    : `"whyItFits": ["3-5 specific reasons this option aligns with this traveler's style and preferences — write in plain language, do NOT reference axis names or numeric scores"]`;

  const bottomLineInstruction = isGroup
    ? `"bottomLine": "2-3 sentences with a direct group recommendation: should ${names} book it, and why or why not. Note any meaningful difference in fit between the two travelers."`
    : `"bottomLine": "2-3 sentences with a direct recommendation: should this traveler book it, and why or why not"`;

  const prompt = `Do a deep dive on "${option.name}" for ${travelerIntro}.

Search the web for detailed information, recent reviews, and specific details about this option.
Current fit score: ${option.alignmentScore}%
Axis scores (for your internal reasoning only — do NOT mention axis names or numeric scores in your output): ${JSON.stringify(option.axisScores)}
${travelerSummaries}
Return ONLY a valid JSON object with exactly these fields (no markdown, no extra text):
{
  "overview": "2-3 sentences covering location, what it is, any notable awards or recognition, and key facts",
  ${whyItFitsInstruction},
  "watchOutFor": ["1-3 honest cautions, limitations, or tradeoffs to be aware of — note if a concern is specific to one traveler"],
  "standoutFeatures": ["3-5 notable amenities, unique features, or details that make this option distinctive"],
  ${bottomLineInstruction}
}

Each array item should be a single concise bullet (1-2 lines max). Be specific and honest. Never include axis names (calm, designSincerity, valueIntegrity, etc.) or numeric scores in any field.`;

  const { text: raw } = await callWithSearch(systemPrompt, prompt);
  auditResponse(raw, "deepDive");

  try {
    const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]) as DeepDiveResult;
      return {
        overview: stripCitations(parsed.overview ?? ""),
        whyItFits: Array.isArray(parsed.whyItFits) ? parsed.whyItFits.map(stripCitations) : [],
        watchOutFor: Array.isArray(parsed.watchOutFor) ? parsed.watchOutFor.map(stripCitations) : [],
        standoutFeatures: Array.isArray(parsed.standoutFeatures) ? parsed.standoutFeatures.map(stripCitations) : [],
        bottomLine: stripCitations(parsed.bottomLine ?? ""),
      };
    }
  } catch {
    // fall through to text fallback
  }

  // Plain-text fallback
  return {
    overview: raw.slice(0, 600),
    whyItFits: [],
    watchOutFor: [],
    standoutFeatures: [],
    bottomLine: "",
  };
}

export async function scoreSpecific(
  input: string,
  category: SearchCategory,
  searchId: string,
  profiles: Profile[],
  destination?: string,
  dates?: { start: string; end: string },
  partySize?: number
): Promise<ScoredOption> {
  const systemPrompt = buildSystemPrompt("scoreSpecific");
  const { scoringProfile, profileSection, fitExplanationInstruction } = buildGroupContext(profiles);

  // Capture any URL the user explicitly provided — this is authoritative (Sacred Rule 1).
  const userProvidedUrl = extractUserUrl(input);
  const isUrl = input.startsWith("http://") || input.startsWith("https://") || !!userProvidedUrl;

  const prompt = `
${profileSection}

OPTION TO SCORE:
${userProvidedUrl ? `URL: ${userProvidedUrl}` : `"${input}"`}
Category: ${category}
${!isUrl ? tripContextLine(destination, dates, partySize) : ""}

${isUrl ? "Fetch the page and use that content to score this option." : "Search the web for more details about this specific option, then score it."}

Return a single JSON object (not an array):
{
  "name": "Option name",
  ${SOURCE_INSTRUCTION},
  "description": "Brief description (2-3 sentences)",
  "price": "Price if found, otherwise omit",
  ${AXIS_SCHEMA},
  "alignmentScore": 0-100,
  "thresholdViolations": ["axis names below profile thresholds"],
  "watchOutFor": ["potential concern based on inference — use sparingly, default []"],
  "dealbreakersTriggered": ["confirmed dealbreaker with explicit evidence only — prefer []"],
  ${fitExplanationInstruction},
  "tradeoffs": ["plain language tradeoff — e.g. 'Higher price point for what it offers' not 'low valueIntegrity'"]
}

Return ONLY valid JSON. No markdown, no extra text.

${TEXT_FIELD_RULES}

${AXIS_GUIDE}

${thresholdLine(scoringProfile)}`.trim();

  const { text: raw } = await callWithSearch(systemPrompt, prompt);
  auditResponse(raw, "scoreSpecific", { userProvidedUrl });

  const parsed = parseObject(raw);

  // Sacred Rule 1: Always restore user-provided URL — never let Gemini overwrite it.
  if (userProvidedUrl) {
    parsed.source = userProvidedUrl;
  }

  return hydrate(parsed, searchId);
}

export async function chatAboutOption(
  option: ScoredOption,
  profiles: Profile[],
  history: ChatMessage[],
  userMessage: string,
  searchQuery?: string
): Promise<string> {
  const systemPrompt = buildSystemPrompt("chat");

  const isGroup = profiles.length > 1;
  const names = profiles.map((p) => p.name).join(" and ");
  const travelerIntro = isGroup
    ? `${names} (group trip)`
    : `${profiles[0]?.name ?? "the traveler"} (travel type: ${profiles[0]?.enneagramType ?? ""})`;

  const travelerDetails = profiles
    .map((p) => {
      const topAxes = (Object.entries(p.axisWeights) as [string, number][])
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([k]) => k)
        .join(", ");
      return `  - ${p.name} (${p.enneagramType}): top priorities — ${topAxes}; dealbreakers: ${p.dealbreakers.join("; ")}`;
    })
    .join("\n");

  const conversationHistory = history
    .map((m) => `${m.role === "user" ? "User" : "ViyaWay"}: ${m.content}`)
    .join("\n");

  const prompt = `OPTION: ${option.name}
Fit score: ${option.alignmentScore}%
Description: ${option.description}
Fit explanation: ${option.fitExplanation}
Tradeoffs: ${option.tradeoffs.join(", ") || "None noted"}
Price: ${option.price || "Not listed"}
${searchQuery ? `Search query: "${searchQuery}"` : ""}

TRAVELER(S): ${travelerIntro}
${travelerDetails}

${conversationHistory ? `CONVERSATION SO FAR:\n${conversationHistory}\n` : ""}
User: ${userMessage}

Respond helpfully and concisely (2-4 sentences unless more detail is requested). Reference the traveler's profile when relevant.`;

  const raw = await callPlain(systemPrompt, prompt);
  auditResponse(raw, "chat");
  return raw.trim();
}

// ── Loading Screen Content ────────────────────────────────────────────────────

const PERSONALITY_TYPE_REFERENCE = `
Type 1 — The Connoisseur: values craft, purpose, doing things right. Drawn to well-made things. Frustrated by waste or sloppiness. Wants to feel the trip was worth every moment.
Type 2 — The Connector: energized by warmth and human connection. Wants to feel genuinely welcomed. Remembers how a place made them feel, not what it looked like.
Type 3 — The Pathfinder: motivated by quality and the story. Wants the best version of the experience and something worth sharing. Arrives prepared.
Type 4 — The Romantic: craves depth, authenticity, distinctiveness. Wants to feel something real. Avoids the generic. The best stays feel like they were made for them specifically.
Type 5 — The Curator: needs space and intellectual stimulation. Prefers depth over breadth. Recharges alone. Crowds and over-programmed itineraries drain them.
Type 6 — The Grounded: values trust and reliability. Does the research before committing. Feels better with a solid plan. Once they trust somewhere, they return.
Type 7 — The Collector: energized by novelty and options. Spontaneous, open to changing the plan. Hates missing out. Wants more to do than time allows.
Type 8 — The Pioneer: wants significant, real, unpolished experiences. Makes decisions fast. Needs to feel like they earned it. Polished and predictable bores them.
Type 9 — The Harmonist: travels to genuinely restore — not just change location. Needs calm and unhurried pace. Conflict and crowds drain them faster than others. The best trips leave them feeling like themselves again.`.trim();

// Loading content is destination+category scoped and changes rarely — cache 7 days.
const LOADING_CACHE_COLLECTION = "loadingContentCache";
const LOADING_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function loadingCacheKey(destination: string, category: string): string {
  return createHash("sha256")
    .update(`${destination.toLowerCase().trim()}:${category}`)
    .digest("hex")
    .slice(0, 24);
}

async function getCachedLoadingContent(key: string): Promise<LoadingContentItem[] | null> {
  try {
    const doc = await adminDb.collection(LOADING_CACHE_COLLECTION).doc(key).get();
    if (!doc.exists) return null;
    const d = doc.data()!;
    if ((d.expiresAt as Timestamp).toMillis() < Date.now()) return null;
    return d.items as LoadingContentItem[];
  } catch {
    return null;
  }
}

async function setCachedLoadingContent(key: string, items: LoadingContentItem[]): Promise<void> {
  if (items.length === 0) return;
  try {
    await adminDb.collection(LOADING_CACHE_COLLECTION).doc(key).set({
      items,
      cachedAt: Timestamp.now(),
      expiresAt: Timestamp.fromMillis(Date.now() + LOADING_CACHE_TTL_MS),
    });
  } catch {
    // non-fatal
  }
}

/**
 * Fire a lightweight parallel Gemini call (no search grounding) while the
 * main searchAndScore() call is running. Returns 5 loading screen items:
 * 2 destination facts + 3 personality-tailored recommendations.
 * Never throws — callers degrade gracefully to fallback copy.
 */
export async function generateLoadingContent(params: {
  destination: string;
  category: string;
  travelers: { name: string; type: number }[];
}): Promise<LoadingContentItem[]> {
  const { destination, category, travelers } = params;

  const cacheKey = loadingCacheKey(destination, category);
  const cached = await getCachedLoadingContent(cacheKey);
  if (cached) {
    console.log(`[VIYA-AI] loading content cache hit: "${destination}" (${category})`);
    return cached;
  }

  const travelerLines = travelers
    .map((t) => `- ${t.name}: ${t.type ? `Type ${t.type}` : "unknown type"}`)
    .join("\n");

  const prompt = `You are the voice of ViyaWay — a travel app that matches travelers to destinations based on who they actually are. Your job right now: while the user waits for results, say something worth reading.

You are a trusted local friend. The one who actually lives there. The one whose texts you screenshot and send to the group chat before the trip. You know the destination and you know this traveler — and you speak to both without being asked.

You are NOT:
- A travel blogger ("Paris offers an incredible array of cultural experiences")
- A tour operator ("Don't miss the famous Louvre Museum!")
- A chatbot ("Great choice! Here are some fun facts!")
- A review aggregator ("Highly rated by visitors worldwide")

You ARE:
- Specific. You name the place, the neighborhood, the dish, the moment.
- Confident. You don't hedge. You don't say "you might enjoy" or "some travelers find."
- Warm without being precious. You care, but you're not performing care.
- Occasionally playful — but only when it lands naturally, never forced.

THE FILTER: Before you write anything, ask yourself — would a trusted local friend actually say this? If it sounds like a brochure, rewrite it.

DESTINATION: ${destination}
CATEGORY: ${category}
TRAVELERS:
${travelerLines}

PERSONALITY TYPE REFERENCE:
${PERSONALITY_TYPE_REFERENCE}

WHAT TO RETURN — a JSON array of exactly 5 items:

2 DESTINATION FACTS (type: "fact", traveler: null)
- Surprising, specific, genuinely interesting
- Not Wikipedia-obvious. Not generic.
- One sentence that earns its place. A second only if it adds a practical or quietly funny angle.

3 PERSONALITY-TAILORED RECOMMENDATIONS (type: "recommendation")
- Specific and actionable — name a real place, neighborhood, experience, or behavior
- Tied directly to how this traveler type experiences the world
- For group trips: mix across travelers — some for one person ("traveler": name), some for both ("traveler": "both")
- Never average two types into a generic middle
- "traveler" field: the traveler's name (exact match from the list above), "both", or null

VOICE EXAMPLES — study these before writing:
WRONG: "Explore the vibrant local food scene in Belize."
RIGHT: "In Belize, the stewed chicken at a roadside spot will outperform anything with a TripAdvisor badge. Ask a local where they eat on Sundays."

WRONG: "Eric, as someone who values peace and quiet, you might enjoy relaxing activities."
RIGHT: "Eric — you need to actually decompress, not just change location. Caye Caulker has no cars. That's not a quirk, it's the point."

HARD RULES:
- Never say "Enneagram" — speak about the person, not the framework
- Never use emojis
- Never use exclamation points
- Never say "great choice," "amazing," "incredible," "vibrant," "stunning," or "world-class"
- Never be generic enough that the same line could apply to any traveler
- Return only valid JSON — no preamble, no markdown fences, no explanation

Return exactly this shape:
[{"type": "fact"|"recommendation", "traveler": string|null, "text": "..."}]`;

  try {
    const raw = await callPlain("", prompt);
    const cleaned = raw.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (!match) return [];
    const items = JSON.parse(match[0]) as LoadingContentItem[];
    const result = Array.isArray(items) ? items.slice(0, 5) : [];
    void setCachedLoadingContent(cacheKey, result);
    return result;
  } catch {
    return [];
  }
}
