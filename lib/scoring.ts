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

export function combineProfiles(profiles: Profile[]): Profile {
  if (profiles.length === 1) return profiles[0];

  const keys = Object.keys(profiles[0].axisWeights) as (keyof AxisWeights)[];

  // Average axis weights across all travelers
  const axisWeights = Object.fromEntries(
    keys.map((k) => [
      k,
      profiles.reduce((sum, p) => sum + p.axisWeights[k], 0) / profiles.length,
    ])
  ) as unknown as AxisWeights;

  // Strictest threshold per axis (highest value = hardest to satisfy)
  const thresholds: Partial<AxisWeights> = {};
  for (const k of keys) {
    const vals = profiles.map((p) => p.thresholds[k]).filter((v): v is number => v !== undefined);
    if (vals.length > 0) thresholds[k] = Math.max(...vals);
  }

  // Union of all dealbreakers (deduplicated)
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
