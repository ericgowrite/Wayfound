import { fetchWithAuth } from "@/lib/fetchWithAuth";

export type AnalyticsEvent =
  | { event: "viyaway_item_saved"; itemId: string; propertyType: string; fitScore: number; enneagramType: string }
  | { event: "viyaway_item_interested"; itemId: string; estimatedTravelWindow: string | null }
  | { event: "viyaway_booking_confirmed"; itemId: string; fitScore: number; enneagramType: string; propertyType: string }
  | { event: "viyaway_fit_confirmed"; itemId: string; fitOutcome: string; fitScore: number; enneagramType: string; propertyType: string; destination: string }
  | { event: "viyaway_prompt_dismissed"; promptType: string; itemId: string; dismissCount: number };

/** Fire-and-forget — never throws, never blocks the UI. */
export function logEvent(payload: AnalyticsEvent): void {
  fetchWithAuth("/api/analytics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => {});
}
