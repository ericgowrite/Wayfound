import Anthropic from "@anthropic-ai/sdk";
import { Profile, ScoredOption, SearchCategory } from "@/types";
import { v4 as uuidv4 } from "uuid";

function getClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

const SEARCH_SYSTEM_PROMPT = `You are a travel recommendation engine that performs two tasks in one call:
1. Web search: Find real travel options matching the query
2. Psychological scoring: Score each option against the user's profile

You have access to a web_search tool. Use it to find relevant travel options.
After searching, score each found option against the user's psychological travel profile.`;

export async function searchAndScore(
  query: string,
  category: SearchCategory,
  searchId: string,
  profile: Profile
): Promise<ScoredOption[]> {
  const scoringInstructions = `
PROFILE:
${JSON.stringify(profile, null, 2)}

QUERY: "${query}" (category: ${category})

After searching the web for this query, score each result against the profile.

For each option found (aim for 4-8 results), return a JSON array with this structure:
{
  "name": "Option name",
  "source": "URL or source",
  "description": "Brief description",
  "price": "Price if available",
  "axisScores": {
    "calm": 0.0-1.0,
    "designSincerity": 0.0-1.0,
    "valueIntegrity": 0.0-1.0,
    "socialPermeability": 0.0-1.0,
    "autonomy": 0.0-1.0,
    "novelty": 0.0-1.0,
    "locationFriction": 0.0-1.0
  },
  "alignmentScore": 0-100,
  "thresholdViolations": ["axis names that fall below profile thresholds"],
  "dealbreakersTriggered": ["dealbreaker descriptions if any apply"],
  "fitExplanation": "2-3 sentences explaining why this fits or doesn't fit Eric's profile",
  "tradeoffs": ["tradeoff 1", "tradeoff 2"]
}

Return ONLY a valid JSON array. No markdown, no explanation outside the JSON.

Axis scoring guide:
- calm: 0 = very high energy/stimulating, 1 = very peaceful/calm
- designSincerity: 0 = staged/generic/touristy, 1 = authentic/genuine
- valueIntegrity: 0 = overpriced/poor value, 1 = excellent value for money
- socialPermeability: 0 = highly social/forced interaction, 1 = very private
- autonomy: 0 = highly programmed/scheduled, 1 = fully self-directed
- novelty: 0 = very exotic/unfamiliar, 1 = very familiar/predictable
- locationFriction: 0 = remote/hard to access, 1 = very convenient/easy

Profile thresholds: if calm < ${profile.thresholds.calm ?? "N/A"} or valueIntegrity < ${profile.thresholds.valueIntegrity ?? "N/A"}, list in thresholdViolations.
Dealbreakers: ${profile.dealbreakers.join("; ")}`;

  const response = await getClient().messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8096,
    tools: [
      {
        type: "web_search_20250305",
        name: "web_search",
        max_uses: 3,
      } as unknown as Anthropic.Tool,
    ],
    system: SEARCH_SYSTEM_PROMPT,
    messages: [{ role: "user", content: scoringInstructions }],
  });

  // Extract the final text response (after tool use)
  const textBlocks = response.content.filter((b) => b.type === "text");
  if (textBlocks.length === 0) throw new Error("No text response from Claude");

  const rawText = textBlocks[textBlocks.length - 1].text;

  // Parse JSON from response
  const jsonMatch = rawText.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error("Could not parse JSON from Claude response");

  const parsed = JSON.parse(jsonMatch[0]) as Omit<
    ScoredOption,
    "id" | "searchId" | "status" | "notes"
  >[];

  return parsed.map((item) => ({
    ...item,
    id: uuidv4(),
    searchId,
    status: "new" as const,
    notes: "",
    thresholdViolations: item.thresholdViolations ?? [],
    dealbreakersTriggered: item.dealbreakersTriggered ?? [],
    tradeoffs: item.tradeoffs ?? [],
  }));
}

export async function searchMoreOptions(
  query: string,
  category: SearchCategory,
  searchId: string,
  profile: Profile,
  alreadySeen: string[]
): Promise<ScoredOption[]> {
  const avoidList = alreadySeen.map((n) => `- ${n}`).join("\n");

  const prompt = `
PROFILE:
${JSON.stringify(profile, null, 2)}

QUERY: "${query}" (category: ${category})

ALREADY SHOWN TO USER — do NOT return these again:
${avoidList}

Search for more options matching this query. Find 4-6 genuinely different options not listed above.
Prioritize results that score highest against this profile's axis weights.
${profile.id === "combined" ? `This is a combined profile for multiple travelers — find options that work well for everyone.` : ""}

Return a JSON array using the same structure as before:
[{
  "name": "Option name",
  "source": "URL or source",
  "description": "Brief description",
  "price": "Price if available",
  "axisScores": { "calm": 0.0-1.0, "designSincerity": 0.0-1.0, "valueIntegrity": 0.0-1.0, "socialPermeability": 0.0-1.0, "autonomy": 0.0-1.0, "novelty": 0.0-1.0, "locationFriction": 0.0-1.0 },
  "alignmentScore": 0-100,
  "thresholdViolations": [],
  "dealbreakersTriggered": [],
  "fitExplanation": "2-3 sentences",
  "tradeoffs": ["tradeoff 1", "tradeoff 2"]
}]

Return ONLY valid JSON array. No markdown.`;

  const response = await getClient().messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8096,
    tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 3 } as unknown as Anthropic.Tool],
    system: SEARCH_SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
  });

  const textBlocks = response.content.filter((b) => b.type === "text");
  if (textBlocks.length === 0) throw new Error("No response from Claude");

  const rawText = textBlocks[textBlocks.length - 1].text;
  const jsonMatch = rawText.match(/\[[\s\S]*\]/);
  if (!jsonMatch) throw new Error("Could not parse JSON from response");

  const parsed = JSON.parse(jsonMatch[0]) as Omit<ScoredOption, "id" | "searchId" | "status" | "notes">[];

  return parsed.map((item) => ({
    ...item,
    id: uuidv4(),
    searchId,
    status: "new" as const,
    notes: "",
    thresholdViolations: item.thresholdViolations ?? [],
    dealbreakersTriggered: item.dealbreakersTriggered ?? [],
    tradeoffs: item.tradeoffs ?? [],
  }));
}

