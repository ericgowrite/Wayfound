"use client";

import { useState, useRef } from "react";
import { Profile, ScoredOption, TripWorkspace, AXIS_KEYS, AxisWeights } from "@/types";
import { fitTier, FIT_TIERS } from "@/lib/fitScore";
import AxisBar from "./AxisBar";

interface Props {
  option: ScoredOption;
  workspace: TripWorkspace;
  travelers: Profile[];
  profileWeights: AxisWeights | undefined;
  isSelected: boolean;
  onToggleSelect: () => void;
  onSave: () => void;
  onStatusChange: (status: ScoredOption["status"]) => void;
  onNotesChange: (notes: string) => void;
  onDeepDive: () => void;
}

const AVATAR_COLORS = [
  "bg-blue-600",
  "bg-violet-600",
  "bg-emerald-600",
  "bg-amber-600",
  "bg-rose-600",
];

export default function ResultCard({
  option,
  workspace,
  travelers,
  profileWeights,
  isSelected,
  onToggleSelect,
  onSave,
  onStatusChange,
  onNotesChange,
  onDeepDive,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [showFullExplanation, setShowFullExplanation] = useState(false);
  const [notes, setNotes] = useState(option.notes);
  const [deepDiveText, setDeepDiveText] = useState("");
  const [loadingDive, setLoadingDive] = useState(false);
  const [showScoreLegend, setShowScoreLegend] = useState(false);
  const legendTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  function isValidSourceUrl(src: string | undefined): boolean {
    if (!src) return false;
    const s = src.trim();
    return s.startsWith("http://") || s.startsWith("https://");
  }

  const score = option.alignmentScore;
  const tier = fitTier(score);
  const isSaved = workspace.savedOptions.some((s) => s.id === option.id);

  const borderColor =
    option.dealbreakersTriggered.length > 0
      ? "border-red-400 dark:border-red-700"
      : tier.border;

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

  function handleScoreMouseEnter() {
    if (legendTimeout.current) clearTimeout(legendTimeout.current);
    setShowScoreLegend(true);
  }

  function handleScoreMouseLeave() {
    legendTimeout.current = setTimeout(() => setShowScoreLegend(false), 150);
  }

  // Group fit summary badge
  const hasMultipleTravelers = travelers.length > 1;
  const travelerScoreValues = hasMultipleTravelers
    ? travelers.map((t) => option.travelerScores?.[t.id]?.alignmentScore ?? option.alignmentScore)
    : [];
  const groupMin = hasMultipleTravelers ? Math.min(...travelerScoreValues) : null;
  const groupMinTier = groupMin !== null ? fitTier(groupMin) : null;

  return (
    <div className={`border rounded-xl bg-white dark:bg-gray-900 ${borderColor} transition-all`}>
      {/* Header */}
      <div
        className="flex items-start gap-3 p-4 cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
      >
        <input
          type="checkbox"
          className="mt-1 accent-blue-500 cursor-pointer flex-shrink-0"
          checked={isSelected}
          onChange={(e) => { e.stopPropagation(); onToggleSelect(); }}
          onClick={(e) => e.stopPropagation()}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Score badge with hover legend */}
            <div className="relative flex-shrink-0" onClick={(e) => e.stopPropagation()}>
              <span
                className={`text-lg font-bold tabular-nums cursor-default ${tier.text}`}
                onMouseEnter={handleScoreMouseEnter}
                onMouseLeave={handleScoreMouseLeave}
              >
                {score}%
              </span>
              {showScoreLegend && (
                <div
                  className="absolute left-0 top-full mt-1.5 z-30 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl p-3 w-52"
                  onMouseEnter={handleScoreMouseEnter}
                  onMouseLeave={handleScoreMouseLeave}
                >
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">Fit score guide</p>
                  <div className="space-y-1.5">
                    {FIT_TIERS.map((t) => (
                      <div key={t.min} className={`flex items-center gap-2 text-xs rounded-md px-1.5 py-0.5 ${t.min === tier.min ? `${t.bg} font-medium` : ""}`}>
                        <span className="w-4 text-center">{t.emoji}</span>
                        <span className="text-gray-700 dark:text-gray-300 flex-1">{t.label}</span>
                        <span className="text-gray-400 dark:text-gray-500 tabular-nums">
                          {t.min === 0 ? "<50%" : t.min === 80 ? "80%+" : `${t.min}–${t.min === 65 ? 79 : 64}%`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {hasMultipleTravelers && groupMin !== null && groupMinTier && (
              <span
                className={`text-xs px-1.5 py-0.5 rounded-full border font-medium ${groupMinTier.text} ${groupMinTier.border} ${groupMinTier.bg}`}
                title="Lowest score across travelers"
              >
                min {groupMin}%
              </span>
            )}
            {statusEmoji[option.status] && (
              <span className="text-sm">{statusEmoji[option.status]}</span>
            )}
            <span className="text-gray-900 dark:text-white font-semibold truncate">{option.name}</span>
            {option.price && (
              <span className="text-gray-500 dark:text-gray-400 text-sm">{option.price}</span>
            )}
          </div>
          <div className="mt-1">
            <p className={`text-gray-600 dark:text-gray-400 text-sm leading-relaxed ${showFullExplanation ? "" : "line-clamp-3"}`}>
              {option.fitExplanation}
            </p>
            {option.fitExplanation && option.fitExplanation.length > 160 && (
              <button
                className="text-xs text-gray-400 dark:text-gray-500 hover:text-blue-500 dark:hover:text-blue-400 mt-0.5 transition-colors"
                onClick={(e) => { e.stopPropagation(); setShowFullExplanation((v) => !v); }}
              >
                {showFullExplanation ? "Read less" : "Read more"}
              </button>
            )}
          </div>
          {option.thresholdViolations.length > 0 && (
            <div className="flex gap-1 mt-1.5 flex-wrap">
              {option.thresholdViolations.map((v) => (
                <span
                  key={v}
                  className="text-xs bg-yellow-50 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-800 px-1.5 py-0.5 rounded-full"
                >
                  ⚠ {v}
                </span>
              ))}
            </div>
          )}
          {option.dealbreakersTriggered.length > 0 && (
            <div className="flex gap-1 mt-1.5 flex-wrap">
              {option.dealbreakersTriggered.map((d) => (
                <span
                  key={d}
                  className="text-xs bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800 px-1.5 py-0.5 rounded-full"
                >
                  ✗ {d}
                </span>
              ))}
            </div>
          )}
        </div>
        <span className="text-gray-400 text-xs mt-1.5 flex-shrink-0">{expanded ? "▲" : "▼"}</span>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-800 pt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left: axis bars */}
            <div>
              <p className="text-gray-400 dark:text-gray-500 text-xs uppercase tracking-wide mb-2">
                Axis Scores{travelers[0] ? ` — ${travelers[0].name}` : ""}
              </p>
              {profileWeights && AXIS_KEYS.map((k) => (
                <AxisBar
                  key={k}
                  axisKey={k}
                  score={option.axisScores[k]}
                  weight={profileWeights[k]}
                  compact
                />
              ))}
            </div>

            {/* Right: description, tradeoffs, source */}
            <div className="space-y-3">
              <div>
                <p className="text-gray-400 dark:text-gray-500 text-xs uppercase tracking-wide mb-1">Description</p>
                <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">{option.description}</p>
              </div>
              {option.tradeoffs.length > 0 && (
                <div>
                  <p className="text-gray-400 dark:text-gray-500 text-xs uppercase tracking-wide mb-1">Tradeoffs</p>
                  <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1">
                    {option.tradeoffs.map((t, i) => (
                      <li key={i} className="flex gap-1.5">
                        <span className="text-gray-400 flex-shrink-0 mt-0.5">•</span>
                        <span>{t}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {isValidSourceUrl(option.source) && (
                <a
                  href={option.source!.trim()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:underline text-sm inline-flex items-center gap-1"
                >
                  View source →
                </a>
              )}
            </div>
          </div>

          {/* Per-traveler scores — only when 2+ travelers */}
          {hasMultipleTravelers && (
            <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
              <p className="text-gray-400 dark:text-gray-500 text-xs uppercase tracking-wide mb-3">Traveler Fit</p>
              <div className="space-y-2.5">
                {travelers.map((traveler, idx) => {
                  const ts = option.travelerScores?.[traveler.id];
                  const tScore = ts?.alignmentScore ?? option.alignmentScore;
                  const violations = ts?.thresholdViolations ?? [];
                  const tTier = fitTier(tScore);

                  return (
                    <div key={traveler.id} className="flex items-center gap-3">
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 ${AVATAR_COLORS[idx % AVATAR_COLORS.length]}`}
                      >
                        {traveler.name[0]}
                      </div>
                      <span className="text-sm text-gray-700 dark:text-gray-300 w-20 truncate flex-shrink-0">
                        {traveler.name}
                      </span>
                      <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${tScore}%`, backgroundColor: tTier.hex }}
                        />
                      </div>
                      <span
                        className="text-xs font-mono tabular-nums w-8 text-right flex-shrink-0 font-medium"
                        style={{ color: tTier.hex }}
                      >
                        {tScore}%
                      </span>
                      {violations.length > 0 && (
                        <span
                          className="text-xs text-amber-600 dark:text-amber-400 flex-shrink-0"
                          title={`Below threshold: ${violations.join(", ")}`}
                        >
                          ⚠ {violations.join(", ")}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Deep dive result */}
          {deepDiveText && (
            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3.5 border border-gray-200 dark:border-gray-700">
              <p className="text-gray-400 dark:text-gray-500 text-xs uppercase tracking-wide mb-1.5">Deep Dive</p>
              <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed">{deepDiveText}</p>
            </div>
          )}

          {/* Notes */}
          <div>
            <p className="text-gray-400 dark:text-gray-500 text-xs uppercase tracking-wide mb-1.5">Notes</p>
            <textarea
              className="w-full bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-200 text-sm rounded-lg border border-gray-200 dark:border-gray-700 p-2.5 resize-none focus:outline-none focus:border-blue-500 transition-colors"
              rows={2}
              placeholder="Add notes…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={() => onNotesChange(notes)}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 flex-wrap">
            <button
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors font-medium ${
                isSaved
                  ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/60"
                  : "bg-blue-600 text-white hover:bg-blue-500"
              }`}
              onClick={onSave}
            >
              {isSaved ? "Saved ✓" : "Save"}
            </button>
            {(["interested", "rejected", "booked"] as ScoredOption["status"][]).map((s) => (
              <button
                key={s}
                className={`px-3 py-1.5 text-sm rounded-lg capitalize transition-colors ${
                  option.status === s
                    ? "bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white font-medium"
                    : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
                }`}
                onClick={() => onStatusChange(s)}
              >
                {s === "interested" ? "⭐ Interested" : s === "rejected" ? "✗ Reject" : "✅ Booked"}
              </button>
            ))}
            <button
              className="px-3 py-1.5 text-sm rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors ml-auto disabled:opacity-50"
              onClick={handleDeepDive}
              disabled={loadingDive}
            >
              {loadingDive ? (
                <span className="flex items-center gap-1.5">
                  <span className="animate-spin inline-block">⟳</span> Researching…
                </span>
              ) : (
                "Deep Dive →"
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
