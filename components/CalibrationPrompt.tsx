"use client";

import { useState } from "react";
import { Profile, AxisWeights } from "@/types";
import { CalibrationSuggestion, suggestionSentence, applyCalibration } from "@/lib/calibration";

interface Props {
  profile: Profile;
  suggestions: CalibrationSuggestion[];
  savesCount: number;
  /** Overrides the "Based on your last N saves" line when calibration comes from a different signal. */
  sourceDescription?: string;
  onAccept: (newWeights: AxisWeights) => void;
  onDismiss: () => void;
}

export default function CalibrationPrompt({ profile, suggestions, savesCount, sourceDescription, onAccept, onDismiss }: Props) {
  const [showDetails, setShowDetails] = useState(false);

  function handleAccept() {
    onAccept(applyCalibration(profile, suggestions));
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#1e2d3d] border border-[#E0E8ED] dark:border-[#3D5A6E] rounded-2xl w-full max-w-md shadow-2xl">
        <div className="p-6">
          <div className="flex items-start gap-3 mb-4">
            <span className="text-2xl flex-shrink-0">✦</span>
            <div>
              <h2 className="text-base font-semibold text-[#2C3E50] dark:text-white leading-tight">
                Profile calibration for {profile.name}
              </h2>
              <p className="text-[#6B8299] dark:text-[#9BB0C1] text-sm mt-0.5">
                {sourceDescription ?? `Based on your last ${savesCount} saves, I noticed:`}
              </p>
            </div>
          </div>

          <ul className="space-y-2 mb-4">
            {suggestions.map((s) => (
              <li key={s.axis} className="flex items-start gap-2 text-sm text-[#3D5A6E] dark:text-[#B8D4E3]">
                <span className="text-[#E8A87C] flex-shrink-0 mt-0.5">→</span>
                <span>{suggestionSentence(s)}</span>
              </li>
            ))}
          </ul>

          {showDetails && (
            <div className="mb-4 rounded-xl border border-[#E0E8ED] dark:border-[#3D5A6E] overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[#F8FAFB] dark:bg-[#2a3f52]">
                    <th className="text-left px-3 py-2 text-[#6B8299] dark:text-[#9BB0C1] font-medium">Axis</th>
                    <th className="text-right px-3 py-2 text-[#6B8299] dark:text-[#9BB0C1] font-medium">Saved avg</th>
                    <th className="text-right px-3 py-2 text-[#6B8299] dark:text-[#9BB0C1] font-medium">Current</th>
                    <th className="text-right px-3 py-2 text-[#6B8299] dark:text-[#9BB0C1] font-medium">Proposed</th>
                  </tr>
                </thead>
                <tbody>
                  {suggestions.map((s, i) => (
                    <tr key={s.axis} className={i % 2 === 0 ? "" : "bg-[#F8FAFB] dark:bg-[#2a3f52]/50"}>
                      <td className="px-3 py-2 text-[#3D5A6E] dark:text-[#B8D4E3]">{s.axisLabel}</td>
                      <td className="px-3 py-2 text-right text-[#6B8299] dark:text-[#9BB0C1] tabular-nums">
                        {Math.round(s.avgSaved * 100)}%
                      </td>
                      <td className="px-3 py-2 text-right text-[#6B8299] dark:text-[#9BB0C1] tabular-nums">
                        {Math.round(s.currentWeight * 100)}%
                      </td>
                      <td className="px-3 py-2 text-right text-[#5B8BA0] dark:text-[#7DBAD4] tabular-nums font-medium">
                        {Math.round(s.suggestedWeight * 100)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <button
            className="text-xs text-[#9BB0C1] dark:text-[#6B8299] hover:text-[#6B8299] dark:hover:text-[#B8D4E3] underline underline-offset-2 transition-colors mb-5"
            onClick={() => setShowDetails((v) => !v)}
          >
            {showDetails ? "Hide details" : "Show details"}
          </button>

          <div className="flex gap-2">
            <button
              className="flex-1 px-4 py-2 bg-[#5B8BA0] text-white text-sm rounded-lg hover:bg-[#4A7A8F] transition-colors font-medium"
              onClick={handleAccept}
            >
              Update profile
            </button>
            <button
              className="flex-1 px-4 py-2 bg-[#EEF4F8] dark:bg-[#2a3f52] text-[#3D5A6E] dark:text-[#B8D4E3] text-sm rounded-lg hover:bg-[#E0E8ED] dark:hover:bg-[#3D5A6E] transition-colors"
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
