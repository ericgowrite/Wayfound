/**
 * Passive weight nudging — applies small axis weight adjustments in response to
 * user behavior (save, reject, booked, not_going) without requiring explicit
 * user confirmation.
 *
 * Writes go to workspaceWeights first. Global rollup is a separate, gated step.
 */

import { AxisWeights, BehaviorAction, BehaviorEvent, WorkspaceWeights, Profile } from "@/types";
import { AXIS_KEYS } from "@/types";
import { getWorkspaceWeights, setWorkspaceWeights } from "@/lib/behaviorLog";
import { saveProfileToList } from "@/lib/storage";

export const WEIGHT_FLOOR = 0.05;
export const WEIGHT_CEILING = 0.95;

const NUDGE_RATES: Record<BehaviorAction, number> = {
  save: 0.02,
  booked: 0.04,
  reject: -0.015,
  not_going: -0.03,
};

const ROLLUP_FRACTION = 0.2;
const ROLLUP_SAVE_THRESHOLD = 5;

// ── In-memory rate limiter ────────────────────────────────────────────────────
// Per Cloud Run instance. Max 5 nudge-writes per profile per 5-minute window.
// Events that arrive beyond the limit are accumulated as a pending delta and
// applied on the next write that falls within a fresh window.

const RATE_WINDOW_MS = 5 * 60 * 1000;
const MAX_WRITES_PER_WINDOW = 5;

interface RateLimitState {
  windowStart: number;
  count: number;
  pendingDelta: Partial<AxisWeights>; // accumulated nudge deltas beyond the limit
}

const rateLimitMap = new Map<string, RateLimitState>();

function rlKey(userId: string, profileId: string): string {
  return `${userId}:${profileId}`;
}

/**
 * Returns { shouldWrite: true } and any pending delta to flush, or
 * { shouldWrite: false } with the delta to accumulate.
 */
function checkRateLimit(
  userId: string,
  profileId: string,
  delta: Partial<AxisWeights>
): { shouldWrite: boolean; flushDelta: Partial<AxisWeights> } {
  const key = rlKey(userId, profileId);
  const now = Date.now();
  const state = rateLimitMap.get(key) ?? { windowStart: now, count: 0, pendingDelta: {} };

  // New window — reset and flush any pending delta from the previous window.
  if (now - state.windowStart > RATE_WINDOW_MS) {
    const flushDelta = mergeDelta(state.pendingDelta, delta);
    rateLimitMap.set(key, { windowStart: now, count: 1, pendingDelta: {} });
    return { shouldWrite: true, flushDelta };
  }

  if (state.count < MAX_WRITES_PER_WINDOW) {
    // Within budget — write and include any previously accumulated pending delta.
    const flushDelta = mergeDelta(state.pendingDelta, delta);
    rateLimitMap.set(key, { ...state, count: state.count + 1, pendingDelta: {} });
    return { shouldWrite: true, flushDelta };
  }

  // Over budget — accumulate delta for next window.
  rateLimitMap.set(key, { ...state, pendingDelta: mergeDelta(state.pendingDelta, delta) });
  return { shouldWrite: false, flushDelta: {} };
}

function mergeDelta(a: Partial<AxisWeights>, b: Partial<AxisWeights>): Partial<AxisWeights> {
  const result = { ...a };
  for (const key of AXIS_KEYS) {
    if (b[key] !== undefined) {
      result[key] = (result[key] ?? 0) + (b[key] as number);
    }
  }
  return result;
}

// ── Core nudge computation ────────────────────────────────────────────────────

function computeNudgeDelta(
  currentWeights: AxisWeights,
  optionAxisScores: AxisWeights,
  action: BehaviorAction
): Partial<AxisWeights> {
  const rate = NUDGE_RATES[action];
  const delta: Partial<AxisWeights> = {};

  for (const axis of AXIS_KEYS) {
    const gap = optionAxisScores[axis] - currentWeights[axis];
    if (Math.abs(gap) < 0.01) continue; // guard: already at target
    delta[axis] = gap * rate;
  }

  return delta;
}

function applyDeltaToWeights(
  current: AxisWeights,
  delta: Partial<AxisWeights>
): AxisWeights {
  const result = { ...current };
  for (const axis of AXIS_KEYS) {
    if (delta[axis] === undefined) continue;
    const raw = result[axis] + (delta[axis] as number);
    result[axis] = Math.round(
      Math.min(WEIGHT_CEILING, Math.max(WEIGHT_FLOOR, raw)) * 10000
    ) / 10000;
  }
  return result;
}

