import { AssessmentQuestion, AssessmentResult, CORE_ARCHETYPES, getTopAxes } from "./assessment";

// ── Path B — Fresh calibration questions (10 questions, locked set) ───────────

export const FRESH_CALIBRATION_QUESTIONS: AssessmentQuestion[] = [
  {
    id: 0,
    setup: "You had an issue on a trip that needed your attention.",
    a: "You sorted it out — things got back to how they should be",
    b: "You took over — made the call, handled it, moved on",
    typeA: 1, typeB: 8,
  },
  {
    id: 1,
    setup: "Think about the best place you've ever stayed.",
    a: "The host remembered your name. Strangers became friends.",
    b: "It was completely private. The space was yours. No one knew you were there.",
    typeA: 2, typeB: 5,
  },
  {
    id: 2,
    setup: "You're describing a destination that delivered.",
    a: "It looked as good in person as it did in photos — you made the right call",
    b: "Nothing went to plan and somehow it was better that way",
    typeA: 3, typeB: 7,
  },
  {
    id: 3,
    setup: "A trip is memorable because...",
    a: "Of how it made you feel — a landscape, a meal, a moment you won't forget",
    b: "Of what you learned — the culture, the craft, the history you couldn't have understood without being there",
    typeA: 4, typeB: 5,
  },
  {
    id: 4,
    setup: "You're choosing where to stay.",
    a: "Somewhere with a track record — highly rated, no surprises",
    b: "Somewhere off the map — harder to get to, but worth it",
    typeA: 6, typeB: 8,
  },
  {
    id: 5,
    setup: "A perfect afternoon looks like...",
    a: "Jumping between places — a market, a viewpoint, wherever the day takes you",
    b: "One neighborhood, one restaurant, one conversation that didn't need to end",
    typeA: 7, typeB: 9,
  },
  {
    id: 6,
    setup: "You're looking for something worth your time.",
    a: "You decompress — feel what's around you, no rush, no plan",
    b: "You find what's actually worth it — not what's convenient, what's right",
    typeA: 9, typeB: 1,
  },
  {
    id: 7,
    setup: "Group trip. What makes it a success?",
    a: "Everyone was on the same page — easy vibe, no one pulling in different directions",
    b: "Everyone came back with something worth talking about",
    typeA: 2, typeB: 3,
  },
  {
    id: 8,
    setup: "The trips that become part of you...",
    a: "Took real effort to pull off — and felt earned because of it",
    b: "Put you somewhere so right that you forgot to take a photo because you were just there",
    typeA: 8, typeB: 4,
  },
  {
    id: 9,
    setup: "You're heading somewhere you've never been.",
    a: "You've done your homework — you know what to expect and that's what lets you enjoy it",
    b: "You're open to whatever — the less you plan, the more you find",
    typeA: 6, typeB: 9,
  },
];

// ── Path A — Wing calibration question selection ──────────────────────────────
// Selects up to 5 questions from the fresh calibration bank most relevant to
// the adjacent pairing. Priority: exact both-type matches first, then
// single-type matches to fill remaining slots.

export function getWingCalibrationQuestions(typeA: number, typeB: number): AssessmentQuestion[] {
  const both: AssessmentQuestion[] = [];
  const either: AssessmentQuestion[] = [];
  for (const q of FRESH_CALIBRATION_QUESTIONS) {
    const hasA = q.typeA === typeA || q.typeB === typeA;
    const hasB = q.typeA === typeB || q.typeB === typeB;
    if (hasA && hasB) both.push(q);
    else if (hasA || hasB) either.push(q);
  }
  return [...both, ...either].slice(0, 5);
}

// ── Self-awareness question ───────────────────────────────────────────────────

export const SELF_AWARENESS_QUESTION = {
  prompt: "When you answered those first questions — were you thinking about how you actually experience things, or how you'd like to?",
  a: "I was honest — it felt accurate",
  b: "I may have answered based on how I'd like to be",
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
