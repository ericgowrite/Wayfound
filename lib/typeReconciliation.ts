/**
 * Type-label reconciliation — detects when a profile's global axisWeights have
 * drifted far enough from the stored enneagramType that a different archetype is
 * now a closer match.
 *
 * Never auto-changes the label. Surfaces softly after N=3 consecutive checks
 * confirming a mismatch, or after 14 days of sustained drift.
 * The surface trigger is stored on the profile; UI reads it and shows the prompt.
 */

import { Profile, AxisWeights } from "@/types";
import { AXIS_KEYS } from "@/types";
import { CORE_ARCHETYPES } from "@/lib/assessment";
import { saveProfileToList } from "@/lib/storage";

const MISMATCH_THRESHOLD = 3;       // consecutive checks before surfacing
const RECONCILE_COOLDOWN_MS = 24 * 60 * 60 * 1000;  // check at most once per day
const MISMATCH_SUSTAIN_DAYS = 14;   // surface after 14 days of sustained drift

/**
 * Compute Euclidean distance between two axis weight vectors.
 * Lower = more similar.
 */
function axisDistance(a: AxisWeights, b: AxisWeights): number {
  return Math.sqrt(
    AXIS_KEYS.reduce((sum, axis) => sum + Math.pow((a[axis] ?? 0.5) - (b[axis] ?? 0.5), 2), 0)
  );
}

/**
 * Find the archetype (1-9) whose axisWeights are closest to the given weights.
 * Returns the type number as a string, matching Profile.enneagramType format.
 */
function closestArchetype(weights: AxisWeights): string {
  let bestType = 9;
  let bestDist = Infinity;

  for (const [typeStr, archetype] of Object.entries(CORE_ARCHETYPES)) {
    const dist = axisDistance(weights, archetype.axisWeights);
    if (dist < bestDist) {
      bestDist = dist;
      bestType = Number(typeStr);
    }
  }

  return String(bestType);
}

/**
 * Run a reconciliation check on the profile.
 * - Bails out if checked within the last 24 hours.
 * - Increments mismatch count if the closest archetype differs from stored type.
 * - Resets mismatch count on match.
 * - Marks the profile for soft surface notification when threshold is crossed.
 * - Writes the updated mismatch state back to Firestore (only when something changed).
 */
export async function checkTypeReconciliation(
  userId: string,
  profile: Profile
): Promise<void> {
  const now = Date.now();

  // Cooldown: don't run more than once per day.
  if (profile.lastReconciledAt) {
    const elapsed = now - new Date(profile.lastReconciledAt).getTime();
    if (elapsed < RECONCILE_COOLDOWN_MS) return;
  }

  const closestType = closestArchetype(profile.axisWeights);
  const currentType = profile.enneagramType?.replace(/\D/g, ""); // normalise "Type 3" → "3"
  const isMismatch = closestType !== currentType;

  const prevMismatchCount = profile.reconciledMismatchCount ?? 0;
  const newMismatchCount = isMismatch ? prevMismatchCount + 1 : 0;

  const shouldSurface =
    isMismatch &&
    (newMismatchCount >= MISMATCH_THRESHOLD ||
      (profile.lastReconciledAt &&
        now - new Date(profile.lastReconciledAt).getTime() >= MISMATCH_SUSTAIN_DAYS * 24 * 60 * 60 * 1000));

  const updated: Profile = {
    ...profile,
    lastReconciledAt: new Date().toISOString(),
    reconciledMismatchCount: newMismatchCount,
    // pendingTypeReconciliation is read by the UI to show the soft prompt.
    ...(shouldSurface
      ? { pendingTypeReconciliation: closestType }
      : { pendingTypeReconciliation: undefined }),
  };

  // Only write if state changed.
  if (
    updated.lastReconciledAt !== profile.lastReconciledAt ||
    updated.reconciledMismatchCount !== profile.reconciledMismatchCount
  ) {
    await saveProfileToList(userId, updated);
  }
}
