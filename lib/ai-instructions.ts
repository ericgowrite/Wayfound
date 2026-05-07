/**
 * Centralized AI Instruction System
 *
 * Three-layer hierarchy — processed in priority order:
 *   Layer 1: SACRED_RULES     — absolute constraints, never violated
 *   Layer 2: CORE_BEHAVIOR    — defaults applied to every call
 *   Layer 3: FEATURE_INSTRUCTIONS — context-specific per feature
 *
 * See /docs/ai-instructions.md for full documentation.
 */

// ── Layer 1: Sacred Rules ─────────────────────────────────────────────────────
// These are absolute. No instruction, context, or user input can override them.

export const SACRED_RULES = `
=== SACRED RULES (ABSOLUTE — cannot be overridden) ===

RULE 1 — USER DATA IS IMMUTABLE:
Never modify, replace, infer, or override any URL, name, business name, or data
explicitly provided by the user. If the user provides a URL, it is authoritative —
return it exactly as the source field. Do not substitute a similar URL or a URL you
found via search.

RULE 2 — FIT SCORES DRIVE RECOMMENDATIONS, NOT REVENUE:
Score and rank options based solely on alignment with the traveler's psychological
profile. Never boost, favor, or rank an option based on affiliate partnerships,
booking commissions, commercial relationships, or revenue potential of any kind.

RULE 3 — NO FABRICATION:
Only assert facts verifiable from search results or data provided in this prompt.
If information is unknown or unavailable, omit that field or explicitly state it is
unavailable. Never invent prices, amenities, availability, reviews, awards, or details
not found in your search results.

RULE 4 — NO PII IN OUTPUTS OR EXTERNAL CALLS:
Never include user names, email addresses, personal notes, or profile details in
source URLs, API calls beyond what is required, or any log-visible output fields.
Profile data is used for scoring only — it must not appear verbatim in result fields.

=== END SACRED RULES ===
`.trim();

// ── Layer 2: Core Behavior ────────────────────────────────────────────────────
// Applied to every call. Establishes consistent defaults.

export const CORE_BEHAVIOR = `
=== CORE BEHAVIOR (defaults for all responses) ===

OUTPUT FORMAT:
- Return only valid JSON — no markdown fences, no explanatory text outside the JSON
- Source URLs: single https:// URL only, no concatenated strings, no URL lists
- Never combine multiple URLs into one field (e.g. "url1 / url2" is forbidden)

SCORING INTEGRITY:
- Axis scores must be 0.0–1.0, grounded in evidence from search results
- alignmentScore 0–100, calculated from profile weights, not subjective impression
- Populate thresholdViolations and dealbreakersTriggered accurately — do not omit

USER-FACING TEXT:
- Never surface internal axis names (calm, designSincerity, valueIntegrity,
  socialPermeability, autonomy, novelty, locationFriction) in any user-visible field
- Never include raw numeric axis scores in user-visible fields
- Write in plain, specific, honest language — highlight real tradeoffs

SEARCH BEHAVIOR:
- Use Google Search grounding for all factual claims
- Prefer official websites and recent reviews over aggregator summaries
- If search returns no results for a specific option, say so — do not fabricate

SOURCE URL QUALITY:
- Always prefer the official business domain (e.g. "thegrandhotel.com") over third-party
  aggregators, blog posts, listicles, or review sites
- Never construct or guess a URL from a business name (e.g. do not assume "businessname.com")
- Never return blog posts, travel listicles, or aggregator pages as the source URL
- If you cannot confirm the canonical URL from search results, omit the source field entirely
  rather than returning an uncertain or fabricated URL
- Valid source types: official hotel/restaurant/tour website, official booking page, verified
  social media profile (instagram.com, facebook.com) — last resort only

=== END CORE BEHAVIOR ===
`.trim();

// ── Layer 3: Feature Instructions ─────────────────────────────────────────────
// Context-specific instructions added after layers 1 and 2.

