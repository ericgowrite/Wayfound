import Anthropic from "@anthropic-ai/sdk";
import { Profile, RawResult, ScoredOption, SearchCategory } from "@/types";
import { v4 as uuidv4 } from "uuid";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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

  const response = await client.messages.create({
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

export async function generateComparison(
  options: ScoredOption[],
  profile: Profile
): Promise<string> {
  const prompt = `Compare these ${options.length} travel options for ${profile.name} (Type ${profile.type}):

${options.map((o, i) => `OPTION ${i + 1}: ${o.name}
- Alignment: ${o.alignmentScore}%
- Axis scores: ${JSON.stringify(o.axisScores)}
- Fit: ${o.fitExplanation}
- Tradeoffs: ${o.tradeoffs.join(", ")}`).join("\n\n")}

Write a 3-4 sentence comparison summary focusing on which option best fits Eric's profile and why.
Highlight the key differentiators. Be direct and specific.`;

  const response = await client.messages.create({
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
  const response = await client.messages.create({
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
        content: `Do a deep dive on "${option.name}" for ${profile.name} (Type ${profile.type}).

Search for more detailed information, recent reviews, and specific details.
Then write a detailed 4-6 sentence analysis of whether this is a good fit, including:
- What makes it unique
- Specific pros/cons for a Type ${profile.type} traveler
- Any red flags or standout features
- Overall recommendation

Current fit score: ${option.alignmentScore}%`,
      },
    ],
  });

  const textBlocks = response.content.filter((b) => b.type === "text");
  return textBlocks.length > 0 ? textBlocks[textBlocks.length - 1].text : "";
}
