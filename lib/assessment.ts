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
  headline: string;
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

// ── Questions (10 total; Type 9 appears 3× as tiebreaker, all others 2×) ─────

export const QUESTIONS: AssessmentQuestion[] = [
  {
    id: 0,
    a: "Find out what's happening tonight — a market, a bar someone mentioned, something unplanned. You want to feel the city before you sleep in it.",
    b: "Get settled first — walk the neighborhood, find somewhere local for dinner, clear your head. Tomorrow you'll be fully there. Tonight is just arriving.",
    typeA: 7, typeB: 9,
  },
  {
    id: 1,
    a: "A place that moves something in you — obscure, hard to explain, emotionally resonant in a way you couldn't fully describe to anyone else",
    b: "A place that's having its moment — the right city at the right time, and being there will mean something",
    typeA: 4, typeB: 3,
  },
  {
    id: 2,
    a: "Hours inside one neighborhood — a museum, a long lunch, a bookshop, nowhere to be",
    b: "Moving between people — a local who shows you around, a conversation that changes your view of the place",
    typeA: 5, typeB: 2,
  },
  {
    id: 3,
    a: "Find somewhere more authentic — you'd rather eat somewhere real than settle",
    b: "You'd rather make the call yourself — find something better on the spot or improvise — than stress about what didn't work out",
    typeA: 1, typeB: 8,
  },
  {
    id: 4,
    a: "Settled — you've done your research, you know what to expect, and that lets you actually relax into it",
    b: "Energized — the not-knowing is half of what you're there for, and you want to arrive open to anything",
    typeA: 6, typeB: 7,
  },
  {
    id: 5,
    a: "Find a café, sit with a coffee, let the afternoon come to you",
    b: "Go somewhere specific that means something to you — a gallery, a street, a moment you've been saving",
    typeA: 9, typeB: 4,
  },
  {
    id: 6,
    a: "Somewhere that asks something of you — remote, raw, not set up for tourists",
    b: "Somewhere with depth you can spend days unpacking — history, craft, a culture worth understanding slowly",
    typeA: 8, typeB: 5,
  },
  {
    id: 7,
    a: "Getting it right — finding the places actually worth visiting, not the obvious choices",
    b: "Feeling prepared — knowing enough in advance that you can relax when you get there",
    typeA: 1, typeB: 6,
  },
  {
    id: 8,
    a: "It's the whole point — the shared experience is what you're actually there for",
    b: "You're easy about it — if the group splits, that's fine. You know what you want to do and you'll find each other later.",
    typeA: 2, typeB: 9,
  },
  {
    id: 9,
    a: "That it sounds worth having done — the places, the experiences, the story",
    b: "That it was done with integrity — you found the real version of the place, not the tourist version",
    typeA: 3, typeB: 1,
  },
];

// ── 9 core archetypes ─────────────────────────────────────────────────────────

