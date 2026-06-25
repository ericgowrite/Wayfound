"use client";

import { useState } from "react";
import { EstimatedTravelWindow, FitOutcome, SavedOption } from "@/types";
import { EligiblePrompt } from "@/lib/journey";
import { logEvent } from "@/lib/analytics";

interface Props {
  prompt: EligiblePrompt;
  savedOptions: SavedOption[];
  primaryEnneagramType: string;
  destination: string;
  onUpdate: (optionId: string, fields: Partial<SavedOption>) => void;
  onUpdateMultiple: (updates: { optionId: string; fields: Partial<SavedOption> }[]) => void;
}

const WINDOW_OPTIONS: { value: EstimatedTravelWindow; label: string }[] = [
  { value: "this_month", label: "This month" },
  { value: "next_3_months", label: "Next 3 months" },
  { value: "later", label: "Later" },
  { value: "not_sure", label: "Not sure" },
];

export default function JourneyPromptCard({ prompt, savedOptions, primaryEnneagramType, destination, onUpdate, onUpdateMultiple }: Props) {
  const [showWindowPicker, setShowWindowPicker] = useState(false);
  const [showOtherPicker, setShowOtherPicker] = useState(false);

  if (!prompt) return null;
  const { option } = prompt;

  function dismiss(daysUntilResurface?: number) {
    const dismissCount = (option.promptDismissCount ?? 0) + 1;
    const promptDismissedAt = new Date().toISOString();
    onUpdate(option.id, { promptDismissedAt, promptDismissCount: dismissCount });
    logEvent({
      event: "viyaway_prompt_dismissed",
      promptType: prompt!.type === "fit" ? "fit_confirmation" : "booking_confirmation",
      itemId: option.id,
      dismissCount,
    });
    void daysUntilResurface; // drives re-surface timing via promptDismissedAt + journey.ts logic
  }

  // ── Prompt B: Fit confirmation ─────────────────────────────────────────────
  if (prompt.type === "fit") {
    function confirmFit(fitOutcome: FitOutcome) {
      onUpdate(option.id, {
        journeyState: "fit_confirmed",
        fitOutcome,
        fitConfirmedAt: new Date().toISOString(),
      });
      logEvent({
        event: "viyaway_fit_confirmed",
        itemId: option.id,
        fitOutcome,
        fitScore: option.alignmentScore,
        enneagramType: primaryEnneagramType,
        propertyType: "accommodation",
        destination,
      });
    }

    return (
      <div className="mb-4 bg-white dark:bg-[#1e2d3d] border border-[#E0E8ED] dark:border-[#3D5A6E] rounded-xl px-4 py-4 shadow-sm">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <p className="text-sm font-semibold text-[#2C3E50] dark:text-white">
              Did {option.name} feel like the right fit?
            </p>
            <p className="text-xs text-[#9BB0C1] dark:text-[#6B8299] mt-0.5">
              One tap. Helps ViyaWay learn your fit.
            </p>
          </div>
          <button
            className="text-[#9BB0C1] hover:text-[#6B8299] text-lg leading-none flex-shrink-0 transition-colors"
            onClick={() => {
              const dismissCount = (option.promptDismissCount ?? 0) + 1;
              if (dismissCount >= 3) {
                onUpdate(option.id, { journeyState: "unresolved", promptDismissCount: dismissCount });
              } else {
                dismiss();
              }
            }}
            aria-label="Dismiss"
          >
            ×
          </button>
        </div>
        <div className="flex gap-2">
          <button
            className="flex-1 py-2 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800/50 text-green-700 dark:text-green-400 text-sm font-medium hover:bg-green-100 dark:hover:bg-green-950/50 transition-colors"
            onClick={() => confirmFit("perfect")}
          >
            ✦ Perfect
          </button>
          <button
            className="flex-1 py-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 text-amber-700 dark:text-amber-400 text-sm font-medium hover:bg-amber-100 dark:hover:bg-amber-950/50 transition-colors"
            onClick={() => confirmFit("good")}
          >
            ~ Good
          </button>
          <button
            className="flex-1 py-2 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800/50 text-red-700 dark:text-red-400 text-sm font-medium hover:bg-red-100 dark:hover:bg-red-950/50 transition-colors"
            onClick={() => confirmFit("off")}
          >
            ✕ Off
          </button>
        </div>
      </div>
    );
  }

  // ── Prompt A: Booking confirmation ─────────────────────────────────────────

  // Other saved items that are also "interested" — user may have booked one of these instead
  const otherInterested = savedOptions.filter(
    (o) => o.journeyState === "interested" && o.id !== option.id
  );

  function confirmBooked(travelWindow?: EstimatedTravelWindow) {
    onUpdate(option.id, {
      journeyState: "booked",
      status: "booked",
      bookedAt: new Date().toISOString(),
      ...(travelWindow ? { estimatedTravelWindow: travelWindow } : {}),
      promptDismissedAt: undefined,
      promptDismissCount: 0,
    });
    logEvent({
      event: "viyaway_booking_confirmed",
      itemId: option.id,
      fitScore: option.alignmentScore,
      enneagramType: primaryEnneagramType,
      propertyType: "accommodation",
    });
    setShowWindowPicker(false);
  }

  function confirmBookedOther(other: SavedOption) {
    onUpdateMultiple([
      {
        optionId: other.id,
        fields: { journeyState: "booked", status: "booked", bookedAt: new Date().toISOString() },
      },
      {
        // Keep current option as "interested", just dismiss the prompt for 7 days
        optionId: option.id,
        fields: {
          promptDismissedAt: new Date().toISOString(),
          promptDismissCount: (option.promptDismissCount ?? 0) + 1,
        },
      },
    ]);
    logEvent({
      event: "viyaway_booking_confirmed",
      itemId: other.id,
      fitScore: other.alignmentScore,
      enneagramType: primaryEnneagramType,
      propertyType: "accommodation",
    });
    setShowOtherPicker(false);
  }

  if (showWindowPicker) {
    return (
      <div className="mb-4 bg-white dark:bg-[#1e2d3d] border border-[#5B8BA0]/40 dark:border-[#5B8BA0]/60 rounded-xl px-4 py-4 shadow-sm">
        <p className="text-sm font-medium text-[#2C3E50] dark:text-white mb-3">
          When are you traveling to {option.name}?
        </p>
        <div className="grid grid-cols-2 gap-2">
          {WINDOW_OPTIONS.map((w) => (
            <button
              key={w.value}
              className="py-2 rounded-lg border border-[#E0E8ED] dark:border-[#3D5A6E] text-sm text-[#3D5A6E] dark:text-[#B8D4E3] hover:border-[#5B8BA0] hover:bg-[#5B8BA0]/5 dark:hover:bg-[#5B8BA0]/10 transition-colors"
              onClick={() => confirmBooked(w.value)}
            >
              {w.label}
            </button>
          ))}
        </div>
        <button
          className="mt-2 text-xs text-[#9BB0C1] hover:text-[#6B8299] w-full text-center transition-colors"
          onClick={() => confirmBooked()}
        >
          Skip — just mark as booked
        </button>
      </div>
    );
  }

  return (
    <div className="mb-4 bg-white dark:bg-[#1e2d3d] border border-[#E0E8ED] dark:border-[#3D5A6E] rounded-xl px-4 py-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-[#2C3E50] dark:text-white">
          Did you end up booking {option.name}?
        </p>
        <button
          className="text-[#9BB0C1] hover:text-[#6B8299] text-lg leading-none flex-shrink-0 transition-colors"
          onClick={() => dismiss()}
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
      <div className="flex gap-2 mt-3 flex-wrap">
        <button
          className="flex-1 py-2 rounded-lg bg-[#5B8BA0] text-white text-sm font-medium hover:bg-[#4A7A8F] transition-colors"
          onClick={() => setShowWindowPicker(true)}
        >
          Yes, booked ✓
        </button>
        <button
          className="px-4 py-2 rounded-lg border border-[#E0E8ED] dark:border-[#3D5A6E] text-sm text-[#6B8299] dark:text-[#9BB0C1] hover:bg-[#EEF4F8] dark:hover:bg-[#2a3f52] transition-colors whitespace-nowrap"
          onClick={() => dismiss()}
        >
          Not yet
        </button>
        <button
          className="px-4 py-2 rounded-lg border border-[#E0E8ED] dark:border-[#3D5A6E] text-sm text-[#9BB0C1] dark:text-[#6B8299] hover:text-red-500 dark:hover:text-red-400 hover:border-red-300 dark:hover:border-red-800 transition-colors whitespace-nowrap"
          onClick={() =>
            onUpdate(option.id, { journeyState: "not_going", status: "rejected" })
          }
        >
          No longer interested
        </button>
      </div>

      {/* "I booked a different hotel" — only shown when other interested options exist */}
      {otherInterested.length > 0 && (
        <div className="mt-3 border-t border-[#E0E8ED] dark:border-[#2a3f52] pt-3">
          {!showOtherPicker ? (
            <button
              className="text-xs text-[#9BB0C1] dark:text-[#6B8299] hover:text-[#5B8BA0] dark:hover:text-[#7DBAD4] transition-colors"
              onClick={() => setShowOtherPicker(true)}
            >
              I booked a different hotel →
            </button>
          ) : (
            <div className="space-y-1.5">
              <p className="text-xs text-[#9BB0C1] dark:text-[#6B8299]">Which one did you book?</p>
              {otherInterested.map((other) => (
                <button
                  key={other.id}
                  className="w-full text-left px-3 py-2 rounded-lg border border-[#E0E8ED] dark:border-[#3D5A6E] text-sm text-[#3D5A6E] dark:text-[#B8D4E3] hover:border-[#5B8BA0] hover:bg-[#5B8BA0]/5 dark:hover:bg-[#5B8BA0]/10 transition-colors"
                  onClick={() => confirmBookedOther(other)}
                >
                  {other.name}
                </button>
              ))}
              <button
                className="text-xs text-[#9BB0C1] dark:text-[#6B8299] hover:text-[#3D5A6E] dark:hover:text-[#B8D4E3] transition-colors"
                onClick={() => setShowOtherPicker(false)}
              >
                Never mind
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
