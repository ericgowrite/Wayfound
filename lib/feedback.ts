import { AxisWeights, ScoredOption, TripWorkspace } from "@/types";
import { getTopAxes } from "@/lib/assessment";

/**
 * Post-trip feedback — Phase 1 of the feedback/memory system (MVP backlog #1/#2).
 * Personal to the submitting user only. Shared/community feedback (backlog #6)
 * is deferred until property identity exists.
 */

// Low-energy checkbox phrasing per axis — framed as a one-directional "this
// turned out worse than expected" flag, matching how people naturally report
// a letdown (e.g. "noisier than expected") rather than a bipolar scale.
export const AXIS_FEEDBACK_FLAGS: Record<keyof AxisWeights, string> = {
  calm: "Busier or noisier than expected",
  designSincerity: "Felt more touristy/staged than expected",
  valueIntegrity: "Worse value than expected",
  socialPermeability: "More social or less private than expected",
  autonomy: "More rigid or scheduled than expected",
  novelty: "Less distinctive than expected",
  locationFriction: "Harder to reach than expected",
};

/**
 * Which axis flags to show for a given traveler — limited to their top 3
 * defining axes so the checkbox list stays short and "type relevant"
 * rather than showing all 7 axes to everyone regardless of fit.
 */
export function relevantFeedbackAxes(weights: AxisWeights): (keyof AxisWeights)[] {
  return getTopAxes(weights).map((a) => a.axis);
}

/**
 * True when an option is ready for the post-trip feedback prompt:
 * marked "booked", the workspace's trip end date has passed, and feedback
 * hasn't already been submitted for it.
 */
export function isFeedbackEligible(option: ScoredOption, workspace: TripWorkspace): boolean {
  if (option.status !== "booked") return false;
  if (option.feedback) return false;
  const end = workspace.dates?.end;
  if (!end) return false;
  const endDate = new Date(end);
  if (Number.isNaN(endDate.getTime())) return false;
  return endDate.getTime() < Date.now();
}
