"use client";

import { AXIS_DESCRIPTIONS, AXIS_LABELS, AxisWeights } from "@/types";

interface Props {
  axisKey: keyof AxisWeights;
  score: number;
  weight?: number;
  compact?: boolean;
}

export default function AxisBar({ axisKey, score, weight, compact }: Props) {
  const pct = Math.round(score * 100);

  return (
    <div className={compact ? "mb-1" : "mb-2"}>
      <div className="flex justify-between items-center mb-0.5">
        <span
          className={`text-gray-500 dark:text-gray-400 ${compact ? "text-xs" : "text-sm"}`}
          title={AXIS_DESCRIPTIONS[axisKey]}
        >
          {AXIS_LABELS[axisKey]}
        </span>
        <span className={`font-mono text-gray-600 dark:text-gray-300 ${compact ? "text-xs" : "text-sm"}`}>
          {pct}%
        </span>
      </div>
      <div className="relative h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className="absolute top-0 left-0 h-full rounded-full transition-all"
          style={{
            width: `${pct}%`,
            backgroundColor:
              pct >= 70 ? "#16a34a" : pct >= 50 ? "#ca8a04" : "#dc2626",
          }}
        />
        {weight !== undefined && (
          <div
            className="absolute top-0 h-full w-0.5 bg-gray-600 dark:bg-white opacity-40"
            style={{ left: `${Math.round(weight * 100)}%` }}
          />
        )}
      </div>
    </div>
  );
}