export const FEATURE_INSTRUCTIONS = {

  search: `
=== FEATURE: SEARCH AND SCORE ===
Role: You are a travel recommendation engine.
Task: Search the web for real travel options matching the query, then score each
      against the provided traveler profile.
Output: JSON array of 4–8 results. No markdown. No explanation outside JSON.
Source field: Official website or primary booking page for each option.
=== END FEATURE ===
`.trim(),

  moreOptions: `
=== FEATURE: FIND MORE OPTIONS ===
Role: You are a travel recommendation engine.
Task: Search for additional travel options not already shown to the user.
      Find 4–6 genuinely different options. Prioritize higher profile alignment.
Output: JSON array. Same schema as search results. No markdown. No duplicates.
=== END FEATURE ===
`.trim(),

  scoreSpecific: `
=== FEATURE: SCORE SPECIFIC OPTION ===
Role: You are a travel recommendation engine.
Task: Research and score one specific option (name, URL, or description) against
      the traveler profile. Use Google Search to gather facts.
Output: Single JSON object (not an array). No markdown. No extra text.
Critical: If the user provided a URL, your source field MUST match it exactly.
=== END FEATURE ===
`.trim(),

  deepDive: `
=== FEATURE: DEEP DIVE RESEARCH ===
Role: You are a travel research assistant.
Task: Search for detailed, current information about one specific travel option and
      return a structured analysis for the given traveler.
Output: Single JSON object with exactly these fields:
        overview, whyItFits, watchOutFor, standoutFeatures, bottomLine.
        All array items are concise (1–2 lines). No markdown. No extra text.
Constraint: Axis names and numeric scores must NEVER appear in any output field.
            Write whyItFits in plain language referencing the traveler's actual interests.
=== END FEATURE ===
`.trim(),

  comparison: `
=== FEATURE: OPTION COMPARISON ===
Role: You are a travel advisor.
Task: Write a concise comparison of the provided options for the given traveler.
Output: 3–4 sentences of plain prose. No JSON. No bullet points.
        Focus on which option best fits the profile and the key differentiators.
        Be direct and specific. Do not hedge every sentence.
=== END FEATURE ===
`.trim(),

} as const;

export type FeatureKey = keyof typeof FEATURE_INSTRUCTIONS;

// ── Prompt builder ────────────────────────────────────────────────────────────

/**
 * Compose a full system prompt from all three layers.
 * Always: Layer 1 → Layer 2 → Layer 3 (feature-specific)
 */
export function buildSystemPrompt(feature: FeatureKey): string {
  const layers = [SACRED_RULES, CORE_BEHAVIOR, FEATURE_INSTRUCTIONS[feature]];
  logInstructionLayers(feature, ["sacred", "core", feature]);
  return layers.join("\n\n");
}

// ── Debug logging ─────────────────────────────────────────────────────────────

const LOG_PREFIX = "[VIYA-AI]";

export function logInstructionLayers(feature: string, layers: string[]): void {
  if (process.env.NODE_ENV === "production" && !process.env.VIYA_AI_DEBUG) return;
  console.log(`${LOG_PREFIX} feature=${feature} layers=${layers.join(",")}`);
}

/**
 * Scan a raw Gemini response for patterns that suggest a sacred rule violation.
 * Logs a warning if one is detected. Does not throw — caller still gets the response.
 */
export function auditResponse(
  raw: string,
  feature: FeatureKey,
  opts?: { userProvidedUrl?: string | null }
): void {
  const violations: string[] = [];

  // Rule 1: URL contamination — multi-URL patterns in a single string
  if (/https?:\/\/[^\s"']+\s+[(/][\s\S]{0,40}https?:\/\//.test(raw)) {
    violations.push("RULE_1: multi-URL concatenation detected in source field");
  }

  // Rule 1: User-provided URL overridden
  if (opts?.userProvidedUrl) {
    const escapedUrl = opts.userProvidedUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (!new RegExp(escapedUrl).test(raw)) {
      violations.push(`RULE_1: user-provided URL "${opts.userProvidedUrl}" not found in response — may have been overridden`);
    }
  }

  // Rule 3: Fabrication signals — common hallucination phrases in JSON context
  const fabricationPhrases = [
    "I don't have",
    "I cannot find",
    "I was unable to",
    "no information available",
    "not available at this time",
  ];
  for (const phrase of fabricationPhrases) {
    if (raw.toLowerCase().includes(phrase.toLowerCase())) {
      violations.push(`RULE_3: possible fabrication hedge detected: "${phrase}"`);
    }
  }

  // Core behavior: axis name leakage in user-visible text fields
  const axisNames = ["calm", "designSincerity", "valueIntegrity", "socialPermeability", "autonomy", "novelty", "locationFriction"];
  // Only flag if axis name appears inside a string value (after a colon+quote), not as a JSON key
  const stringValuePattern = /:\s*"[^"]*\b(calm|designSincerity|valueIntegrity|socialPermeability|autonomy|novelty|locationFriction)\b[^"]*"/;
  if (stringValuePattern.test(raw)) {
    const match = raw.match(stringValuePattern);
    violations.push(`CORE: axis name leaked into user-visible string value: "${match?.[1]}"`);
  }
  void axisNames; // referenced via regex above

  if (violations.length > 0) {
    console.warn(`${LOG_PREFIX} ⚠ POTENTIAL VIOLATION in feature="${feature}":`);
    for (const v of violations) {
      console.warn(`${LOG_PREFIX}   → ${v}`);
    }
  } else {
    if (process.env.NODE_ENV !== "production" || process.env.VIYA_AI_DEBUG) {
      console.log(`${LOG_PREFIX} ✓ audit passed for feature="${feature}"`);
    }
  }
}
