import { AxisWeights } from "@/types";

// ── Public types ──────────────────────────────────────────────────────────────

export interface AssessmentQuestion {
  id: number;
  a: string;
  b: string;
  typeA: number;
  typeB: number;
}

export interface Archetype {
  type: number;
  name: string;
  tagline: string;
  description: string;
  axisWeights: AxisWeights;
}

export interface AssessmentResult extends Archetype {
  typeScores: number[];
  topAxes: { axis: keyof AxisWeights; label: string }[];
  confidence: "high" | "medium" | "low";
  runnerUpTypes: number[];  // indices of 2nd and 3rd place types
}

// ── Axis travel-priority labels ───────────────────────────────────────────────

const AXIS_TRAVEL_LABELS: Record<keyof AxisWeights, { high: string; low: string }> = {
  calm:               { high: "Peaceful, unhurried experiences",   low: "High-energy, stimulating trips" },
  designSincerity:    { high: "Authentic, locally-rooted places",  low: "Polished, mainstream destinations" },
  valueIntegrity:     { high: "Value and integrity over prestige", low: "Premium and status-driven" },
  socialPermeability: { high: "Solitude and privacy",              low: "Social and communal vibes" },
  autonomy:           { high: "Total spontaneity and freedom",     low: "Structured, guided itineraries" },
  novelty:            { high: "Familiar, reliable destinations",   low: "Novel, off-the-beaten-path" },
  locationFriction:   { high: "Easy to reach",                    low: "Remote and hard to find" },
};

export function getTopAxes(weights: AxisWeights): AssessmentResult["topAxes"] {
  return (Object.keys(weights) as (keyof AxisWeights)[])
    .sort((a, b) => Math.abs(weights[b] - 0.5) - Math.abs(weights[a] - 0.5))
    .slice(0, 3)
    .map((axis) => ({
      axis,
      label: weights[axis] >= 0.5 ? AXIS_TRAVEL_LABELS[axis].high : AXIS_TRAVEL_LABELS[axis].low,
    }));
}

// ── Questions (21 total; each of the 9 types appears at least twice,
//    with key discriminators added for accurate core-type detection) ─────────

