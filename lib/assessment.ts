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
  wing: number;
  name: string;
  tagline: string;
  description: string;
  axisWeights: AxisWeights;
}

export interface AssessmentResult extends Archetype {
  typeScores: number[];
  topAxes: { axis: keyof AxisWeights; label: string }[];
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

// ── Questions (18 total; each of the 9 types appears exactly 4 times) ─────────

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
];

// ── Archetype definitions (18 = 9 types × 2 wings each) ──────────────────────

type ArchetypeMap = Record<string, Omit<Archetype, "topAxes">>;

const ARCHETYPES: ArchetypeMap = {
  "1w9": {
    type: 1, wing: 9,
    name: "The Principled Nomad",
    tagline: "Meaningful, unhurried, and done right",
    description: "You're drawn to places with genuine craft and integrity — where things are made well and tourism hasn't hollowed them out. Slower, more purposeful travel is your ideal: a week in one region done properly beats a rushed circuit of ten. Peace and authenticity matter to you in equal measure.",
    axisWeights: { calm: 0.68, designSincerity: 0.85, valueIntegrity: 0.65, socialPermeability: 0.60, autonomy: 0.52, novelty: 0.48, locationFriction: 0.52 },
  },
  "1w2": {
    type: 1, wing: 2,
    name: "The Purposeful Explorer",
    tagline: "Ethical, connected, and intentional",
    description: "You travel with intention — ethical choices, locally-owned, leaving a place better than you found it. The connections you build along the way mean as much as the destination. You prefer quality over quantity and sincerity over spectacle.",
    axisWeights: { calm: 0.62, designSincerity: 0.82, valueIntegrity: 0.62, socialPermeability: 0.42, autonomy: 0.45, novelty: 0.45, locationFriction: 0.58 },
  },
  "2w1": {
    type: 2, wing: 1,
    name: "The Warmhearted Traveler",
    tagline: "Connection-first, community-rooted",
    description: "What makes a trip unforgettable is the people. You gravitate toward family-run guesthouses, local guides, and experiences that feel like genuine exchange rather than service. The best version of travel, for you, is one that creates real human connection.",
    axisWeights: { calm: 0.58, designSincerity: 0.70, valueIntegrity: 0.60, socialPermeability: 0.15, autonomy: 0.38, novelty: 0.48, locationFriction: 0.68 },
  },
  "2w3": {
    type: 2, wing: 3,
    name: "The Social Curator",
    tagline: "People-focused, shareable, convivial",
    description: "You travel to create shared experiences — and you have a talent for finding the places worth going to together. Lively, accessible, and worth sharing with others all matter to you. The best trip is one that brings people into the same room.",
    axisWeights: { calm: 0.48, designSincerity: 0.58, valueIntegrity: 0.45, socialPermeability: 0.18, autonomy: 0.42, novelty: 0.35, locationFriction: 0.68 },
  },
  "3w2": {
    type: 3, wing: 2,
    name: "The Aspirational Explorer",
    tagline: "Impressive, people-connected, efficient",
    description: "You're drawn to destinations at the top of everyone's list — but you want to experience them right, not just pass through. Travel is both personal achievement and a way to connect with people who share your ambitions. You move efficiently and come back with things worth sharing.",
    axisWeights: { calm: 0.38, designSincerity: 0.48, valueIntegrity: 0.28, socialPermeability: 0.28, autonomy: 0.58, novelty: 0.22, locationFriction: 0.65 },
  },
  "3w4": {
    type: 3, wing: 4,
    name: "The Achievement Seeker",
    tagline: "Ambitious itineraries with emotional depth",
    description: "You set high bars for your trips — not just for the story, but because you genuinely want experiences that matter. You want to come back with things that challenged or moved you, not just a checklist. Travel is how you measure how fully you're living.",
    axisWeights: { calm: 0.42, designSincerity: 0.58, valueIntegrity: 0.32, socialPermeability: 0.40, autonomy: 0.62, novelty: 0.20, locationFriction: 0.60 },
  },
  "4w3": {
    type: 4, wing: 3,
    name: "The Aesthetic Voyager",
    tagline: "Beautiful, singular, quietly impressive",
    description: "You seek beauty and experiences that feel genuinely distinctive. You want your travels to be memorable not because they're trendy, but because they're true. You find places worth photographing before anyone else does — and sometimes that's the whole point.",
    axisWeights: { calm: 0.52, designSincerity: 0.88, valueIntegrity: 0.48, socialPermeability: 0.62, autonomy: 0.72, novelty: 0.18, locationFriction: 0.42 },
  },
  "4w5": {
    type: 4, wing: 5,
    name: "The Deep Romantic",
    tagline: "Obscure, emotionally resonant, transformative",
    description: "You travel to feel things deeply. You're most at home in obscure, emotionally resonant places where you can disappear for days and come back changed. Crowds and packed itineraries are the enemy of the kind of travel you actually want.",
    axisWeights: { calm: 0.58, designSincerity: 0.90, valueIntegrity: 0.52, socialPermeability: 0.78, autonomy: 0.78, novelty: 0.15, locationFriction: 0.32 },
  },
  "5w4": {
    type: 5, wing: 4,
    name: "The Curious Scholar",
    tagline: "Immersive, layered, beautifully quiet",
    description: "You travel to understand. You're drawn to places with layered histories, living craft traditions, and long afternoons free for observation. The best souvenir is something you know — about a culture, a technique, a place — that you couldn't have learned any other way.",
    axisWeights: { calm: 0.68, designSincerity: 0.82, valueIntegrity: 0.65, socialPermeability: 0.88, autonomy: 0.82, novelty: 0.28, locationFriction: 0.28 },
  },
  "5w6": {
    type: 5, wing: 6,
    name: "The Methodical Explorer",
    tagline: "Researched, immersive, deliberately chosen",
    description: "You prepare thoroughly and travel deliberately. Deep immersion in one well-chosen destination beats a rushed tour of many. You're most relaxed when you've done the work in advance — culturally, logistically, historically.",
    axisWeights: { calm: 0.70, designSincerity: 0.78, valueIntegrity: 0.68, socialPermeability: 0.82, autonomy: 0.72, novelty: 0.38, locationFriction: 0.38 },
  },
  "6w5": {
    type: 6, wing: 5,
    name: "The Thoughtful Planner",
    tagline: "Reliable, well-researched, comfortably familiar",
    description: "You travel confidently when you've done your homework. Trusted recommendations, clear logistics, and a known-quantity destination let you fully relax and enjoy. Reliability is a feature, not a limitation — and you've built a list of places you love returning to.",
    axisWeights: { calm: 0.70, designSincerity: 0.62, valueIntegrity: 0.70, socialPermeability: 0.55, autonomy: 0.28, novelty: 0.62, locationFriction: 0.72 },
  },
  "6w7": {
    type: 6, wing: 7,
    name: "The Spirited Realist",
    tagline: "Adventure within a sensible framework",
    description: "You want real adventure — but not at the cost of basic comfort. Plan carefully, choose well, then give yourself permission to enjoy the ride. You're happiest when the itinerary has a few surprises, all of them well within reach.",
    axisWeights: { calm: 0.60, designSincerity: 0.58, valueIntegrity: 0.65, socialPermeability: 0.42, autonomy: 0.35, novelty: 0.48, locationFriction: 0.68 },
  },
  "7w6": {
    type: 7, wing: 6,
    name: "The Joyful Wanderer",
    tagline: "Fun-first, social, endlessly curious",
    description: "You want to do everything, see everything, and laugh the whole time. Fun and variety are your north stars when you travel. You do best with good company, a loose plan, and total openness to whatever the day decides to bring.",
    axisWeights: { calm: 0.25, designSincerity: 0.55, valueIntegrity: 0.48, socialPermeability: 0.22, autonomy: 0.75, novelty: 0.12, locationFriction: 0.58 },
  },
  "7w8": {
    type: 7, wing: 8,
    name: "The Relentless Adventurer",
    tagline: "Maximum variety, maximum intensity",
    description: "You're at your best when the trip has no ceiling. You pack more into a week than most manage in a month — and you wouldn't have it any other way. The only bad trip is one you planned too safely.",
    axisWeights: { calm: 0.18, designSincerity: 0.52, valueIntegrity: 0.45, socialPermeability: 0.25, autonomy: 0.85, novelty: 0.08, locationFriction: 0.48 },
  },
  "8w7": {
    type: 8, wing: 7,
    name: "The Bold Pioneer",
    tagline: "Challenging, intense, gloriously real",
    description: "You seek the edge of the map. Remote, rugged, and unglamorous is your ideal — as long as it's genuine. You travel to push yourself and come back having done something few others would attempt or even consider.",
    axisWeights: { calm: 0.20, designSincerity: 0.68, valueIntegrity: 0.50, socialPermeability: 0.55, autonomy: 0.88, novelty: 0.22, locationFriction: 0.20 },
  },
  "8w9": {
    type: 8, wing: 9,
    name: "The Grounded Challenger",
    tagline: "Bold, earthy, wide open",
    description: "You're drawn to intense experiences in vast, elemental places — wilderness, mountains, remote coastline. You need the freedom to move through a landscape on your own terms, at your own pace, without anyone telling you where to be.",
    axisWeights: { calm: 0.35, designSincerity: 0.70, valueIntegrity: 0.55, socialPermeability: 0.65, autonomy: 0.82, novelty: 0.28, locationFriction: 0.20 },
  },
  "9w8": {
    type: 9, wing: 8,
    name: "The Peaceful Wanderer",
    tagline: "Serene, unhurried, occasionally wild",
    description: "You travel to breathe. Serenity, flow, and genuine rest are your real destination — whatever the destination happens to be. You're not in a hurry, and that is precisely the point. Occasionally, something bolder calls to you, and you answer.",
    axisWeights: { calm: 0.88, designSincerity: 0.65, valueIntegrity: 0.65, socialPermeability: 0.52, autonomy: 0.62, novelty: 0.52, locationFriction: 0.52 },
  },
  "9w1": {
    type: 9, wing: 1,
    name: "The Mindful Traveler",
    tagline: "Gentle, deliberate, beautifully present",
    description: "You travel slowly and thoughtfully, choosing places that reward full presence. Authenticity and beauty matter to you, but the greatest luxury is having nowhere to be. You return from trips actually rested — and you carry something of every place with you.",
    axisWeights: { calm: 0.90, designSincerity: 0.72, valueIntegrity: 0.68, socialPermeability: 0.55, autonomy: 0.58, novelty: 0.55, locationFriction: 0.55 },
  },
};

