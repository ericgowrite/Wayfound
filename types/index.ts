export interface AxisWeights {
  calm: number;
  designSincerity: number;
  valueIntegrity: number;
  socialPermeability: number;
  autonomy: number;
  novelty: number;
  locationFriction: number;
}

export interface Profile {
  id: string;
  name: string;
  type: string;
  description: string;
  axisWeights: AxisWeights;
  thresholds: Partial<AxisWeights>;
  dealbreakers: string[];
}

export interface TripWorkspace {
  id: string;
  name: string;
  destination: string;
  dates?: { start: string; end: string };
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
  | "destination";

export interface Search {
  id: string;
  workspaceId: string;
  query: string;
  category: SearchCategory;
  rawResults: RawResult[];
  scoredResults: ScoredOption[];
  searchedAt: string;
}

export interface RawResult {
  name: string;
  source: string;
  description: string;
  price?: string;
}

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
  dealbreakersTriggered: string[];
  fitExplanation: string;
  tradeoffs: string[];
  status: "new" | "interested" | "rejected" | "booked";
  notes: string;
}

export interface SavedOption extends ScoredOption {
  savedAt: string;
  tags: string[];
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
