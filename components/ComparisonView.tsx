"use client";

import { useEffect, useState } from "react";
import { ScoredOption, AXIS_KEYS, AXIS_LABELS, AxisWeights } from "@/types";

interface Props {
  options: ScoredOption[];
  profileWeights: AxisWeights;
  onClose: () => void;
}

export default function ComparisonView({ options, profileWeights, onClose }: Props) {
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (options.length < 2) return;
    setLoading(true);
    fetch("/api/compare", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ options }),
    })
      .then((r) => r.json())
      .then((d) => setSummary(d.summary || ""))
      .finally(() => setLoading(false));
  }, [options]);

  const scoreColor = (s: number) =>
    s >= 80
      ? "text-green-600 dark:text-green-400"
      : s >= 60
      ? "text-yellow-600 dark:text-yellow-400"
      : "text-red-600 dark:text-red-400";

  const maxScores: Partial<Record<keyof AxisWeights, number>> = {};
  for (const k of AXIS_KEYS) {
    maxScores[k] = Math.max(...options.map((o) => o.axisScores[k]));
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-300 dark:border-gray-700 w-full max-w-5xl max-h-[90vh] overflow-auto">
        <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-900">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Side-by-Side Comparison</h2>
          <button className="text-gray-400 hover:text-gray-900 dark:hover:text-white text-2xl leading-none" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="p-4">
          {(loading || summary) && (
            <div className="mb-4 bg-gray-100 dark:bg-gray-800 rounded-lg p-3">
              <p className="text-gray-500 text-xs uppercase mb-1">AI Summary</p>
              <p className="text-gray-700 dark:text-gray-300 text-sm">
                {loading ? "Generating comparison..." : summary}
              </p>
            </div>
          )}

          <div className={`grid gap-4`} style={{ gridTemplateColumns: `140px repeat(${options.length}, 1fr)` }}>
            {/* Header row */}
            <div />
            {options.map((opt) => (
              <div key={opt.id} className="text-center">
                <p className="text-gray-900 dark:text-white font-medium text-sm">{opt.name}</p>
                <p className={`text-2xl font-bold ${scoreColor(opt.alignmentScore)}`}>
                  {opt.alignmentScore}%
                </p>
                {opt.price && <p className="text-gray-600 dark:text-gray-400 text-xs">{opt.price}</p>}
              </div>
            ))}

            {/* Axis rows */}
            {AXIS_KEYS.map((k) => (
              <>
                <div key={`label-${k}`} className="flex items-center">
                  <span
                    className="text-gray-500 text-xs"
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
                      <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${isBest && options.length > 1 ? "bg-green-500" : "bg-blue-500"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className={`text-xs font-mono ${isBest && options.length > 1 ? "text-green-600 dark:text-green-400" : "text-gray-600 dark:text-gray-400"}`}>
                        {pct}%
                      </span>
                    </div>
                  );
                })}
              </>
            ))}

            {/* Tradeoffs */}
            <div className="flex items-start pt-2">
              <span className="text-gray-500 text-xs">Key Tradeoffs</span>
            </div>
            {options.map((opt) => (
              <div key={`tradeoff-${opt.id}`} className="pt-2">
                <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-0.5">
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
