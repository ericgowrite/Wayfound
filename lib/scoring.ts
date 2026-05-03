import { AxisWeights, Profile, ScoredOption } from "@/types";

export function calculateAlignmentScore(
  axisScores: AxisWeights,
  profile: Profile
): number {
  const weights = profile.axisWeights;
  const keys = Object.keys(weights) as (keyof AxisWeights)[];

  const totalWeight = keys.reduce((sum, k) => sum + weights[k], 0);
  const weightedScore = keys.reduce((sum, k) => {
    // Distance from ideal: weight * (1 - |score - weight|)
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

export function sortByAlignment(options: ScoredOption[]): ScoredOption[] {
  return [...options].sort((a, b) => b.alignmentScore - a.alignmentScore);
}
