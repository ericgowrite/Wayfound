"use client";

import { useState } from "react";
import { ScoredOption, TripWorkspace, AXIS_KEYS, AxisWeights } from "@/types";
import AxisBar from "./AxisBar";

interface Props {
  option: ScoredOption;
  workspace: TripWorkspace;
  profileWeights: AxisWeights;
  isSelected: boolean;
  onToggleSelect: () => void;
  onSave: () => void;
  onStatusChange: (status: ScoredOption["status"]) => void;
  onNotesChange: (notes: string) => void;
  onDeepDive: () => void;
}

export default function ResultCard({
  option,
  workspace,
  profileWeights,
  isSelected,
  onToggleSelect,
  onSave,
  onStatusChange,
  onNotesChange,
  onDeepDive,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [notes, setNotes] = useState(option.notes);
  const [deepDiveText, setDeepDiveText] = useState("");
  const [loadingDive, setLoadingDive] = useState(false);

  const score = option.alignmentScore;
  const isSaved = workspace.savedOptions.some((s) => s.id === option.id);

  const scoreColor =
    score >= 80
      ? "text-green-600 dark:text-green-400"
      : score >= 60
      ? "text-yellow-600 dark:text-yellow-400"
      : "text-red-600 dark:text-red-400";

  const borderColor =
    option.dealbreakersTriggered.length > 0
      ? "border-red-400 dark:border-red-700"
      : score >= 80
      ? "border-green-500 dark:border-green-800"
      : score >= 60
      ? "border-yellow-500 dark:border-yellow-800"
      : "border-gray-300 dark:border-gray-700";

  const statusEmoji: Record<ScoredOption["status"], string> = {
    new: "",
    interested: "⭐",
    rejected: "✗",
    booked: "✅",
  };

  async function handleDeepDive() {
    setLoadingDive(true);
    try {
      const res = await fetch("/api/deepdive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ option }),
      });
      const data = await res.json();
      setDeepDiveText(data.analysis || "");
    } finally {
      setLoadingDive(false);
    }
    onDeepDive();
  }

  function handleNotesBlur() {
    onNotesChange(notes);
  }

  return (
    <div className={`border rounded-lg bg-white dark:bg-gray-900 ${borderColor} transition-all`}>
      {/* Header row */}
      <div
        className="flex items-start gap-3 p-4 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <input
          type="checkbox"
          className="mt-1 accent-blue-500 cursor-pointer"
          checked={isSelected}
          onChange={(e) => {
            e.stopPropagation();
            onToggleSelect();
          }}
          onClick={(e) => e.stopPropagation()}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-lg font-semibold ${scoreColor}`}>{score}%</span>
            {statusEmoji[option.status] && (
              <span className="text-sm">{statusEmoji[option.status]}</span>
            )}
            <span className="text-gray-900 dark:text-white font-medium truncate">{option.name}</span>
            {option.price && (
              <span className="text-gray-600 dark:text-gray-400 text-sm">{option.price}</span>
            )}
          </div>
          <p className="text-gray-600 dark:text-gray-400 text-sm mt-0.5 line-clamp-2">{option.fitExplanation}</p>
          {option.thresholdViolations.length > 0 && (
            <div className="flex gap-1 mt-1 flex-wrap">
              {option.thresholdViolations.map((v) => (
                <span key={v} className="text-xs bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300 px-1.5 py-0.5 rounded">
                  ⚠ {v}
                </span>
              ))}
            </div>
          )}
          {option.dealbreakersTriggered.length > 0 && (
            <div className="flex gap-1 mt-1 flex-wrap">
              {option.dealbreakersTriggered.map((d) => (
                <span key={d} className="text-xs bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 px-1.5 py-0.5 rounded">
                  ✗ {d}
                </span>
              ))}
            </div>
          )}
        </div>
        <span className="text-gray-500 text-sm ml-2">{expanded ? "▲" : "▼"}</span>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-200 dark:border-gray-800 mt-0 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left: axes */}
            <div>
              <p className="text-gray-500 text-xs uppercase mb-2">Axis Scores</p>
              {AXIS_KEYS.map((k) => (
                <AxisBar
                  key={k}
                  axisKey={k}
                  score={option.axisScores[k]}
                  weight={profileWeights[k]}
                  compact
                />
              ))}
            </div>

            {/* Right: details */}
            <div className="space-y-3">
              <div>
                <p className="text-gray-500 text-xs uppercase mb-1">Description</p>
                <p className="text-gray-700 dark:text-gray-300 text-sm">{option.description}</p>
              </div>
              {option.tradeoffs.length > 0 && (
                <div>
                  <p className="text-gray-500 text-xs uppercase mb-1">Tradeoffs</p>
                  <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-0.5">
                    {option.tradeoffs.map((t, i) => (
                      <li key={i} className="flex gap-1.5">
                        <span className="text-gray-500">•</span>
                        {t}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {option.source && (
                <a
                  href={option.source.startsWith("http") ? option.source : `https://${option.source}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm underline block"
                >
                  View source →
                </a>
              )}
            </div>
          </div>

          {/* Deep dive */}
          {deepDiveText && (
            <div className="mt-4 bg-gray-100 dark:bg-gray-800 rounded p-3">
              <p className="text-gray-500 text-xs uppercase mb-1">Deep Dive</p>
              <p className="text-gray-700 dark:text-gray-300 text-sm">{deepDiveText}</p>
            </div>
          )}

          {/* Notes */}
          <div className="mt-4">
            <p className="text-gray-500 text-xs uppercase mb-1">Notes</p>
            <textarea
              className="w-full bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-sm rounded border border-gray-300 dark:border-gray-700 p-2 resize-none focus:outline-none focus:border-blue-500"
              rows={2}
              placeholder="Add notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={handleNotesBlur}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 mt-3 flex-wrap">
            <button
              className={`px-3 py-1.5 text-sm rounded transition-colors ${
                isSaved
                  ? "bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-200 hover:bg-blue-200 dark:hover:bg-blue-700"
                  : "bg-blue-600 text-white hover:bg-blue-500"
              }`}
              onClick={onSave}
            >
              {isSaved ? "Saved ✓" : "Save"}
            </button>
            {(["interested", "rejected", "booked"] as ScoredOption["status"][]).map((s) => (
              <button
                key={s}
                className={`px-3 py-1.5 text-sm rounded capitalize transition-colors ${
                  option.status === s
                    ? "bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-white"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                }`}
                onClick={() => onStatusChange(s)}
              >
                {s === "interested" ? "⭐ Interested" : s === "rejected" ? "✗ Reject" : "✅ Booked"}
              </button>
            ))}
            <button
              className="px-3 py-1.5 text-sm rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors ml-auto"
              onClick={handleDeepDive}
              disabled={loadingDive}
            >
              {loadingDive ? "Researching..." : "Deep Dive →"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