// ── Scoring ───────────────────────────────────────────────────────────────────

function adjacentTypes(type: number): [number, number] {
  if (type === 1) return [9, 2];
  if (type === 9) return [8, 1];
  return [(type - 1) as number, (type + 1) as number];
}

export function scoreAssessment(answers: Record<number, "A" | "B">): AssessmentResult {
  const scores = new Array(10).fill(0) as number[];

  for (const [idxStr, answer] of Object.entries(answers)) {
    const q = QUESTIONS[Number(idxStr)];
    if (!q) continue;
    scores[answer === "A" ? q.typeA : q.typeB]++;
  }

  // Top type — break ties by sum of adjacent scores
  let topType = 1;
  for (let i = 2; i <= 9; i++) {
    if (scores[i] > scores[topType]) topType = i;
    else if (scores[i] === scores[topType]) {
      const [a1, a2] = adjacentTypes(i);
      const [b1, b2] = adjacentTypes(topType);
      if (scores[a1] + scores[a2] > scores[b1] + scores[b2]) topType = i;
    }
  }

  // Wing — higher-scoring adjacent type
  const [w1, w2] = adjacentTypes(topType);
  const wing = scores[w1] >= scores[w2] ? w1 : w2;

  const key = `${topType}w${wing}`;
  const base = ARCHETYPES[key] ?? ARCHETYPES[Object.keys(ARCHETYPES)[0]];
  const topAxes = getTopAxes(base.axisWeights);

  return { ...base, typeScores: scores, topAxes };
}
