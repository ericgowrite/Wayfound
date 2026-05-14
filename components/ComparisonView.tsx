"use client";

import { useEffect, useState } from "react";
import { ScoredOption, AXIS_KEYS, AXIS_LABELS, AxisWeights } from "@/types";
import { fitTier } from "@/lib/fitScore";

interface Props {
  options: ScoredOption[];
  profileWeights: AxisWeights;
  workspaceId: string;
  onClose: () => void;
}

export default function ComparisonView({ options, profileWeights, workspaceId, onClose }: Props) {
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (options.length < 2) return;
    setLoading(true);
    fetch("/api/compare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ options, workspaceId }),
    })
      .then((r) => r.json())
      .then((d) => setSummary(d.summary || ""))
      .finally(() => setLoading(false));
  }, [options, workspaceId]);

  const scoreColor = (s: number) => fitTier(s).text;

  const maxScores: Partial<Record<keyof AxisWeights, number>> = {};
  for (const k of AXIS_KEYS) {
    maxScores[k] = Math.max(...options.map((o) => o.axisScores[k]));
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#1e2d3d] rounded-xl border border-[#E0E8ED] dark:border-[#3D5A6E] w-full max-w-5xl max-h-[90vh] overflow-auto">
        <div className="flex justify-between items-center p-4 border-b border-[#E0E8ED] dark:border-[#3D5A6E] sticky top-0 bg-white dark:bg-[#1e2d3d]">
          <h2 className="text-lg font-semibold text-[#2C3E50] dark:text-white">Side-by-Side Comparison</h2>
          <button className="text-[#9BB0C1] hover:text-[#2C3E50] dark:hover:text-white text-2xl leading-none" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="p-4">
          {(loading || summary) && (
            <div className="mb-4 bg-[#EEF4F8] dark:bg-[#2a3f52] rounded-lg p-3">
              <p className="text-[#6B8299] text-xs uppercase mb-1">AI Summary</p>
              <p className="text-[#3D5A6E] dark:text-[#B8D4E3] text-sm">
                {loading ? "Generating comparison..." : summary}
              </p>
            </div>
          )}

          <div className={`grid gap-4`} style={{ gridTemplateColumns: `140px repeat(${options.length}, 1fr)` }}>
            {/* Header row */}
            <div />
            {options.map((opt) => (
              <div key={opt.id} className="text-center">
                <p className="text-[#2C3E50] dark:text-white font-medium text-sm">{opt.name}</p>
                <p className={`text-2xl font-bold ${scoreColor(opt.alignmentScore)}`}>
                  {opt.alignmentScore}%
                </p>
                {opt.price && <p className="text-[#6B8299] dark:text-[#9BB0C1] text-xs">{opt.price}</p>}
              </div>
            ))}

            {/* Axis rows */}
            {AXIS_KEYS.map((k) => (
              <>
                <div key={`label-${k}`} className="flex items-center">
                  <span
                    className="text-[#6B8299] text-xs"
                    title={`Weight: ${Math.round(profileWeights[k] * 100)}%`}
                  >
                    {AXIS_LABELS[k]}
                  </span>
                </div>
                {options.map((opt) => {
                  const pct = Math.round(opt.axisScores[k] * 100);
                  const isBest = opt.axisScores[k] === maxScores[k];
                  return (
                    <div key={`${opt.id}-${k}`} className="flex flex-col items-center gap-1">
                      <div className="w-full h-2 bg-[#E0E8ED] dark:bg-[#3D5A6E] rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${isBest && options.length > 1 ? "bg-green-500" : "bg-[#5B8BA0]/80"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className={`text-xs font-mono ${isBest && options.length > 1 ? "text-green-600 dark:text-green-400" : "text-[#6B8299] dark:text-[#9BB0C1]"}`}>
                        {pct}%
                      </span>
                    </div>
                  );
                })}
              </>
            ))}

            {/* Tradeoffs */}
            <div className="flex items-start pt-2">
              <span className="text-[#6B8299] text-xs">Key Tradeoffs</span>
            </div>
            {options.map((opt) => (
              <div key={`tradeoff-${opt.id}`} className="pt-2">
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
