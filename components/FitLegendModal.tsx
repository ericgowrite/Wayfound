"use client";

import { FIT_TIERS } from "@/lib/fitScore";

interface Props {
  onClose: () => void;
}

export default function FitLegendModal({ onClose }: Props) {
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl w-full max-w-sm shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">What do fit scores mean?</h2>
            <button
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-lg leading-none transition-colors"
              onClick={onClose}
            >
              ×
            </button>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Each option is scored against your profile&apos;s axis weights — how calm, authentic, social, novel, and
            convenient a place is relative to what you value.
          </p>
          <div className="space-y-2.5">
            {FIT_TIERS.map((tier) => (
              <div key={tier.min} className="flex items-center gap-3">
                <span className="text-base w-6 text-center flex-shrink-0">{tier.emoji}</span>
                <div className="flex-1 flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{tier.label}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-500 tabular-nums flex-shrink-0">
                    {tier.min === 0 ? "< 50%" : tier.min === 80 ? "80%+" : `${tier.min}–${tier.min === 65 ? 79 : 64}%`}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-600 mt-4">
            Scores reflect preference alignment, not quality. A 60% option may still be a great choice.
          </p>
        </div>
      </div>
    </div>
  );
}
