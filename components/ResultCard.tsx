"use client";

import { useState, useRef, useEffect } from "react";
import { Profile, ScoredOption, TripWorkspace, AXIS_KEYS, AxisWeights, DeepDiveResult, SearchCategory } from "@/types";
import { fitTier, FIT_TIERS } from "@/lib/fitScore";
import { CATEGORY_META } from "@/lib/categories";
import { validateUrl, reportBadUrl } from "@/lib/urlValidation";
import AxisBar from "./AxisBar";

interface Props {
  option: ScoredOption;
  workspace: TripWorkspace;
  travelers: Profile[];
  profileWeights: AxisWeights | undefined;
  isSelected: boolean;
  category?: SearchCategory;
  onToggleSelect: () => void;
  onSave: () => void;
  onStatusChange: (status: ScoredOption["status"]) => void;
  onNotesChange: (notes: string) => void;
  onDeepDive: () => void;
}

const AVATAR_COLORS = [
  "bg-[#5B8BA0]",
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
  category,
  onToggleSelect,
  onSave,
  onStatusChange,
  onNotesChange,
  onDeepDive,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [showFullExplanation, setShowFullExplanation] = useState(false);
  const [notes, setNotes] = useState(option.notes);
  const [deepDive, setDeepDive] = useState<DeepDiveResult | null>(null);
  const [loadingDive, setLoadingDive] = useState(false);
  const [deepDiveError, setDeepDiveError] = useState(false);
  const [showScoreLegend, setShowScoreLegend] = useState(false);
  const legendTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // URL validation
  type UrlStatus = "idle" | "checking" | "valid" | "invalid";
  const [urlStatus, setUrlStatus] = useState<UrlStatus>("idle");
  const [resolvedUrl, setResolvedUrl] = useState<string>(option.source ?? "");
  const [reportSent, setReportSent] = useState(false);

  // Trigger validation the first time the card expands
  useEffect(() => {
    if (!expanded || urlStatus !== "idle") return;
    const raw = option.source?.trim();
    if (!raw || !/^https?:\/\//i.test(raw)) {
      setUrlStatus("invalid");
      return;
    }
    setUrlStatus("checking");
    validateUrl(raw).then((result) => {
      if (result.valid && result.finalUrl) {
        setResolvedUrl(result.finalUrl);
        setUrlStatus("valid");
      } else {
        setUrlStatus("invalid");
      }
    });
  }, [expanded]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleReport() {
    reportBadUrl({
      resultId: option.id,
      resultName: option.name,
      reportedUrl: resolvedUrl || option.source || "",
      timestamp: new Date().toISOString(),
    });
    setReportSent(true);
    setUrlStatus("invalid"); // hide the link immediately after report
  }

  const AFFILIATE_PARTNERS: Record<string, string> = {
    "booking.com": "Booking.com",
    "viator.com": "Viator",
    "getyourguide.com": "GetYourGuide",
    "tripadvisor.com": "Tripadvisor",
    "hotels.com": "Hotels.com",
  };

  function getSourceLabel(src: string): string {
    try {
      const hostname = new URL(src).hostname.replace(/^www\./, "");
      for (const [domain, name] of Object.entries(AFFILIATE_PARTNERS)) {
        if (hostname === domain || hostname.endsWith(`.${domain}`)) {
          return `Book on ${name} →`;
        }
      }
    } catch {
      // invalid URL — fall through
    }
    return "View source →";
  }

  const score = option.alignmentScore;
  const tier = fitTier(score);
  const isSaved = workspace.savedOptions.some((s) => s.id === option.id);

  const borderColor = tier.border;

  const statusEmoji: Record<ScoredOption["status"], string> = {
    new: "",
    interested: "⭐",
    rejected: "✗",
    booked: "✅",
  };

  async function handleDeepDive() {
    setLoadingDive(true);
    setDeepDiveError(false);
    try {
      const res = await fetch("/api/deepdive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ option, workspaceId: workspace.id }),
      });
      const data = await res.json();
      if (data.deepDive) {
        setDeepDive(data.deepDive);
        onDeepDive();
      } else {
        setDeepDiveError(true);
      }
    } catch {
      setDeepDiveError(true);
    } finally {
      setLoadingDive(false);
    }
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
    <div className={`border rounded-xl bg-white dark:bg-[#1e2d3d] ${borderColor} transition-all`}>
      {/* Header */}
      <div
        className="flex items-start gap-3 p-4 cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
      >
        <input
          type="checkbox"
          className="mt-1 accent-[#5B8BA0] cursor-pointer flex-shrink-0"
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
                  className="absolute left-0 top-full mt-1.5 z-30 bg-white dark:bg-[#1e2d3d] border border-[#E0E8ED] dark:border-[#3D5A6E] rounded-xl shadow-xl p-3 w-52"
                  onMouseEnter={handleScoreMouseEnter}
                  onMouseLeave={handleScoreMouseLeave}
                >
                  <p className="text-xs font-medium text-[#6B8299] dark:text-[#9BB0C1] mb-2 uppercase tracking-wide">Fit score guide</p>
                  <div className="space-y-1.5">
                    {FIT_TIERS.map((t) => (
                      <div key={t.min} className={`flex items-center gap-2 text-xs rounded-md px-1.5 py-0.5 ${t.min === tier.min ? `${t.bg} font-medium` : ""}`}>
                        <span className="w-4 text-center">{t.emoji}</span>
                        <span className="text-[#3D5A6E] dark:text-[#B8D4E3] flex-1">{t.label}</span>
                        <span className="text-[#9BB0C1] dark:text-[#6B8299] tabular-nums">
                          {t.min === 0 ? "<50%" : t.min === 80 ? "80%+" : `${t.min}–${t.min === 65 ? 79 : 64}%`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {hasMultipleTravelers && groupMin !== null && groupMinTier && groupMin !== score && (
              <span
                className={`text-xs px-1.5 py-0.5 rounded-full border font-medium ${groupMinTier.text} ${groupMinTier.border} ${groupMinTier.bg}`}
                title="Lowest individual score across travelers"
              >
                min {groupMin}%
              </span>
            )}
            {statusEmoji[option.status] && (
              <span className="text-sm">{statusEmoji[option.status]}</span>
            )}
            <span className="text-[#2C3E50] dark:text-white font-semibold truncate">{option.name}</span>
            {option.price && (
              <span className="text-[#6B8299] dark:text-[#9BB0C1] text-sm">{option.price}</span>
            )}
            {category && CATEGORY_META[category] && (
              <span className="ml-auto flex-shrink-0 text-[10px] text-[#E8A87C] uppercase tracking-wider font-medium">
                {CATEGORY_META[category].icon} {CATEGORY_META[category].label}
              </span>
            )}
          </div>
          <div className="mt-1">
            <p className={`text-[#6B8299] dark:text-[#9BB0C1] text-sm leading-relaxed ${showFullExplanation ? "" : "line-clamp-3"}`}>
              {option.fitExplanation}
            </p>
            {option.fitExplanation && option.fitExplanation.length > 160 && (
              <button
                className="text-xs text-[#9BB0C1] dark:text-[#6B8299] hover:text-[#5B8BA0] dark:hover:text-[#7DBAD4] mt-0.5 transition-colors"
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
          {option.watchOutFor && option.watchOutFor.length > 0 && (
            <div className="flex gap-1 mt-1.5 flex-wrap">
              {option.watchOutFor.map((w) => (
                <span
                  key={w}
                  className="text-xs bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 px-1.5 py-0.5 rounded-full"
                >
                  ⚠ {w}
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
        <span className="text-[#9BB0C1] text-xs mt-1.5 flex-shrink-0">{expanded ? "▲" : "▼"}</span>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-[#E0E8ED] dark:border-[#2a3f52] pt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left: axis bars */}
            <div>
              <p className="text-[#9BB0C1] dark:text-[#6B8299] text-xs uppercase tracking-wide mb-2">
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
                <p className="text-[#9BB0C1] dark:text-[#6B8299] text-xs uppercase tracking-wide mb-1">Description</p>
                <p className="text-[#3D5A6E] dark:text-[#B8D4E3] text-sm leading-relaxed">{option.description}</p>
              </div>
              {option.tradeoffs.length > 0 && (
                <div>
                  <p className="text-[#9BB0C1] dark:text-[#6B8299] text-xs uppercase tracking-wide mb-1">Tradeoffs</p>
                  <ul className="text-sm text-[#3D5A6E] dark:text-[#B8D4E3] space-y-1">
                    {option.tradeoffs.map((t, i) => (
                      <li key={i} className="flex gap-1.5">
                        <span className="text-[#9BB0C1] flex-shrink-0 mt-0.5">•</span>
                        <span>{t}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {/* Source link — validated before display */}
              <div className="flex items-center gap-3 flex-wrap min-h-[1.5rem]">
                {urlStatus === "checking" && (
                  <span className="text-xs text-[#9BB0C1] dark:text-[#6B8299] animate-pulse">Checking source…</span>
                )}

                {urlStatus === "valid" && (
                  <>
                    <a
                      href={resolvedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#5B8BA0] dark:text-[#7DBAD4] hover:underline text-sm inline-flex items-center gap-1"
                    >
                      {getSourceLabel(resolvedUrl)}
                    </a>
                    {reportSent ? (
                      <span className="text-xs text-[#9BB0C1] dark:text-[#6B8299]">Reported — thanks</span>
                    ) : (
                      <button
                        onClick={handleReport}
                        className="text-xs text-[#9BB0C1] dark:text-[#6B8299] hover:text-red-500 dark:hover:text-red-400 transition-colors"
                        title="Report a bad or incorrect link"
                      >
                        🚩 Report
                      </button>
                    )}
                  </>
                )}

                {urlStatus === "invalid" && !reportSent && (
                  <span className="text-xs text-[#9BB0C1] dark:text-[#6B8299]">Source not available</span>
                )}
              </div>
            </div>
          </div>

          {/* Per-traveler scores — only when 2+ travelers */}
          {hasMultipleTravelers && (
            <div className="border-t border-[#E0E8ED] dark:border-[#2a3f52] pt-4">
              <p className="text-[#9BB0C1] dark:text-[#6B8299] text-xs uppercase tracking-wide mb-3">Traveler Fit</p>
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
                      <span className="text-sm text-[#3D5A6E] dark:text-[#B8D4E3] w-20 truncate flex-shrink-0">
                        {traveler.name}
                      </span>
                      <div className="flex-1 h-1.5 bg-[#E0E8ED] dark:bg-[#3D5A6E] rounded-full overflow-hidden">
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
          {deepDive && (
            <div className="rounded-xl border border-[#E0E8ED] dark:border-[#3D5A6E] overflow-hidden">
              {/* Overview */}
              {deepDive.overview && (
                <div className="px-4 py-3.5 bg-[#F8FAFB] dark:bg-[#2a3f52]/60">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-[#9BB0C1] dark:text-[#6B8299] mb-1.5">Overview</p>
                  <p className="text-sm text-[#3D5A6E] dark:text-[#B8D4E3] leading-relaxed">{deepDive.overview}</p>
                </div>
              )}

              {/* Why it fits */}
              {deepDive.whyItFits.length > 0 && (
                <div className="px-4 py-3.5 border-t border-[#E0E8ED] dark:border-[#3D5A6E]">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-green-600 dark:text-green-500 mb-2">Why it fits you</p>
                  <ul className="space-y-1.5">
                    {deepDive.whyItFits.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-[#3D5A6E] dark:text-[#B8D4E3] leading-snug">
                        <span className="text-green-500 flex-shrink-0 mt-0.5 font-medium">✓</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Watch out for */}
              {deepDive.watchOutFor.length > 0 && (
                <div className="px-4 py-3.5 border-t border-[#E0E8ED] dark:border-[#3D5A6E]">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-amber-600 dark:text-amber-500 mb-2">Watch out for</p>
                  <ul className="space-y-1.5">
                    {deepDive.watchOutFor.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-[#3D5A6E] dark:text-[#B8D4E3] leading-snug">
                        <span className="text-amber-500 flex-shrink-0 mt-0.5">⚠</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Standout features */}
              {deepDive.standoutFeatures.length > 0 && (
                <div className="px-4 py-3.5 border-t border-[#E0E8ED] dark:border-[#3D5A6E]">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-[#9BB0C1] dark:text-[#6B8299] mb-2">Standout features</p>
                  <ul className="space-y-1.5">
                    {deepDive.standoutFeatures.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-[#3D5A6E] dark:text-[#B8D4E3] leading-snug">
                        <span className="text-[#9BB0C1] dark:text-[#6B8299] flex-shrink-0 mt-0.5">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Bottom line */}
              {deepDive.bottomLine && (
                <div className="px-4 py-3.5 border-t border-[#E0E8ED] dark:border-[#3D5A6E] bg-[#F8FAFB] dark:bg-[#2a3f52]/60">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-[#9BB0C1] dark:text-[#6B8299] mb-1.5">Bottom line</p>
                  <p className="text-sm text-[#2C3E50] dark:text-[#B8D4E3] leading-relaxed font-medium">{deepDive.bottomLine}</p>
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          <div>
            <p className="text-[#9BB0C1] dark:text-[#6B8299] text-xs uppercase tracking-wide mb-1.5">Notes</p>
            <textarea
              className="w-full bg-[#F8FAFB] dark:bg-[#2a3f52] text-[#2C3E50] dark:text-[#B8D4E3] text-sm rounded-lg border border-[#E0E8ED] dark:border-[#3D5A6E] p-2.5 resize-none focus:outline-none focus:border-[#5B8BA0] transition-colors"
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
                  ? "bg-[#5B8BA0]/10 dark:bg-[#5B8BA0]/20 text-[#5B8BA0] dark:text-[#7DBAD4] hover:bg-[#5B8BA0]/20 dark:hover:bg-[#5B8BA0]/30"
                  : "bg-[#5B8BA0] text-white hover:bg-[#4A7A8F]"
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
                    ? "bg-[#E0E8ED] dark:bg-[#4A7A8F] text-[#2C3E50] dark:text-white font-medium"
                    : "bg-[#EEF4F8] dark:bg-[#2a3f52] text-[#6B8299] dark:text-[#9BB0C1] hover:bg-[#E0E8ED] dark:hover:bg-[#3D5A6E]"
                }`}
                onClick={() => onStatusChange(s)}
              >
                {s === "interested" ? "⭐ Interested" : s === "rejected" ? "✗ Reject" : "✅ Booked"}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-2">
              {deepDiveError && (
                <span className="text-xs text-red-500 dark:text-red-400">Research failed — try again</span>
              )}
              <button
                className="px-3 py-1.5 text-sm rounded-lg bg-[#EEF4F8] dark:bg-[#2a3f52] text-[#6B8299] dark:text-[#9BB0C1] hover:bg-[#E0E8ED] dark:hover:bg-[#3D5A6E] transition-colors disabled:opacity-50"
                onClick={handleDeepDive}
                disabled={loadingDive}
              >
                {loadingDive ? (
                  <span className="flex items-center gap-1.5">
                    <span className="animate-spin inline-block">⟳</span> Researching…
                  </span>
                ) : (
                  deepDive ? "Re-research →" : "Deep Dive →"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