export const QUESTIONS: AssessmentQuestion[] = [
  {
    id: 0,
    a: "I love waking up with no plan — spontaneity is half the fun of being somewhere new.",
    b: "I travel better with a rough plan in place — knowing what's ahead lets me actually relax.",
    typeA: 7, typeB: 6,
  },
  {
    id: 1,
    a: "I'm drawn to lesser-known places that feel emotionally resonant, even if they're harder to reach.",
    b: "I'm drawn to destinations everyone is talking about — if a place has real momentum, I want to be there.",
    typeA: 4, typeB: 3,
  },
  {
    id: 2,
    a: "My best travel memories involve going deep — into a culture, a craft, a single neighborhood.",
    b: "What makes a trip unforgettable is the people I meet along the way.",
    typeA: 5, typeB: 2,
  },
  {
    id: 3,
    a: "I'm most at peace when I can slow down and truly settle into a place for a while.",
    b: "I want to pack as much in as possible — I can rest when I get home.",
    typeA: 9, typeB: 7,
  },
  {
    id: 4,
    a: "I care deeply about doing things properly — visiting the right places, in the right way.",
    b: "I'm easy-going about the details as long as the overall vibe feels right.",
    typeA: 1, typeB: 9,
  },
  {
    id: 5,
    a: "I'm happiest in places that push me — rough edges, difficult terrain, and all.",
    b: "I travel to recharge, not to test myself — I want to feel safe and comfortable.",
    typeA: 8, typeB: 6,
  },
  {
    id: 6,
    a: "I'd rather find a hidden gem quietly on my own than follow the crowd to a famous spot.",
    b: "Part of why I love travel is sharing it — the best experiences are ones I can enjoy with others.",
    typeA: 4, typeB: 2,
  },
  {
    id: 7,
    a: "I seek out local craft and integrity — I'd rather eat at a real neighborhood spot than a tourist attraction.",
    b: "I'm drawn to places that look and feel impressive — I want to stay somewhere I'm genuinely proud of.",
    typeA: 1, typeB: 3,
  },
  {
    id: 8,
    a: "I'd rather spend three full days inside one neighborhood than rush across an entire country.",
    b: "I'd rather hit five cities in a week than stay anywhere too long.",
    typeA: 5, typeB: 7,
  },
  {
    id: 9,
    a: "I don't need luxury — I just need the place to feel real and completely unfiltered.",
    b: "I love the warmth of a family-run spot where the host makes you feel instantly at home.",
    typeA: 8, typeB: 2,
  },
  {
    id: 10,
    a: "My ideal trip has no real agenda — just flowing from one moment to the next.",
    b: "A trip feels wasted if I don't come back with stories genuinely worth telling.",
    typeA: 9, typeB: 3,
  },
  {
    id: 11,
    a: "I like to know in advance what I'm getting into — good research helps me actually enjoy the trip.",
    b: "I trust my instincts over any guidebook.",
    typeA: 6, typeB: 8,
  },
  {
    id: 12,
    a: "I want my travels to be ethical and true to the places I visit — not just tourism.",
    b: "I want my trips to touch something deep — beauty, strangeness, or meaning I couldn't have predicted.",
    typeA: 1, typeB: 4,
  },
  {
    id: 13,
    a: "I could spend a whole morning at a café just watching the city move around me.",
    b: "Sitting still on a trip feels like wasted time to me.",
    typeA: 5, typeB: 3,
  },
  {
    id: 14,
    a: "I love asking locals for recommendations — real connections with people are what I'm there for.",
    b: "I'm content to move quietly through a place and just let it wash over me.",
    typeA: 2, typeB: 9,
  },
  {
    id: 15,
    a: "Fun is my north star when I travel — I want to try things, laugh, and keep moving.",
    b: "I want my trips to leave a real mark — experiences that stay with me long after I'm home.",
    typeA: 7, typeB: 4,
  },
  {
    id: 16,
    a: "I like to push past my comfort zone — physically, culturally, emotionally.",
    b: "I want to understand a place deeply, not just skim the surface of it.",
    typeA: 8, typeB: 5,
  },
  {
    id: 17,
    a: "I tend to return to regions I love rather than gamble on somewhere unfamiliar.",
    b: "I research new destinations thoroughly before I go — I want to do it properly.",
    typeA: 6, typeB: 1,
  },
  {
    id: 18,
    a: "I feel best when I know everyone on the trip is happy.",
    b: "Others' moods don't affect my own experience much.",
    typeA: 2, typeB: 5,
  },
  {
    id: 19,
    a: "I go along with plans to keep things easy and comfortable.",
    b: "I go along with plans because I don't want to miss out.",
    typeA: 9, typeB: 7,
  },
  {
    id: 20,
    a: "When something's wrong, I address it directly.",
    b: "When something's wrong, I consider whether it's worth raising.",
    typeA: 8, typeB: 6,
  },
];

// ── 9 core archetypes ─────────────────────────────────────────────────────────