export async function generateComparison(
  options: ScoredOption[],
  profile: Profile
): Promise<string> {
  const prompt = `Compare these ${options.length} travel options for ${profile.name} (Type ${profile.enneagramType}):

${options.map((o, i) => `OPTION ${i + 1}: ${o.name}
- Alignment: ${o.alignmentScore}%
- Axis scores: ${JSON.stringify(o.axisScores)}
- Fit: ${o.fitExplanation}
- Tradeoffs: ${o.tradeoffs.join(", ")}`).join("\n\n")}

Write a 3-4 sentence comparison summary focusing on which option best fits Eric's profile and why.
Highlight the key differentiators. Be direct and specific.`;

  const response = await getClient().messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 512,
    messages: [{ role: "user", content: prompt }],
  });

  return response.content[0].type === "text" ? response.content[0].text : "";
}

export async function generateDeepDive(
  option: ScoredOption,
  profile: Profile
): Promise<string> {
  const response = await getClient().messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    tools: [
      {
        type: "web_search_20250305",
        name: "web_search",
        max_uses: 2,
      } as unknown as Anthropic.Tool,
    ],
    messages: [
      {
        role: "user",
        content: `Do a deep dive on "${option.name}" for ${profile.name} (Type ${profile.enneagramType}).

Search for more detailed information, recent reviews, and specific details.
Then write a detailed 4-6 sentence analysis of whether this is a good fit, including:
- What makes it unique
- Specific pros/cons for a Type ${profile.enneagramType} traveler
- Any red flags or standout features
- Overall recommendation

Current fit score: ${option.alignmentScore}%`,
      },
    ],
  });

  const textBlocks = response.content.filter((b) => b.type === "text");
  return textBlocks.length > 0 ? textBlocks[textBlocks.length - 1].text : "";
}

const SCORE_SYSTEM_PROMPT = `You are a travel recommendation engine. The user has given you a specific travel option to evaluate.
Research it using web search if needed, then score it against their psychological profile.
Return a single JSON object (not an array).`;

export async function scoreSpecific(
  input: string,
  category: SearchCategory,
  searchId: string,
  profile: Profile
): Promise<ScoredOption> {
  const isUrl = input.startsWith("http://") || input.startsWith("https://");

  const prompt = `
PROFILE:
${JSON.stringify(profile, null, 2)}

OPTION TO SCORE:
${isUrl ? `URL: ${input}` : `"${input}"`}
Category: ${category}

${isUrl ? "Fetch the page and use that content to score this option." : "Search the web for more details about this specific option, then score it."}

Return a single JSON object (not an array):
{
  "name": "Option name",
  "source": "URL or source",
  "description": "Brief description (2-3 sentences)",
  "price": "Price if found, otherwise omit",
  "axisScores": {
    "calm": 0.0-1.0,
    "designSincerity": 0.0-1.0,
    "valueIntegrity": 0.0-1.0,
    "socialPermeability": 0.0-1.0,
    "autonomy": 0.0-1.0,
    "novelty": 0.0-1.0,
    "locationFriction": 0.0-1.0
  },
  "alignmentScore": 0-100,
  "thresholdViolations": ["axis names below profile thresholds"],
  "dealbreakersTriggered": ["any dealbreakers that apply"],
  "fitExplanation": "2-3 sentences on why this fits or doesn't fit the profile",
  "tradeoffs": ["tradeoff 1", "tradeoff 2"]
}

Return ONLY valid JSON. No markdown, no extra text.

Axis scoring:
- calm: 0=high energy, 1=peaceful
- designSincerity: 0=staged/generic, 1=authentic
- valueIntegrity: 0=overpriced, 1=fair value
- socialPermeability: 0=forced social, 1=private
- autonomy: 0=programmed, 1=self-directed
- novelty: 0=exotic/new, 1=familiar/predictable
- locationFriction: 0=remote/hard, 1=convenient

Profile thresholds: calm < ${profile.thresholds.calm ?? "N/A"}, valueIntegrity < ${profile.thresholds.valueIntegrity ?? "N/A"} → list in thresholdViolations.
Dealbreakers: ${profile.dealbreakers.join("; ")}`;

  const response = await getClient().messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    tools: [
      {
        type: "web_search_20250305",
        name: "web_search",
        max_uses: 3,
      } as unknown as Anthropic.Tool,
    ],
    system: SCORE_SYSTEM_PROMPT,
    messages: [{ role: "user", content: prompt }],
  });

  const textBlocks = response.content.filter((b) => b.type === "text");
  if (textBlocks.length === 0) throw new Error("No response from Claude");

  const rawText = textBlocks[textBlocks.length - 1].text;
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("Could not parse JSON from response");

  const parsed = JSON.parse(jsonMatch[0]) as Omit<ScoredOption, "id" | "searchId" | "status" | "notes">;

  return {
    ...parsed,
    id: uuidv4(),
    searchId,
    status: "new" as const,
    notes: "",
    thresholdViolations: parsed.thresholdViolations ?? [],
    dealbreakersTriggered: parsed.dealbreakersTriggered ?? [],
    tradeoffs: parsed.tradeoffs ?? [],
  };
}
