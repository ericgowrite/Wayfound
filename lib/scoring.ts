import { AxisWeights, Profile, ScoredOption, TravelerScore } from "@/types";

export function calculateAlignmentScore(
  axisScores: AxisWeights,
  profile: Profile
): number {
  const weights = profile.axisWeights;
  const keys = Object.keys(weights) as (keyof AxisWeights)[];

  const totalWeight = keys.reduce((sum, k) => sum + weights[k], 0);
  const weightedScore = keys.reduce((sum, k) => {
    const fit = 1 - Math.abs(axisScores[k] - weights[k]);
    return sum + weights[k] * fit;
  }, 0);

  return Math.round((weightedScore / totalWeight) * 100);
}

export function checkThresholds(
  axisScores: AxisWeights,
  profile: Profile
): string[] {
  const violations: string[] = [];
  const thresholds = profile.thresholds;
  const keys = Object.keys(thresholds) as (keyof AxisWeights)[];

  for (const key of keys) {
    const threshold = thresholds[key];
    if (threshold !== undefined && axisScores[key] < threshold) {
      violations.push(key);
    }
  }

  return violations;
}

export function scoreForProfile(
  axisScores: AxisWeights,
  profile: Profile
): TravelerScore {
  return {
    alignmentScore: calculateAlignmentScore(axisScores, profile),
    thresholdViolations: checkThresholds(axisScores, profile),
  };
}

/**
 * Attach per-traveler scores and reconcile the headline alignmentScore.
 *
 * The AI returns an estimated alignmentScore that can diverge from the actual
 * weighted formula. This function:
 *   1. Computes each traveler's score locally (formula is authoritative).
 *   2. Overwrites alignmentScore with the average of all traveler scores.
 *   3. Overwrites thresholdViolations with the union across all travelers.
 *
 * Result: headline score, per-traveler bars, and "min" badge are all derived
 * from the same formula and will always be consistent.
 */
export function attachTravelerScores(
  options: ScoredOption[],
  profiles: Profile[]
): ScoredOption[] {
  if (profiles.length === 0) return options;
  return options.map((opt) => {
    const travelerScores = Object.fromEntries(
      profiles.map((p) => [p.id, scoreForProfile(opt.axisScores, p)])
    );

    // Headline = average of all traveler scores (formula-based, not AI estimate)
    const scoreValues = profiles.map((p) => travelerScores[p.id].alignmentScore);
    const alignmentScore = Math.round(
      scoreValues.reduce((sum, s) => sum + s, 0) / scoreValues.length
    );

    // Threshold violations = union across all travelers (surface any violation)
    const thresholdViolations = [
      ...new Set(profiles.flatMap((p) => travelerScores[p.id].thresholdViolations)),
    ];

    return {
      ...opt,
      alignmentScore,
      thresholdViolations,
      travelerScores,
    };
  });
}

export function sortByAlignment(options: ScoredOption[]): ScoredOption[] {
  return [...options].sort((a, b) => b.alignmentScore - a.alignmentScore);
}

// Group fit score: options where everyone >= GROUP_FLOOR rank above those where someone falls short.
// Within the "all happy" band, rank by average. Within the "someone unhappy" band, rank by minimum.
const GROUP_FLOOR = 65;

function groupFitScore(option: ScoredOption, profiles: Profile[]): number {
  const scores = profiles.map((p) => {
    const stored = option.travelerScores?.[p.id];
    return stored ? stored.alignmentScore : calculateAlignmentScore(option.axisScores, p);
  });
  const min = Math.min(...scores);
  const avg = scores.reduce((s, n) => s + n, 0) / scores.length;
  // Band separation: floor-passing options live in 100–200, violators in 0–100
  return min >= GROUP_FLOOR ? 100 + avg : min;
}

export function sortByGroupFit(options: ScoredOption[], profiles: Profile[]): ScoredOption[] {
  if (profiles.length < 2) return sortByAlignment(options);
  return [...options].sort((a, b) => groupFitScore(b, profiles) - groupFitScore(a, profiles));
}

export function combineProfiles(profiles: Profile[]): Profile {
  if (profiles.length === 0) throw new Error("combineProfiles called with empty array");
  if (profiles.length === 1) return profiles[0];

  const keys = Object.keys(profiles[0].axisWeights) as (keyof AxisWeights)[];

  const axisWeights = Object.fromEntries(
    keys.map((k) => [
      k,
      profiles.reduce((sum, p) => sum + p.axisWeights[k], 0) / profiles.length,
    ])
  ) as unknown as AxisWeights;

  const thresholds: Partial<AxisWeights> = {};
  for (const k of keys) {
    const vals = profiles.map((p) => p.thresholds[k]).filter((v): v is number => v !== undefined);
    if (vals.length > 0) thresholds[k] = Math.max(...vals);
  }

  const dealbreakers = [...new Set(profiles.flatMap((p) => p.dealbreakers))];

  return {
    id: "combined",
    name: profiles.map((p) => p.name).join(" & "),
    enneagramType: profiles.map((p) => p.enneagramType).join("+"),
    description: `Combined profile for ${profiles.map((p) => p.name).join(" and ")}`,
    axisWeights,
    thresholds,
    dealbreakers,
  };
}
