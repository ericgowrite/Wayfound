"use client";

import { useEffect, useState } from "react";
import { ScoredOption, AxisWeights, Profile, AXIS_KEYS } from "@/types";
import { fitTier } from "@/lib/fitScore";
import { combineProfiles } from "@/lib/scoring";
import { fetchWithAuth } from "@/lib/fetchWithAuth";

const PLAIN_LABELS: Record<keyof AxisWeights, string> = {
  calm:               "Matches your pace",
  designSincerity:    "Matches your aesthetic",
  valueIntegrity:     "Matches your value standard",
  socialPermeability: "Matches your social comfort",
  autonomy:           "Matches your travel style",
  novelty:            "Matches your appetite for new",
  locationFriction:   "Matches your logistics threshold",
};

function matchQualityLabel(q: number): string {
  if (q >= 0.75) return "Strong";
  if (q >= 0.45) return "Good";
  return "Partial";
}

function matchBarColor(q: number): string {
  if (q >= 0.75) return "bg-emerald-500";
  if (q >= 0.45) return "bg-amber-400";
  return "bg-[#C5D8E4]";
}

function matchTextColor(q: number): string {
  if (q >= 0.75) return "text-emerald-600 dark:text-emerald-400";
  if (q >= 0.45) return "text-amber-600 dark:text-amber-400";
  return "text-[#9BB0C1]";
}

interface Props {
  options: ScoredOption[];
  travelers: Profile[];
  workspaceId: string;
  onClose: () => void;
}

export default function ComparisonView({ options, travelers, workspaceId, onClose }: Props) {
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (options.length < 2) return;
    setLoading(true);
    fetchWithAuth("/api/compare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ options, workspaceId }),
    })
      .then((r) => r.json())
      .then((d) => setSummary(d.summary || ""))
      .finally(() => setLoading(false));
  }, [options, workspaceId]);

  const scoreColor = (s: number) => fitTier(s).text;

  // Combined weights — average across all travelers
  const combined = travelers.length > 0 ? combineProfiles(travelers).axisWeights : null;

  // Top 4 axes by combined weight (most important to this traveler / group)
  const top4: (keyof AxisWeights)[] = combined
    ? (AXIS_KEYS.slice().sort((a, b) => combined[b] - combined[a]).slice(0, 4))
    : AXIS_KEYS.slice(0, 4);

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#1e2d3d] rounded-xl border border-[#E0E8ED] dark:border-[#3D5A6E] w-full max-w-4xl max-h-[90vh] overflow-auto">
        <div className="flex justify-between items-center p-4 border-b border-[#E0E8ED] dark:border-[#3D5A6E] sticky top-0 bg-white dark:bg-[#1e2d3d]">
          <h2 className="text-lg font-semibold text-[#2C3E50] dark:text-white">Side-by-Side Comparison</h2>
          <button className="text-[#9BB0C1] hover:text-[#2C3E50] dark:hover:text-white text-2xl leading-none" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="p-4 space-y-5">
          {/* AI summary */}
          {(loading || summary) && (
            <div className="bg-[#EEF4F8] dark:bg-[#2a3f52] rounded-lg p-3">
              <p className="text-[#6B8299] text-xs uppercase mb-1">AI Summary</p>
              <p className="text-[#3D5A6E] dark:text-[#B8D4E3] text-sm">
                {loading ? "Generating comparison..." : summary}
              </p>
            </div>
          )}

          {/* Option headers */}
          <div className="grid gap-4" style={{ gridTemplateColumns: `160px repeat(${options.length}, 1fr)` }}>
            <div />
            {options.map((opt) => (
              <div key={opt.id} className="text-center">
                <p className="text-[#2C3E50] dark:text-white font-medium text-sm leading-snug">{opt.name}</p>
                <p className={`text-2xl font-bold mt-0.5 ${scoreColor(opt.alignmentScore)}`}>
                  {opt.alignmentScore}%
                </p>
                {opt.price && <p className="text-[#6B8299] dark:text-[#9BB0C1] text-xs mt-0.5">{opt.price}</p>}
              </div>
            ))}

            {/* Top-4 match quality rows */}
            {top4.map((k) => (
              <>
                <div key={`label-${k}`} className="flex items-center">
                  <span className="text-[#6B8299] dark:text-[#9BB0C1] text-xs leading-tight">
                    {PLAIN_LABELS[k]}
                  </span>
                </div>
                {options.map((opt) => {
                  const q = combined
                    ? Math.max(0, 1 - Math.abs(opt.axisScores[k] - combined[k]))
                    : opt.axisScores[k];
                  const pct = Math.round(q * 100);
                  return (
                    <div key={`${opt.id}-${k}`} className="flex flex-col items-center gap-1">
                      <div className="w-full h-2 bg-[#E0E8ED] dark:bg-[#3D5A6E] rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${matchBarColor(q)}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className={`text-xs ${matchTextColor(q)}`}>
                        {matchQualityLabel(q)}
                      </span>
                    </div>
                  );
                })}
              </>
            ))}

            {/* Key tradeoffs */}
            <div className="flex items-start pt-1">
              <span className="text-[#6B8299] dark:text-[#9BB0C1] text-xs">Key tradeoffs</span>
            </div>
            {options.map((opt) => (
              <div key={`tradeoff-${opt.id}`} className="pt-1">
                <ul className="text-xs text-[#6B8299] dark:text-[#9BB0C1] space-y-0.5">
                  {opt.tradeoffs.map((t, i) => (
                    <li key={i} className="flex gap-1">
                      <span>•</span>
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
