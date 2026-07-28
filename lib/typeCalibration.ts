import { AssessmentQuestion, AssessmentResult, CORE_ARCHETYPES, getTopAxes } from "./assessment";

// ── Path B — Fresh calibration questions (9 questions) ───────────────────────
// Distinct type pairings from the original 10-question bank to maximize
// discriminating signal without repeating scenarios.

export const FRESH_CALIBRATION_QUESTIONS: AssessmentQuestion[] = [
  {
    id: 0,
    a: "Getting things done well — executing flawlessly so you can move on knowing it was handled right",
    b: "Getting things done your way — figuring it out as you go, improvising when the plan falls apart",
    typeA: 1, typeB: 8,
  },
  {
    id: 1,
    a: "Arriving somewhere where people are warm and present with you — a host who remembers your name, strangers who become friends",
    b: "Arriving somewhere completely private — the room is yours, the space is yours, no one knows you're there",
    typeA: 2, typeB: 5,
  },
  {
    id: 2,
    a: "A destination that looks as good in person as it does in the photos — the right place at the right time, and you made it happen",
    b: "A destination that surprises you every day — nothing went to plan, and somehow it was better that way",
    typeA: 3, typeB: 7,
  },
  {
    id: 3,
    a: "Somewhere that moves something in you — a landscape, a room, a meal you'll remember precisely because of how it made you feel",
    b: "Somewhere that stays with you for what you learned — the culture, the craft, the history you couldn't have understood without being there",
    typeA: 4, typeB: 5,
  },
  {
    id: 4,
    a: "Somewhere you've read about and trusted — highly rated, consistently excellent, no unpleasant surprises",
    b: "Somewhere that took you completely out of your comfort zone — uncomfortable at first, worth it in the end",
    typeA: 6, typeB: 8,
  },
  {
    id: 5,
    a: "Moving between many small moments — a market here, a viewpoint there, a meal that turned into something unexpected",
    b: "Spending a whole afternoon in one neighborhood, one restaurant, one conversation that didn't need to end",
    typeA: 7, typeB: 9,
  },
  {
    id: 6,
    a: "Having space for yourself — to decompress, recharge, and actually feel what's around you without agenda",
    b: "Finding the version of the place the tourists don't see — the off-menu dish, the local bar, the unmarked shortcut",
    typeA: 9, typeB: 1,
  },
  {
    id: 7,
    a: "Everyone on the same page — the group agrees, the vibe is easy, no one's pulling in different directions",
    b: "Everyone with a story to tell afterward — it doesn't matter if the day got messy, the stories are better that way",
    typeA: 2, typeB: 3,
  },
  {
    id: 8,
    a: "Being in a place that's genuinely difficult to get to — it feels earned in a way the easy version never would",
    b: "Being in a place so right for you that you forget to take a photo because you're just there",
    typeA: 8, typeB: 4,
  },
];

// ── Path A — Wing calibration question bank ───────────────────────────────────
// 5 questions per adjacent type pairing. Keys: "min-max" (e.g. "1-2", "1-9").
// Bank will be filled in a separate brief. Infrastructure only.

export const WING_CALIBRATION_BANK: Record<string, AssessmentQuestion[]> = {
  "1-2": [],
  "2-3": [],
  "3-4": [],
  "4-5": [],
  "5-6": [],
  "6-7": [],
  "7-8": [],
  "8-9": [],
  "1-9": [], // 9w1 ↔ 1w9 pairing
};

export function getWingCalibrationQuestions(typeA: number, typeB: number): AssessmentQuestion[] {
  const key = `${Math.min(typeA, typeB)}-${Math.max(typeA, typeB)}`;
  return (WING_CALIBRATION_BANK[key] ?? []).slice(0, 5);
}

// ── Self-awareness question ───────────────────────────────────────────────────

export const SELF_AWARENESS_QUESTION = {
  prompt: "Before we start — those first questions, were you answering based on…",
  a: "How I actually am when I travel",
  b: "How I'd like to be — or how I travel when things go well",
};

// ── Scoring: Path A (wing) ────────────────────────────────────────────────────
// Adds wing answers on top of original type scores and re-ranks.

export function scoreWingCalibration(
  originalResult: AssessmentResult,
  wingAnswers: Record<number, "A" | "B">,
  wingQuestions: AssessmentQuestion[]
): AssessmentResult {
  const scores = [...originalResult.typeScores] as number[];

  for (const [idxStr, choice] of Object.entries(wingAnswers)) {
    const q = wingQuestions[Number(idxStr)];
    if (!q) continue;
    scores[choice === "A" ? q.typeA : q.typeB]++;
  }

  const ranked = [1, 2, 3, 4, 5, 6, 7, 8, 9].sort((a, b) => scores[b] - scores[a]);
  const topType = ranked[0];
  const runnerUpTypes = [ranked[1], ranked[2]];
  const gap = scores[topType] - scores[ranked[1]];
  const confidence: AssessmentResult["confidence"] = gap >= 2 ? "high" : gap >= 1 ? "medium" : "low";
  const base = CORE_ARCHETYPES[topType];

  return {
    ...base,
    typeScores: scores,
    topAxes: getTopAxes(base.axisWeights),
    confidence,
    runnerUpTypes,
  };
}

// ── Scoring: Path B (fresh) ───────────────────────────────────────────────────
// Weighted blend: honest = 40% original + 60% fresh; aspirational = 20% + 80%.

export function scoreFreshCalibration(
  originalResult: AssessmentResult,
  freshAnswers: Record<number, "A" | "B">,
  selfAwarenessHonest: boolean
): AssessmentResult {
  const freshScores = new Array(10).fill(0) as number[];
  for (const [idxStr, choice] of Object.entries(freshAnswers)) {
    const q = FRESH_CALIBRATION_QUESTIONS[Number(idxStr)];
    if (!q) continue;
    freshScores[choice === "A" ? q.typeA : q.typeB]++;
  }

  const originalWeight = selfAwarenessHonest ? 0.4 : 0.2;
  const freshWeight = selfAwarenessHonest ? 0.6 : 0.8;
  const totalOriginal = Math.max(originalResult.typeScores.reduce((a, b) => a + b, 0), 1);
  const totalFresh = FRESH_CALIBRATION_QUESTIONS.length;

  const combined = new Array(10).fill(0) as number[];
  for (let t = 1; t <= 9; t++) {
    const nOrig = (originalResult.typeScores[t] ?? 0) / totalOriginal;
    const nFresh = freshScores[t] / totalFresh;
    combined[t] = (originalWeight * nOrig + freshWeight * nFresh) * 10;
  }

  const ranked = [1, 2, 3, 4, 5, 6, 7, 8, 9].sort((a, b) => combined[b] - combined[a]);
  const topType = ranked[0];
  const runnerUpTypes = [ranked[1], ranked[2]];
  const gap = combined[topType] - combined[ranked[1]];
  const confidence: AssessmentResult["confidence"] = gap >= 2 ? "high" : gap >= 1 ? "medium" : "low";
  const base = CORE_ARCHETYPES[topType];

  return {
    ...base,
    typeScores: combined,
    topAxes: getTopAxes(base.axisWeights),
    confidence,
    runnerUpTypes,
  };
}

// ── 30-day cooldown check ─────────────────────────────────────────────────────

export function isCalibrationSuppressed(lastCalibratedAt?: string): boolean {
  if (!lastCalibratedAt) return false;
  const elapsed = Date.now() - new Date(lastCalibratedAt).getTime();
  return elapsed < 30 * 24 * 60 * 60 * 1000;
}
