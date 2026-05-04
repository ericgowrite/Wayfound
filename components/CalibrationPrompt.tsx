"use client";

import { useState } from "react";
import { Profile, AxisWeights } from "@/types";
import { CalibrationSuggestion, suggestionSentence, applyCalibration } from "@/lib/calibration";

interface Props {
  profile: Profile;
  suggestions: CalibrationSuggestion[];
  savesCount: number;
  onAccept: (newWeights: AxisWeights) => void;
  onDismiss: () => void;
}

export default function CalibrationPrompt({ profile, suggestions, savesCount, onAccept, onDismiss }: Props) {
  const [showDetails, setShowDetails] = useState(false);

  function handleAccept() {
    onAccept(applyCalibration(profile, suggestions));
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl w-full max-w-md shadow-2xl">
        <div className="p-6">
          <div className="flex items-start gap-3 mb-4">
            <span className="text-2xl flex-shrink-0">✦</span>
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-white leading-tight">
                Profile calibration for {profile.name}
              </h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">
                Based on your last {savesCount} saves, I noticed:
              </p>
            </div>
          </div>

          <ul className="space-y-2 mb-4">
            {suggestions.map((s) => (
              <li key={s.axis} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                <span className="text-blue-500 flex-shrink-0 mt-0.5">→</span>
                <span>{suggestionSentence(s)}</span>
              </li>
            ))}
          </ul>

          {showDetails && (
            <div className="mb-4 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800">
                    <th className="text-left px-3 py-2 text-gray-500 dark:text-gray-400 font-medium">Axis</th>
                    <th className="text-right px-3 py-2 text-gray-500 dark:text-gray-400 font-medium">Saved avg</th>
                    <th className="text-right px-3 py-2 text-gray-500 dark:text-gray-400 font-medium">Current</th>
                    <th className="text-right px-3 py-2 text-gray-500 dark:text-gray-400 font-medium">Proposed</th>
                  </tr>
                </thead>
                <tbody>
                  {suggestions.map((s, i) => (
                    <tr key={s.axis} className={i % 2 === 0 ? "" : "bg-gray-50 dark:bg-gray-800/50"}>
                      <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{s.axisLabel}</td>
                      <td className="px-3 py-2 text-right text-gray-600 dark:text-gray-400 tabular-nums">
                        {Math.round(s.avgSaved * 100)}%
                      </td>
                      <td className="px-3 py-2 text-right text-gray-600 dark:text-gray-400 tabular-nums">
                        {Math.round(s.currentWeight * 100)}%
                      </td>
                      <td className="px-3 py-2 text-right text-blue-600 dark:text-blue-400 tabular-nums font-medium">
                        {Math.round(s.suggestedWeight * 100)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <button
            className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 underline underline-offset-2 transition-colors mb-5"
            onClick={() => setShowDetails((v) => !v)}
          >
            {showDetails ? "Hide details" : "Show details"}
          </button>

          <div className="flex gap-2">
            <button
              className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-500 transition-colors font-medium"
              onClick={handleAccept}
            >
              Update profile
            </button>
            <button
              className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              onClick={onDismiss}
            >
              Keep current
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