export const CORE_ARCHETYPES: Record<number, Archetype> = {
  1: {
    type: 1,
    name: "The Connoisseur",
    tagline: "Principled, precise, and done right",
    description: "You travel with standards — authentic experiences, genuine craft, and real value for money. Sloppy execution or tourist-trap shortcuts frustrate you. Your ideal trip is thoughtfully chosen, well-researched, and experienced with real intention.",
    axisWeights: { calm: 0.6, designSincerity: 0.85, valueIntegrity: 0.9, socialPermeability: 0.6, autonomy: 0.5, novelty: 0.4, locationFriction: 0.5 },
  },
  2: {
    type: 2,
    name: "The Connector",
    tagline: "Warm, social, and people-first",
    description: "Travel is fundamentally about people for you. You gravitate toward warm, social environments — family-run places, shared tables, guides who become friends. The best trip is one that leaves you richer in human connection.",
    axisWeights: { calm: 0.5, designSincerity: 0.7, valueIntegrity: 0.6, socialPermeability: 0.3, autonomy: 0.4, novelty: 0.5, locationFriction: 0.6 },
  },
  3: {
    type: 3,
    name: "The Pathfinder",
    tagline: "Driven, impressive, and high-achieving",
    description: "You set a high bar for your trips and clear it. Whether it's a prestigious destination or a demanding itinerary, you travel with drive and return with stories worth telling. Efficiency matters — wasted time is the only real travel failure.",
    axisWeights: { calm: 0.4, designSincerity: 0.7, valueIntegrity: 0.6, socialPermeability: 0.4, autonomy: 0.6, novelty: 0.6, locationFriction: 0.3 },
  },
  4: {
    type: 4,
    name: "The Romantic",
    tagline: "Authentic, resonant, and beautifully unique",
    description: "You're after places that resonate deeply — beautiful, unique, and genuinely far from the mainstream. You travel to feel something real, and you'd rather disappear into one extraordinary place than rush through ten average ones. Authenticity is non-negotiable.",
    axisWeights: { calm: 0.7, designSincerity: 0.9, valueIntegrity: 0.7, socialPermeability: 0.7, autonomy: 0.7, novelty: 0.6, locationFriction: 0.5 },
  },
  5: {
    type: 5,
    name: "The Curator",
    tagline: "Immersive, intellectual, and deeply private",
    description: "You travel to understand, not just to see. Long mornings at a quiet museum, a conversation with a local expert, hours inside a single neighborhood — these are the moments that matter. You prefer solitude and depth over packed social itineraries.",
    axisWeights: { calm: 0.8, designSincerity: 0.8, valueIntegrity: 0.75, socialPermeability: 0.8, autonomy: 0.8, novelty: 0.5, locationFriction: 0.5 },
  },
  6: {
    type: 6,
    name: "The Grounded",
    tagline: "Reliable, well-researched, comfortably confident",
    description: "You travel with confidence because you've done the work. Trusted recommendations, solid logistics, and a well-understood destination let you fully relax and enjoy. Reliability isn't a limitation — it's what makes the trip actually good.",
    axisWeights: { calm: 0.6, designSincerity: 0.7, valueIntegrity: 0.8, socialPermeability: 0.5, autonomy: 0.4, novelty: 0.3, locationFriction: 0.6 },
  },
  7: {
    type: 7,
    name: "The Collector",
    tagline: "Fun-first, variety-driven, endlessly curious",
    description: "You want it all — every experience, every neighborhood, every local recommendation. Variety and novelty are your fuel. You move fast, keep the plan loose, and always manage to find the best thing happening anywhere you land.",
    axisWeights: { calm: 0.3, designSincerity: 0.6, valueIntegrity: 0.5, socialPermeability: 0.3, autonomy: 0.8, novelty: 0.8, locationFriction: 0.4 },
  },
  8: {
    type: 8,
    name: "The Pioneer",
    tagline: "Confident, direct, and unapologetically real",
    description: "You travel with confidence and directness. Remote, raw, and real is your preference — you don't need luxury, but you demand authenticity. You make your own rules on the road and come back having done things others only ever talk about.",
    axisWeights: { calm: 0.5, designSincerity: 0.8, valueIntegrity: 0.85, socialPermeability: 0.5, autonomy: 0.9, novelty: 0.6, locationFriction: 0.4 },
  },
  9: {
    type: 9,
    name: "The Harmonist",
    tagline: "Serene, unhurried, and genuinely present",
    description: "You travel to rest and reconnect — with a place, with yourself, or with the people you're with. You don't need a packed itinerary; you need the freedom to move at your own pace through beautiful, unhurried places. Serenity is always the real destination.",
    axisWeights: { calm: 0.8, designSincerity: 0.85, valueIntegrity: 0.9, socialPermeability: 0.7, autonomy: 0.6, novelty: 0.5, locationFriction: 0.4 },
  },
};

export function getArchetypeForType(type: number): Archetype {
  return CORE_ARCHETYPES[type] ?? CORE_ARCHETYPES[9];
}

// ── Scoring ───────────────────────────────────────────────────────────────────

export function scoreAssessment(answers: Record<number, "A" | "B">): AssessmentResult {
  const scores = new Array(10).fill(0) as number[];

  for (const [idxStr, answer] of Object.entries(answers)) {
    const q = QUESTIONS[Number(idxStr)];
    if (!q) continue;
    scores[answer === "A" ? q.typeA : q.typeB]++;
  }

  // Rank types 1-9 by score descending
  const ranked = [1, 2, 3, 4, 5, 6, 7, 8, 9].sort((a, b) => scores[b] - scores[a]);
  const topType = ranked[0];
  const runnerUpTypes = [ranked[1], ranked[2]];

  // Confidence based on gap between 1st and 2nd
  const gap = scores[topType] - scores[ranked[1]];
  const confidence: AssessmentResult["confidence"] =
    gap >= 3 ? "high" : gap >= 1 ? "medium" : "low";

  const base = CORE_ARCHETYPES[topType];
  const topAxes = getTopAxes(base.axisWeights);

  return { ...base, typeScores: scores, topAxes, confidence, runnerUpTypes };
}