export const CORE_ARCHETYPES: Record<number, Archetype> = {
  1: {
    type: 1,
    name: "The Connoisseur",
    headline: "The right version of a place. Not the obvious one.",
    tagline: "Principled, precise, and done right",
    description: "You travel with standards — authentic experiences, genuine craft, and real value for money. Sloppy execution or tourist-trap shortcuts frustrate you. Your ideal trip is thoughtfully chosen, well-researched, and experienced with real intention.",
    axisWeights: { calm: 0.6, designSincerity: 0.85, valueIntegrity: 0.9, socialPermeability: 0.6, autonomy: 0.5, novelty: 0.4, locationFriction: 0.5 },
  },
  2: {
    type: 2,
    name: "The Connector",
    headline: "The best part of any trip is who you meet.",
    tagline: "Warm, social, and people-first",
    description: "Travel is fundamentally about people for you. You gravitate toward warm, social environments — family-run places, shared tables, guides who become friends. The best trip is one that leaves you richer in human connection.",
    axisWeights: { calm: 0.5, designSincerity: 0.7, valueIntegrity: 0.6, socialPermeability: 0.3, autonomy: 0.4, novelty: 0.5, locationFriction: 0.6 },
  },
  3: {
    type: 3,
    name: "The Pathfinder",
    headline: "You set a high bar. The trip should clear it.",
    tagline: "Driven, impressive, and high-achieving",
    description: "You set a high bar for your trips and clear it. Whether it's a prestigious destination or a demanding itinerary, you travel with drive and return with stories worth telling. Efficiency matters — wasted time is the only real travel failure.",
    axisWeights: { calm: 0.4, designSincerity: 0.7, valueIntegrity: 0.6, socialPermeability: 0.4, autonomy: 0.6, novelty: 0.6, locationFriction: 0.3 },
  },
  4: {
    type: 4,
    name: "The Romantic",
    headline: "The places that move you are never the obvious ones.",
    tagline: "Authentic, resonant, and beautifully unique",
    description: "You're after places that resonate deeply — beautiful, unique, and genuinely far from the mainstream. You travel to feel something real, and you'd rather disappear into one extraordinary place than rush through ten average ones. Authenticity is non-negotiable.",
    axisWeights: { calm: 0.7, designSincerity: 0.9, valueIntegrity: 0.7, socialPermeability: 0.7, autonomy: 0.7, novelty: 0.6, locationFriction: 0.5 },
  },
  5: {
    type: 5,
    name: "The Curator",
    headline: "You travel to go deep, not wide.",
    tagline: "Immersive, intellectual, and deeply private",
    description: "You travel to understand, not just to see. Long mornings at a quiet museum, a conversation with a local expert, hours inside a single neighborhood — these are the moments that matter. You prefer solitude and depth over packed social itineraries.",
    axisWeights: { calm: 0.8, designSincerity: 0.8, valueIntegrity: 0.75, socialPermeability: 0.8, autonomy: 0.8, novelty: 0.5, locationFriction: 0.5 },
  },
  6: {
    type: 6,
    name: "The Grounded",
    headline: "You did the research. Now you can actually enjoy it.",
    tagline: "Reliable, well-researched, comfortably confident",
    description: "You travel with confidence because you've done the work. Trusted recommendations, solid logistics, and a well-understood destination let you fully relax and enjoy. Reliability isn't a limitation — it's what makes the trip actually good.",
    axisWeights: { calm: 0.6, designSincerity: 0.7, valueIntegrity: 0.8, socialPermeability: 0.5, autonomy: 0.4, novelty: 0.3, locationFriction: 0.6 },
  },
  7: {
    type: 7,
    name: "The Collector",
    headline: "The best trip always has more to do than you have time for.",
    tagline: "Fun-first, variety-driven, endlessly curious",
    description: "You want it all — every experience, every neighborhood, every local recommendation. Variety and novelty are your fuel. You move fast, keep the plan loose, and always manage to find the best thing happening anywhere you land.",
    axisWeights: { calm: 0.3, designSincerity: 0.6, valueIntegrity: 0.5, socialPermeability: 0.3, autonomy: 0.8, novelty: 0.8, locationFriction: 0.4 },
  },
  8: {
    type: 8,
    name: "The Pioneer",
    headline: "You want to feel like you earned the experience.",
    tagline: "Confident, direct, and unapologetically real",
    description: "You travel with confidence and directness. Remote, raw, and real is your preference — you don't need luxury, but you demand authenticity. You make your own rules on the road and come back having done things others only ever talk about.",
    axisWeights: { calm: 0.5, designSincerity: 0.8, valueIntegrity: 0.85, socialPermeability: 0.5, autonomy: 0.9, novelty: 0.6, locationFriction: 0.4 },
  },
  9: {
    type: 9,
    name: "The Harmonist",
    headline: "You don't want to see a place. You want to be in it.",
    tagline: "Serene, unhurried, and genuinely present",
    description: "You travel to rest and reconnect — with a place, with yourself, or with the people you're with. You don't need a packed itinerary; you need the freedom to move at your own pace through beautiful, unhurried places. Serenity is always the real destination.",
    axisWeights: { calm: 0.8, designSincerity: 0.85, valueIntegrity: 0.9, socialPermeability: 0.7, autonomy: 0.6, novelty: 0.5, locationFriction: 0.4 },
  },
};

export function getArchetypeForType(type: number): Archetype {
  return CORE_ARCHETYPES[type] ?? CORE_ARCHETYPES[9];
}

// ── Personalized axis ranking ─────────────────────────────────────────────────
// Blends the base type's axis weights (75%) with the average axis weights of
// all types the user chose (25%). This shifts priority rankings toward what
// the user's specific answers signaled — two users of the same type who
// answered differently see subtly different priority orderings.

function derivePersonalizedTopAxes(
  answers: Record<number, "A" | "B">,
  baseWeights: AxisWeights
): AssessmentResult["topAxes"] {
  const axes = Object.keys(baseWeights) as (keyof AxisWeights)[];
  const sums: Partial<Record<keyof AxisWeights, number>> = {};
  let count = 0;

  for (const [idxStr, choice] of Object.entries(answers)) {
    const q = QUESTIONS[Number(idxStr)];
    if (!q) continue;
    const chosenWeights = CORE_ARCHETYPES[choice === "A" ? q.typeA : q.typeB]?.axisWeights;
    if (!chosenWeights) continue;
    for (const axis of axes) {
      sums[axis] = (sums[axis] ?? 0) + chosenWeights[axis];
    }
    count++;
  }

  if (count === 0) return getTopAxes(baseWeights);

  const blended = {} as AxisWeights;
  for (const axis of axes) {
    const userAvg = (sums[axis] ?? 0) / count;
    blended[axis] = 0.75 * baseWeights[axis] + 0.25 * userAvg;
  }

  return getTopAxes(blended);
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

  // Confidence based on gap between 1st and 2nd (recalibrated for 10-question max of 3)
  const gap = scores[topType] - scores[ranked[1]];
  const confidence: AssessmentResult["confidence"] =
    gap >= 2 ? "high" : gap >= 1 ? "medium" : "low";

  const base = CORE_ARCHETYPES[topType];
  const topAxes = derivePersonalizedTopAxes(answers, base.axisWeights);

  return { ...base, typeScores: scores, topAxes, confidence, runnerUpTypes };
}