// ── Public: apply nudge to workspace weights ──────────────────────────────────

export async function applyBehaviorNudge(
  userId: string,
  profileId: string,
  event: BehaviorEvent,
  globalWeights: AxisWeights
): Promise<{ nudgeApplied: boolean; rollupTriggered: boolean }> {
  // Rejects only nudge when reason === "fit" — price/dates/other carry no fit signal.
  if (event.action === "reject" && event.reason !== "fit") {
    return { nudgeApplied: false, rollupTriggered: false };
  }

  const { workspaceId, axisScores, action } = event;

  // Get or create workspace overlay.
  const existing = await getWorkspaceWeights(userId, profileId, workspaceId);
  const workspaceWeights: WorkspaceWeights = existing ?? {
    axisWeights: { ...globalWeights },
    baseWeights: { ...globalWeights },
    saveCount: 0,
    createdAt: new Date().toISOString(),
  };

  const delta = computeNudgeDelta(workspaceWeights.axisWeights, axisScores, action);

  if (Object.keys(delta).length === 0) {
    return { nudgeApplied: false, rollupTriggered: false };
  }

  const { shouldWrite, flushDelta } = checkRateLimit(userId, profileId, delta);

  if (!shouldWrite) {
    return { nudgeApplied: false, rollupTriggered: false };
  }

  const newWeights = applyDeltaToWeights(workspaceWeights.axisWeights, flushDelta);
  const newSaveCount = action === "save" ? workspaceWeights.saveCount + 1 : workspaceWeights.saveCount;

  const updated: WorkspaceWeights = {
    ...workspaceWeights,
    axisWeights: newWeights,
    saveCount: newSaveCount,
  };

  await setWorkspaceWeights(userId, profileId, workspaceId, updated);

  return { nudgeApplied: true, rollupTriggered: false };
}

// ── Phase 3: Global rollup ────────────────────────────────────────────────────

/**
 * Roll up 20% of the workspace overlay's delta-from-base into global axisWeights.
 * Triggered when saveCount >= ROLLUP_SAVE_THRESHOLD, on booked events, or on workspace archive.
 */
export async function rollUpToGlobal(
  userId: string,
  profileId: string,
  workspaceId: string,
  globalProfile: Profile
): Promise<boolean> {
  const workspaceWeights = await getWorkspaceWeights(userId, profileId, workspaceId);
  if (!workspaceWeights) return false;

  const newGlobal = { ...globalProfile.axisWeights };
  let changed = false;

  for (const axis of AXIS_KEYS) {
    const delta = workspaceWeights.axisWeights[axis] - workspaceWeights.baseWeights[axis];
    if (Math.abs(delta) < 0.001) continue;

    const contribution = delta * ROLLUP_FRACTION;
    const raw = newGlobal[axis] + contribution;
    const clamped = Math.round(
      Math.min(WEIGHT_CEILING, Math.max(WEIGHT_FLOOR, raw)) * 10000
    ) / 10000;

    if (clamped !== newGlobal[axis]) {
      newGlobal[axis] = clamped;
      changed = true;
    }
  }

  if (!changed) return false;

  await saveProfileToList(userId, { ...globalProfile, axisWeights: newGlobal });
  return true;
}

/**
 * Check whether a workspace rollup should trigger based on current state.
 * Returns true if saveCount has hit the threshold or action is "booked".
 */
export function shouldTriggerRollup(
  workspaceWeights: WorkspaceWeights | null,
  action: BehaviorAction
): boolean {
  if (action === "booked") return true;
  if (!workspaceWeights) return false;
  return workspaceWeights.saveCount >= ROLLUP_SAVE_THRESHOLD;
}

// ── Effective weights for search ──────────────────────────────────────────────

const MIN_SIGNAL_SAVES = 2;

/**
 * Returns the effective axisWeights for a search in a given workspace.
 * Uses workspace overlay weights if saveCount >= MIN_SIGNAL_SAVES; otherwise global.
 */
export function getEffectiveWeights(
  globalWeights: AxisWeights,
  workspaceWeights: WorkspaceWeights | null
): AxisWeights {
  if (workspaceWeights && workspaceWeights.saveCount >= MIN_SIGNAL_SAVES) {
    return workspaceWeights.axisWeights;
  }
  return globalWeights;
}
