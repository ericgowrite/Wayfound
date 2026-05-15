import { GoogleGenerativeAI } from "@google/generative-ai";
import { Profile, ScoredOption, SearchCategory, DeepDiveResult, ChatMessage } from "@/types";
import { v4 as uuidv4 } from "uuid";
import { buildSystemPrompt, auditResponse } from "@/lib/ai-instructions";
import { combineProfiles } from "@/lib/scoring";

function getClient() {
  return new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);
}

// ── Transport helpers ─────────────────────────────────────────────────────────

async function callWithSearch(systemPrompt: string, userPrompt: string): Promise<string> {
  const model = getClient().getGenerativeModel({
    model: "gemini-2.5-flash",
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tools: [{ googleSearch: {} } as any],
    systemInstruction: systemPrompt,
  });
  const result = await model.generateContent(userPrompt);
  return result.response.text();
}

async function callPlain(systemPrompt: string, userPrompt: string): Promise<string> {
  const model = getClient().getGenerativeModel({
    model: "gemini-2.5-flash",
    systemInstruction: systemPrompt,
  });
  const result = await model.generateContent(userPrompt);
  return result.response.text();
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
function extractUserUrl(input: string): string | null {
  const fullMatch = input.match(/https?:\/\/[^\s,)]+/);
  if (fullMatch) return fullMatch[0].replace(/[.,;)]+$/, "");

  const bareMatch = input.match(/(?:^|\s)((?:www\.)?[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\/[^\s,)]*)?)/);
  if (bareMatch) return `https://${bareMatch[1].replace(/[.,;)]+$/, "")}`;

  return null;
}

function hydrate(
  item: Omit<ScoredOption, "id" | "searchId" | "status" | "notes">,
  searchId: string
): ScoredOption {
  return {
    ...item,
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

export async function searchAndScore(
  query: string,
  category: SearchCategory,
  searchId: string,
  profiles: Profile[]
): Promise<ScoredOption[]> {
  const systemPrompt = buildSystemPrompt("search");
  const { scoringProfile, profileSection, fitExplanationInstruction } = buildGroupContext(profiles);

  const prompt = `
${profileSection}

QUERY: "${query}" (category: ${category})

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

  const raw = await callWithSearch(systemPrompt, prompt);
  auditResponse(raw, "search");
  return parseArray(raw).map((item) => hydrate(item, searchId));
}

export async function searchMoreOptions(
  query: string,
  category: SearchCategory,
  searchId: string,
  profiles: Profile[],
  alreadySeen: string[]
): Promise<ScoredOption[]> {
  const systemPrompt = buildSystemPrompt("moreOptions");
  const { scoringProfile, profileSection, fitExplanationInstruction } = buildGroupContext(profiles);
  const avoidList = alreadySeen.map((n) => `- ${n}`).join("\n");

  const prompt = `
${profileSection}

QUERY: "${query}" (category: ${category})

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

  const raw = await callWithSearch(systemPrompt, prompt);
  auditResponse(raw, "moreOptions");
  return parseArray(raw).map((item) => hydrate(item, searchId));
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

  const raw = await callWithSearch(systemPrompt, prompt);
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
  profiles: Profile[]
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

  const raw = await callWithSearch(systemPrompt, prompt);
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
