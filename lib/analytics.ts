import { fetchWithAuth } from "@/lib/fetchWithAuth";

export type AnalyticsEvent =
  | { event: "wayfound_item_saved"; itemId: string; propertyType: string; fitScore: number; enneagramType: string }
  | { event: "wayfound_item_interested"; itemId: string; estimatedTravelWindow: string | null }
  | { event: "wayfound_booking_confirmed"; itemId: string; fitScore: number; enneagramType: string; propertyType: string }
  | { event: "wayfound_fit_confirmed"; itemId: string; fitOutcome: string; fitScore: number; enneagramType: string; propertyType: string; destination: string }
  | { event: "wayfound_prompt_dismissed"; promptType: string; itemId: string; dismissCount: number }
  | { event: "wayfound_search_run"; query: string; category: string; destination: string | null; resultCount: number }
  | { event: "wayfound_result_expanded"; itemId: string; fitScore: number; enneagramType: string }
  | { event: "wayfound_link_clicked"; itemId: string; urlStatus: string; destination: string | null }
  // Satisfaction and ranking signals
  | { event: "wayfound_load_more"; query: string; category: string; existingCount: number }
  | { event: "wayfound_comparison_opened"; itemCount: number }
  | { event: "wayfound_result_saved_rank"; itemId: string; rank: number; fitScore: number };

/** Fire-and-forget — never throws, never blocks the UI. */
export function logEvent(payload: AnalyticsEvent): void {
  fetchWithAuth("/api/analytics", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => {});
}
