import { EstimatedTravelWindow, SavedOption } from "@/types";

const DAY_MS = 24 * 60 * 60 * 1000;

function travelWindowMs(window: EstimatedTravelWindow): number {
  switch (window) {
    case "this_month": return 30 * DAY_MS;
    case "next_3_months": return 90 * DAY_MS;
    case "later": return 180 * DAY_MS;
    case "not_sure": return 90 * DAY_MS;
  }
}

export type EligiblePrompt =
  | { type: "fit"; option: SavedOption }
  | { type: "booking"; option: SavedOption }
  | null;

/**
 * Returns the highest-priority prompt to surface, or null if none.
 * Prompt B (post-stay fit) takes precedence over Prompt A (booking confirm).
 */
export function getEligiblePrompt(
  savedOptions: SavedOption[],
  now = Date.now()
): EligiblePrompt {
  const sortByRecency = (a: SavedOption, b: SavedOption) =>
    new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime();

  // Prompt B — post-stay fit confirmation
  const fitCandidates = savedOptions
    .filter((opt) => {
      if (opt.journeyState !== "booked") return false;
      // Max 3 dismiss attempts
      if ((opt.promptDismissCount ?? 0) >= 3) return false;
      // 14-day re-surface window after dismiss
      if (opt.promptDismissedAt) {
        const dismissedAt = new Date(opt.promptDismissedAt).getTime();
        if (now - dismissedAt < 14 * DAY_MS) return false;
      }
      // Check if travel window has elapsed
      const bookedAt = opt.bookedAt
        ? new Date(opt.bookedAt).getTime()
        : new Date(opt.savedAt).getTime();
      if (opt.estimatedTravelWindow) {
        return now - bookedAt > travelWindowMs(opt.estimatedTravelWindow);
      }
      // No window set: 30 days since booking
      return now - bookedAt > 30 * DAY_MS;
    })
    .sort(sortByRecency);

  if (fitCandidates[0]) return { type: "fit", option: fitCandidates[0] };

  // Prompt A — booking confirmation
  const bookingCandidates = savedOptions
    .filter((opt) => {
      if (opt.journeyState !== "interested") return false;
      // 7-day re-surface window after "Not yet" dismiss
      if (opt.promptDismissedAt) {
        const dismissedAt = new Date(opt.promptDismissedAt).getTime();
        if (now - dismissedAt < 7 * DAY_MS) return false;
      }
      return true;
    })
    .sort(sortByRecency);

  if (bookingCandidates[0]) return { type: "booking", option: bookingCandidates[0] };

  return null;
}

/** Display label + dot color for each journey state. */
export const JOURNEY_DISPLAY: Record<
  string,
  { label: string; dot: string; textColor: string }
> = {
  saved: { label: "Saved", dot: "bg-gray-400", textColor: "text-gray-500 dark:text-gray-400" },
  interested: { label: "Considering", dot: "bg-amber-400", textColor: "text-amber-600 dark:text-amber-400" },
  booked: { label: "Upcoming", dot: "bg-blue-500", textColor: "text-blue-600 dark:text-blue-400" },
  "fit_confirmed:perfect": { label: "✦ Perfect fit", dot: "bg-green-500", textColor: "text-green-600 dark:text-green-400" },
  "fit_confirmed:good": { label: "~ Good fit", dot: "bg-amber-400", textColor: "text-amber-600 dark:text-amber-400" },
  "fit_confirmed:off": { label: "✕ Off", dot: "bg-red-500", textColor: "text-red-600 dark:text-red-400" },
  not_going: { label: "Not going", dot: "bg-gray-300", textColor: "text-gray-400 dark:text-gray-500" },
  unresolved: { label: "Did you go?", dot: "bg-gray-400", textColor: "text-gray-500 dark:text-gray-400" },
};

export function journeyDisplayKey(opt: SavedOption): string {
  if (opt.journeyState === "fit_confirmed" && opt.fitOutcome) {
    return `fit_confirmed:${opt.fitOutcome}`;
  }
  return opt.journeyState;
}
