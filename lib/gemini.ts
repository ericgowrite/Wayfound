import { createHash } from "node:crypto";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { Profile, ScoredOption, SearchCategory, DeepDiveResult, ChatMessage } from "@/types";
import { v4 as uuidv4 } from "uuid";
import { buildSystemPrompt, auditResponse } from "@/lib/ai-instructions";
import { combineProfiles } from "@/lib/scoring";
import { adminDb } from "@/lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";

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
  partySize?: number
): string {
  const combined = combineProfiles(profiles);
  const input = JSON.stringify({
    q: query.toLowerCase().trim(),
    cat: category,
    dest: (destination || "").toLowerCase().trim(),
    party: partySize || 1,
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

/**
 * Pull domains out of Gemini's search-grounding citations.
 * Note: groundingChunks[].web.uri is typically a Google redirect link
 * (vertexaisearch.cloud.google.com/grounding-api-redirect/...), not the
 * destination domain — so this reads .title instead, which is usually the
 * source's display name or domain. Best-effort signal, not a guarantee.
 */
function extractCitedDomains(candidate: { groundingMetadata?: { groundingChunks?: { web?: { uri?: string; title?: string } }[] } } | undefined): Set<string> {
  const domains = new Set<string>();
  const chunks = candidate?.groundingMetadata?.groundingChunks ?? [];
  for (const chunk of chunks) {
    const title = chunk.web?.title?.toLowerCase().trim();
    if (title) domains.add(title);
    const uri = chunk.web?.uri;
    if (uri) {
      try {
        const host = new URL(uri).hostname.replace(/^www\./, "");
        if (!host.includes("vertexaisearch") && !host.includes("google.com")) domains.add(host);
      } catch {
        // not a parseable URL — skip
      }
    }
  }
  return domains;
}

async function callWithSearch(systemPrompt: string, userPrompt: string): Promise<{ text: string; citedDomains: Set<string> }> {
  return withRetry(async (model) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const m = getClient().getGenerativeModel({ model, tools: [{ googleSearch: {} } as any], systemInstruction: systemPrompt });
    const result = await m.generateContent(userPrompt);
    const citedDomains = extractCitedDomains(result.response.candidates?.[0]);
    return { text: result.response.text(), citedDomains };
  });
}

/**
 * Best-effort cross-check: log a warning when a result's claimed source
 * domain has zero corroboration from any search-grounding citation. This is
 * a soft signal (titles aren't always clean domains) — it informs, doesn't block.
 */
function auditCitedDomain(resultName: string, sourceUrl: string | undefined, citedDomains: Set<string>): void {
  if (!sourceUrl || citedDomains.size === 0) return;
  try {
    const host = new URL(sourceUrl).hostname.replace(/^www\./, "");
    const corroborated = Array.from(citedDomains).some((d) => d.includes(host) || host.includes(d));
    if (!corroborated) {
      console.warn(`[VIYA-AI] source domain "${host}" for "${resultName}" not found in search citations — relying on server-side URL validation as the real check`);
    }
  } catch {
    // unparseable URL — server-side validation will catch it regardless
  }
}

async function callPlain(systemPrompt: string, userPrompt: string): Promise<string> {
  return withRetry(async (model) => {
    const m = getClient().getGenerativeModel({ model, systemInstruction: systemPrompt });
    const result = await m.generateContent(userPrompt);
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
function sanitizeSourceUrl(raw: string | undefined): string {
  if (!raw) return "";
  const match = raw.match(/https?:\/\/[^\s"')]+/);
  if (!match) return "";
  return match[0].replace(/[.,;)"']+$/, "");
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

function hydrate(
  item: Omit<ScoredOption, "id" | "searchId" | "status" | "notes">,
  searchId: string
): ScoredOption {
  return {
    // Spread first so explicit overrides below take precedence
    ...item,
    // Guard every field Gemini might omit on degraded responses
    name: item.name ?? "Unknown",
    description: item.description ?? "",
    price: item.price ?? "",
    alignmentScore: typeof item.alignmentScore === "number" ? item.alignmentScore : 0,
    fitExplanation: item.fitExplanation ?? "",
    axisScores: item.axisScores ?? DEFAULT_AXIS_SCORES,
    // Injected fields
    id: uuidv4(),
    searchId,
    status: "new" as const,
    notes: "",
    source: sanitizeSourceUrl(item.source),
    thresholdViolations: item.thresholdViolations ?? [],
    watchOutFor: item.watchOutFor ?? [],
    dealbreakersTriggered: item.dealbreakersTriggered ?? [],
    tradeoffs: item.tradeoffs ?? [],
  };
}

// ── Shared prompt fragments ───────────────────────────────────────────────────

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
  skipCache?: boolean
): Promise<ScoredOption[]> {
  // Cache check — dates excluded from key intentionally (24h TTL prevents
  // stale seasonal results; including dates destroys hit rate for re-searches).
  const cacheKey = searchCacheKey(query, category, profiles, destination, partySize);
  if (!skipCache) {
    const cached = await getCachedSearch(cacheKey);
    if (cached) {
      console.log(`[VIYA-AI] search cache hit: "${query}" (${category})`);
      return cached.map((item) => hydrate(item, searchId));
    }
  }

  const systemPrompt = buildSystemPrompt("search");
  const { scoringProfile, profileSection, fitExplanationInstruction } = buildGroupContext(profiles);

  const prompt = `
${profileSection}

QUERY: "${query}" (category: ${category})
${tripContextLine(destination, dates, partySize)}

Search the web for this query, then score each result against the profile.

For each option found (aim for 4-8 results), return a JSON array:
[{
  "name": "Option name",
  "source": "full https:// URL to the official website or booking page (required)",
  "description": "Brief description",
  "price": "Price if available",
  ${AXIS_SCHEMA},
  "alignmentScore": 0-100,
  "thresholdViolations": ["axis names that fall below profile thresholds"],
  "watchOutFor": ["potential concern based on inference — use sparingly, default []"],
  "dealbreakersTriggered": ["confirmed dealbreaker with explicit evidence only — prefer []"],
  ${fitExplanationInstruction},
  "tradeoffs": ["tradeoff 1", "tradeoff 2"]
}]

Return ONLY a valid JSON array. No markdown, no explanation outside the JSON.

${AXIS_GUIDE}

${thresholdLine(scoringProfile)}`.trim();

  const { text: raw, citedDomains } = await callWithSearch(systemPrompt, prompt);
  auditResponse(raw, "search");
  const items = parseArray(raw);
  for (const item of items) auditCitedDomain(item.name, item.source, citedDomains);
  // Write to cache before hydrating so the stored items have no UUID fields.
  await setCachedSearch(cacheKey, query, category, items);
  return items.map((item) => hydrate(item, searchId));
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
  "source": "full https:// URL to the official website or booking page (required)",
  "description": "Brief description",
  "price": "Price if available",
  ${AXIS_SCHEMA},
  "alignmentScore": 0-100,
  "thresholdViolations": ["axis names that fall below profile thresholds"],
  "watchOutFor": ["potential concern based on inference — use sparingly, default []"],
  "dealbreakersTriggered": ["confirmed dealbreaker with explicit evidence only — prefer []"],
  ${fitExplanationInstruction},
  "tradeoffs": ["tradeoff 1", "tradeoff 2"]
}]

Return ONLY valid JSON array. No markdown.

${AXIS_GUIDE}

${thresholdLine(scoringProfile)}`.trim();

  const { text: raw, citedDomains } = await callWithSearch(systemPrompt, prompt);
  auditResponse(raw, "moreOptions");
  const items = parseArray(raw);
  for (const item of items) auditCitedDomain(item.name, item.source, citedDomains);
  return items.map((item) => hydrate(item, searchId));
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
- Alignment: ${o.alignmentScore}%
- Fit: ${o.fitExplanation}
- Tradeoffs: ${o.tradeoffs.join(", ")}`).join("\n\n")}

Write a 3-4 sentence comparison focusing on which option best fits ${isGroup ? `the group (${names})` : "the traveler"} and why.
${isGroup ? `Reference individual travelers by name where their priorities differ.` : ""}
Highlight the key differentiators. Be direct and specific.`;

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
        overview: parsed.overview ?? "",
        whyItFits: Array.isArray(parsed.whyItFits) ? parsed.whyItFits : [],
        watchOutFor: Array.isArray(parsed.watchOutFor) ? parsed.watchOutFor : [],
        standoutFeatures: Array.isArray(parsed.standoutFeatures) ? parsed.standoutFeatures : [],
        bottomLine: parsed.bottomLine ?? "",
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
  "source": "full https:// URL to the official website or booking page (required)",
  "description": "Brief description (2-3 sentences)",
  "price": "Price if found, otherwise omit",
  ${AXIS_SCHEMA},
  "alignmentScore": 0-100,
  "thresholdViolations": ["axis names below profile thresholds"],
  "watchOutFor": ["potential concern based on inference — use sparingly, default []"],
  "dealbreakersTriggered": ["confirmed dealbreaker with explicit evidence only — prefer []"],
  ${fitExplanationInstruction},
  "tradeoffs": ["tradeoff 1", "tradeoff 2"]
}

Return ONLY valid JSON. No markdown, no extra text.

${AXIS_GUIDE}

${thresholdLine(scoringProfile)}`.trim();

  const { text: raw, citedDomains } = await callWithSearch(systemPrompt, prompt);
  auditResponse(raw, "scoreSpecific", { userProvidedUrl });

  const parsed = parseObject(raw);
  if (!userProvidedUrl) auditCitedDomain(parsed.name, parsed.source, citedDomains);

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
