import { AxisWeights, AXIS_KEYS, AXIS_LABELS, Profile, ScoredOption } from "@/types";

// ── Storage keys ─────────────────────────────────────────────────────────────
const SAVES_KEY = "vg:saves";
const REJECTS_KEY = "vg:rejects";
const CAL_LOG_KEY = "vg:cal_log";
const CAL_COUNT_PREFIX = "vg:cal_count:";

export const CALIBRATION_THRESHOLD = 10;
const GAP_THRESHOLD = 0.05;

// ── Types ────────────────────────────────────────────────────────────────────

export interface ActionRecord {
  optionId: string;
  optionName: string;
  axisScores: AxisWeights;
  fitScore: number;
  profileId: string;
  timestamp: string;
}

export interface CalibrationSuggestion {
  axis: keyof AxisWeights;
  axisLabel: string;
  avgSaved: number;       // observed average axis score across saved options
  currentWeight: number;  // current profile weight (target value)
  suggestedWeight: number; // proposed adjustment (halfway toward observed)
  direction: "higher" | "lower";
}

export interface CalibrationEvent {
  timestamp: string;
  profileId: string;
  savesCount: number;
  suggestions: CalibrationSuggestion[];
  accepted: boolean;
  previousWeights: AxisWeights;
  newWeights: AxisWeights | null;
}

// How each axis maps to natural-language descriptions
const AXIS_NATURAL: Record<keyof AxisWeights, { higher: string; lower: string }> = {
  calm:               { higher: "calmer",         lower: "more stimulating" },
  designSincerity:    { higher: "more authentic", lower: "more generic" },
  valueIntegrity:     { higher: "better value",   lower: "more premium" },
  socialPermeability: { higher: "more private",   lower: "more social" },
  autonomy:           { higher: "more self-directed", lower: "more structured" },
  novelty:            { higher: "more familiar",  lower: "more novel" },
  locationFriction:   { higher: "more convenient", lower: "more remote" },
};

export function suggestionSentence(s: CalibrationSuggestion): string {
  const adj = AXIS_NATURAL[s.axis][s.direction];
  const avg = Math.round(s.avgSaved * 100);
  const cur = Math.round(s.currentWeight * 100);
  return `You prefer ${adj} options (avg ${avg}%) than your profile currently targets (${cur}%)`;
}

// ── Storage helpers ───────────────────────────────────────────────────────────

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function getSaves(): ActionRecord[] {
  return readJSON<ActionRecord[]>(SAVES_KEY, []);
}

export function getRejects(): ActionRecord[] {
  return readJSON<ActionRecord[]>(REJECTS_KEY, []);
}

export function getCalibrationLog(): CalibrationEvent[] {
  return readJSON<CalibrationEvent[]>(CAL_LOG_KEY, []);
}

// ── Tracking ─────────────────────────────────────────────────────────────────

export function trackSave(option: ScoredOption, profileId: string): void {
  const saves = getSaves();
  if (saves.some((s) => s.optionId === option.id && s.profileId === profileId)) return;
  saves.push({
    optionId: option.id,
    optionName: option.name,
    axisScores: option.axisScores,
    fitScore: option.alignmentScore,
    profileId,
    timestamp: new Date().toISOString(),
  });
  localStorage.setItem(SAVES_KEY, JSON.stringify(saves));
}

export function trackReject(option: ScoredOption, profileId: string): void {
  const rejects = getRejects();
  if (rejects.some((r) => r.optionId === option.id && r.profileId === profileId)) return;
  rejects.push({
    optionId: option.id,
    optionName: option.name,
    axisScores: option.axisScores,
    fitScore: option.alignmentScore,
    profileId,
    timestamp: new Date().toISOString(),
  });
  localStorage.setItem(REJECTS_KEY, JSON.stringify(rejects));
}

// ── Calibration trigger ───────────────────────────────────────────────────────

function getLastCalCount(profileId: string): number {
  return readJSON<number>(`${CAL_COUNT_PREFIX}${profileId}`, 0);
}

// Returns true if the user has accumulated CALIBRATION_THRESHOLD new saves
// since the last calibration prompt was shown.
export function shouldTriggerCalibration(profileId: string): boolean {
  const count = getSaves().filter((s) => s.profileId === profileId).length;
  const last = getLastCalCount(profileId);
  return count >= CALIBRATION_THRESHOLD && count - last >= CALIBRATION_THRESHOLD;
}

// Call this immediately when showing the prompt so it doesn't fire again until
// another CALIBRATION_THRESHOLD saves accumulate.
export function markCalibrationShown(profileId: string): void {
  const count = getSaves().filter((s) => s.profileId === profileId).length;
  localStorage.setItem(`${CAL_COUNT_PREFIX}${profileId}`, String(count));
}

// ── Analysis ─────────────────────────────────────────────────────────────────

export function analyzeCalibration(profile: Profile): CalibrationSuggestion[] {
  const saves = getSaves().filter((s) => s.profileId === profile.id);
  if (saves.length < CALIBRATION_THRESHOLD) return [];

  return AXIS_KEYS.flatMap((axis) => {
    const avgSaved = saves.reduce((sum, s) => sum + s.axisScores[axis], 0) / saves.length;
    const currentWeight = profile.axisWeights[axis];
    const gap = avgSaved - currentWeight;

    if (Math.abs(gap) <= GAP_THRESHOLD) return [];

    // Move halfway toward observed preference, rounded to 2 dp, clamped [0,1]
    const raw = currentWeight + gap * 0.5;
    const suggestedWeight = Math.round(Math.min(1, Math.max(0, raw)) * 100) / 100;

    return [{
      axis,
      axisLabel: AXIS_LABELS[axis],
      avgSaved: Math.round(avgSaved * 100) / 100,
      currentWeight,
      suggestedWeight,
      direction: (gap > 0 ? "higher" : "lower") as "higher" | "lower",
    }];
  });
}

export function applyCalibration(
  profile: Profile,
  suggestions: CalibrationSuggestion[]
): AxisWeights {
  const weights = { ...profile.axisWeights };
  for (const s of suggestions) {
    weights[s.axis] = s.suggestedWeight;
  }
  return weights;
}

// ── Event logging ─────────────────────────────────────────────────────────────

export function logCalibrationEvent(event: CalibrationEvent): void {
  try {
    const log = getCalibrationLog();
    log.push(event);
    // Cap at 100 entries to prevent localStorage quota exhaustion
    localStorage.setItem(CAL_LOG_KEY, JSON.stringify(log.slice(-100)));
  } catch {}
}
