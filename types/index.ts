export interface AxisWeights {
  calm: number;
  designSincerity: number;
  valueIntegrity: number;
  socialPermeability: number;
  autonomy: number;
  novelty: number;
  locationFriction: number;
}

export interface ProfileTemplate {
  type: string;
  description: string;
  axisWeights: AxisWeights;
  thresholds: Partial<AxisWeights>;
  dealbreakers: string[];
}

export interface Profile {
  id: string;
  name: string;
  enneagramType: string;
  description: string;
  axisWeights: AxisWeights;
  thresholds: Partial<AxisWeights>;
  dealbreakers: string[];
  isDefault?: boolean;
  pastTripContext?: string;
  calibrationCount?: number;
  lastCalibratedAt?: string;
  calibrationPath?: "wing" | "fresh";
  answeredAspirrationally?: boolean;
  // Passive personalization — type drift tracking
  lastReconciledAt?: string;
  reconciledMismatchCount?: number;
  /** Set when type drift crosses the mismatch threshold. UI reads to show the soft prompt. */
  pendingTypeReconciliation?: string;
}

// Legacy alias used in older API call sites
export type UserProfile = Profile;

export interface TripWorkspace {
  id: string;
  name: string;
  destination: string;
  dates?: { start: string; end: string };
  partySize?: number;
  travelers: string[];
  searches: Search[];
  savedOptions: SavedOption[];
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export type SearchCategory =
  | "accommodation"
  | "tour"
  | "restaurant"
  | "activity"
  | "attraction";

export interface Search {
  id: string;
  workspaceId: string;
  query: string;
  category: SearchCategory;
  rawResults: RawResult[];
  scoredResults: ScoredOption[];
  searchedAt: string;
}

export interface LoadingContentItem {
  type: "fact" | "recommendation";
  traveler: string | null; // traveler name, "both", or null for facts
  text: string;
}

export interface RawResult {
  name: string;
  source: string;
  description: string;
  price?: string;
}

// Per-traveler score stored inline with each result
export interface TravelerScore {
  alignmentScore: number;
  thresholdViolations: string[];
}

// Low-energy post-trip feedback — personal to the submitting user (Phase 1 of
// the feedback/memory system; not yet shared across users — see MVP backlog #1/#6).
export interface PropertyFeedback {
  metExpectations: "yes" | "no" | "mixed";
  // Axis keys the traveler flagged as notably off from what was expected —
  // e.g. ["calm"] for "noisier than I expected."
  axisFlags: (keyof AxisWeights)[];
  note: string;
  submittedAt: string;
}

export type JourneyState =
  | "saved"
  | "interested"
  | "booked"
  | "fit_confirmed"
  | "not_going"
  | "unresolved";

export type EstimatedTravelWindow =
  | "this_month"
  | "next_3_months"
  | "later"
  | "not_sure";

export type FitOutcome = "perfect" | "good" | "off";

export interface ScoredOption {
  id: string;
  searchId: string;
  name: string;
  source: string;
  description: string;
  price?: string;
  axisScores: AxisWeights;
  alignmentScore: number;
  thresholdViolations: string[];
  watchOutFor: string[];
  dealbreakersTriggered: string[];
  fitExplanation: string;
  judgmentLine?: string;
  tradeoffs: string[];
  status: "new" | "interested" | "rejected" | "booked";
  notes: string;
  // Keyed by profile.id — populated for every traveler on the workspace
  travelerScores?: Record<string, TravelerScore>;
  // Inline chat history persisted per option
  chatHistory?: ChatMessage[];
  // Set once the traveler has answered the post-trip feedback prompt
  feedback?: PropertyFeedback;
}

export interface SavedOption extends ScoredOption {
  savedAt: string;
  tags: string[];
  // Journey state machine — tracks the lifecycle from save → outcome
  journeyState: JourneyState;
  estimatedTravelWindow?: EstimatedTravelWindow;
  fitOutcome?: FitOutcome;
  fitConfirmedAt?: string;
  bookedAt?: string;
  promptDismissedAt?: string;
  promptDismissCount?: number;
}

export const AXIS_LABELS: Record<keyof AxisWeights, string> = {
  calm: "Calm ↔ Stimulation",
  designSincerity: "Design Sincerity",
  valueIntegrity: "Value Integrity",
  socialPermeability: "Social Permeability",
  autonomy: "Autonomy ↔ Structure",
  novelty: "Novelty ↔ Familiarity",
  locationFriction: "Location Friction",
};

export const AXIS_DESCRIPTIONS: Record<keyof AxisWeights, string> = {
  calm: "0 = high energy → 1 = peaceful",
  designSincerity: "0 = staged/generic → 1 = genuine",
  valueIntegrity: "0 = overpriced → 1 = fair value",
  socialPermeability: "0 = highly social → 1 = private",
  autonomy: "0 = programmed → 1 = free",
  novelty: "0 = exotic → 1 = predictable",
  locationFriction: "0 = remote/complex → 1 = convenient",
};

export const AXIS_KEYS = Object.keys(AXIS_LABELS) as (keyof AxisWeights)[];

export interface DeepDiveResult {
  overview: string;
  whyItFits: string[];
  watchOutFor: string[];
  standoutFeatures: string[];
  bottomLine: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

// ── Personalization loop ───────────────────────────────────────────────────────

export type RejectReason = "fit" | "price" | "dates" | "other";

export type BehaviorAction = "save" | "reject" | "booked" | "not_going";

export interface BehaviorEvent {
  action: BehaviorAction;
  /** Required when action === "reject"; null for all other actions. */
  reason: RejectReason | null;
  optionId: string;
  optionName: string;
  axisScores: AxisWeights;
  fitScore: number;
  workspaceId: string;
  timestamp: string;
}

/** Per-workspace axis weight overlay stored alongside the global profile. */
export interface WorkspaceWeights {
  /** Current weights, nudged by activity in this workspace. */
  axisWeights: AxisWeights;
  /** Snapshot of global weights when this workspace was created — used for rollup delta. */
  baseWeights: AxisWeights;
  saveCount: number;
  createdAt: string;
}

export interface SearchHistoryEntry {
  id: string;
  query: string;
  workspaceId: string;
  timestamp: string;
}
