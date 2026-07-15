"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Profile, ScoredOption, TripWorkspace, AxisWeights, DeepDiveResult, SearchCategory, ChatMessage, PropertyFeedback } from "@/types";
import { fitTier, FIT_TIERS } from "@/lib/fitScore";
import { CATEGORY_META } from "@/lib/categories";
import { validateUrl, reportBadUrl, findReplacementUrl } from "@/lib/urlValidation";
import { isFeedbackEligible, relevantFeedbackAxes, AXIS_FEEDBACK_FLAGS } from "@/lib/feedback";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { logEvent } from "@/lib/analytics";

interface Props {
  option: ScoredOption;
  workspace: TripWorkspace;
  travelers: Profile[];
  profileWeights: AxisWeights | undefined;
  isSelected: boolean;
  category?: SearchCategory;
  searchQuery?: string;
  /** "list" = compact row, click fires onSelect; "detail" = always-expanded panel; "default" = current toggle behavior */
  variant?: "default" | "list" | "detail";
  selected?: boolean;
  onSelect?: () => void;
  onToggleSelect: () => void;
  onSave: () => void;
  onStatusChange: (status: ScoredOption["status"]) => void;
  onNotesChange: (notes: string) => void;
  onChatUpdate: (messages: ChatMessage[]) => void;
  onDeepDive: () => void;
  onFeedbackSubmit: (feedback: PropertyFeedback) => void;
  onExpandedChange?: (expanded: boolean) => void;
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
  searchQuery,
  variant = "default",
  selected = false,
  onSelect,
  onToggleSelect,
  onSave,
  onStatusChange,
  onNotesChange,
  onChatUpdate,
  onDeepDive,
  onFeedbackSubmit,
  onExpandedChange,
}: Props) {
  const isList = variant === "list";
  const isDetail = variant === "detail";
  const [expanded, setExpanded] = useState(false);
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [showFullExplanation, setShowFullExplanation] = useState(false);
  const [notes, setNotes] = useState(option.notes);
  const [feedbackDismissed, setFeedbackDismissed] = useState(false);
  const [metExpectations, setMetExpectations] = useState<PropertyFeedback["metExpectations"] | null>(null);
  const [flaggedAxes, setFlaggedAxes] = useState<Set<keyof AxisWeights>>(new Set());
  const [feedbackNote, setFeedbackNote] = useState("");
  const [deepDive, setDeepDive] = useState<DeepDiveResult | null>(null);
  const [deepDiveMode, setDeepDiveMode] = useState(false);
  const [loadingDive, setLoadingDive] = useState(false);
  const [deepDiveError, setDeepDiveError] = useState(false);
  const [showScoreLegend, setShowScoreLegend] = useState(false);
  // "About this property" in expanded card mode — collapsed by default
  const [aboutExpanded, setAboutExpanded] = useState(false);
  const legendTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Deep dive progressive disclosure
  // ("About this property" removed from Deep Dive — lives in expanded card only)
  const [showMoreWhyItFits, setShowMoreWhyItFits] = useState(false);
  const [watchOutForExpanded, setWatchOutForExpanded] = useState(false);
  const [standoutExpanded, setStandoutExpanded] = useState(false);

  // Chat state — initialize from persisted history
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(option.chatHistory ?? []);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages]);

  // Reset deep dive collapse states when a new deep dive loads
  useEffect(() => {
    setShowMoreWhyItFits(false);
    setWatchOutForExpanded(false);
    setStandoutExpanded(false);
  }, [deepDive]);

  // Escape key closes the focus-mode overlay
  useEffect(() => {
    if (!overlayOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setOverlayOpen(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [overlayOpen]);

  // Prevent body scroll while overlay is open
  useEffect(() => {
    if (overlayOpen) { document.body.style.overflow = "hidden"; }
    else { document.body.style.overflow = ""; }
    return () => { document.body.style.overflow = ""; };
  }, [overlayOpen]);

  const handleChatSend = useCallback(async () => {
    const msg = chatInput.trim();
    if (!msg || chatLoading) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: msg,
      timestamp: new Date().toISOString(),
    };
    const updatedHistory = [...chatMessages, userMsg];
    setChatMessages(updatedHistory);
    setChatInput("");
    setChatLoading(true);

    try {
      const res = await fetchWithAuth("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          option,
          workspaceId: workspace.id,
          history: updatedHistory,
          message: msg,
          searchQuery,
        }),
      });
      const data = await res.json();
      const replyMsg: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: "assistant",
        content: data.reply || data.error || "Sorry, I couldn't get a response. Try again.",
        timestamp: new Date().toISOString(),
      };
      const fullHistory = [...updatedHistory, replyMsg];
      setChatMessages(fullHistory);
      onChatUpdate(fullHistory);
    } catch {
      const errorMsg: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: "assistant",
        content: "Something went wrong. Please try again.",
        timestamp: new Date().toISOString(),
      };
      const fullHistory = [...updatedHistory, errorMsg];
      setChatMessages(fullHistory);
      onChatUpdate(fullHistory);
    } finally {
      setChatLoading(false);
    }
  }, [chatInput, chatLoading, chatMessages, option, workspace.id, searchQuery, onChatUpdate]);

  // URL validation + automatic link recovery
  type UrlStatus = "idle" | "checking" | "valid" | "recovering" | "recovered" | "not_found";
  const [urlStatus, setUrlStatus] = useState<UrlStatus>("idle");
  const [resolvedUrl, setResolvedUrl] = useState<string>(option.source ?? "");
  const [reportSent, setReportSent] = useState(false);

  /** Attempt to find a replacement URL via Google Places. */
  function recoverUrl() {
    setUrlStatus("recovering");
    findReplacementUrl({
      name: option.name,
      category: category,
      destination: workspace.destination,
    }).then((found) => {
      if (found) {
        setResolvedUrl(found);
        setUrlStatus("recovered");
      } else {
        setUrlStatus("not_found");
      }
    });
  }

  // Trigger validation the first time the detail section becomes visible —
  // either when the user expands a default card, or immediately in detail variant.
  useEffect(() => {
    if ((!expanded && !isDetail) || urlStatus !== "idle") return;
    const raw = option.source?.trim();
    if (!raw || !/^https?:\/\//i.test(raw)) {
      recoverUrl();
      return;
    }
    setUrlStatus("checking");
    validateUrl(raw).then((result) => {
      if (result.valid && result.finalUrl) {
        setResolvedUrl(result.finalUrl);
        setUrlStatus("valid");
      } else {
        recoverUrl();
      }
    });
  }, [expanded, isDetail]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleReport() {
    reportBadUrl({
      resultId: option.id,
      resultName: option.name,
      reportedUrl: resolvedUrl || option.source || "",
      timestamp: new Date().toISOString(),
    });
    setReportSent(true);
    recoverUrl(); // try to find a better link immediately
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

  // Post-trip feedback — personal, low-energy (MVP backlog #1/#2)
  const feedbackEligible = isFeedbackEligible(option, workspace);
  const feedbackAxes = relevantFeedbackAxes(profileWeights ?? travelers[0]?.axisWeights ?? option.axisScores);

  function toggleAxisFlag(axis: keyof AxisWeights) {
    setFlaggedAxes((prev) => {
      const next = new Set(prev);
      if (next.has(axis)) next.delete(axis);
      else next.add(axis);
      return next;
    });
  }

  function handleFeedbackSubmit() {
    if (!metExpectations) return;
    onFeedbackSubmit({
      metExpectations,
      axisFlags: Array.from(flaggedAxes),
      note: feedbackNote.trim(),
      submittedAt: new Date().toISOString(),
    });
  }

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
      const res = await fetchWithAuth("/api/deepdive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ option, workspaceId: workspace.id }),
      });
      const data = await res.json();
      if (data.deepDive) {
        setDeepDive(data.deepDive);
        setDeepDiveMode(true);
        onDeepDive();
        setTimeout(() => cardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
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

  const seeWhyCopy =
    travelers.length === 1
      ? "See why this fits you →"
      : travelers.length === 2
      ? `See why this fits ${travelers[0].name} & ${travelers[1].name} →`
      : "See why this fits everyone →";

  // Group fit summary badge
  const hasMultipleTravelers = travelers.length > 1;
  const travelerScoreValues = hasMultipleTravelers
    ? travelers.map((t) => option.travelerScores?.[t.id]?.alignmentScore ?? option.alignmentScore)
    : [];
  const groupMin = hasMultipleTravelers ? Math.min(...travelerScoreValues) : null;
  const groupMinTier = groupMin !== null ? fitTier(groupMin) : null;

  const selectionRing = isList && selected ? "ring-2 ring-[#5B8BA0]/40" : "";

  // ── Section heading class helpers ─────────────────────────────────────────────
  // Applied consistently in both the inline expanded card and the focus-mode overlay.
  const sH = "text-sm font-semibold text-[#2C3E50] dark:text-[#B8D4E3]";
  const sHAmber = "text-sm font-semibold text-amber-600 dark:text-amber-500";
  const sHGreen = "text-sm font-semibold text-green-600 dark:text-green-500";

  // ── Source link block ──────────────────────────────────────────────────────────
  // Shared by renderExpandedCardMode. inOverlay=true → teal button style (same as isDetail).
  function renderSourceBlock(inOverlay: boolean) {
    const useLargeButton = isDetail || inOverlay;
    return (
      <div className="flex flex-col gap-0.5 min-h-[1.5rem]">
        <div className="flex items-center gap-3 flex-wrap">
          {(urlStatus === "checking" || urlStatus === "recovering") && (
            <span className="text-xs text-[#9BB0C1] dark:text-[#6B8299] animate-pulse">
              {urlStatus === "recovering" ? "Finding link…" : "Checking source…"}
            </span>
          )}
          {urlStatus === "valid" && (
            <>
              <a
                href={resolvedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={useLargeButton
                  ? "inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#5B8BA0] text-white hover:bg-[#4A7A8F] text-sm font-medium transition-colors shadow-sm"
                  : "text-[#5B8BA0] dark:text-[#7DBAD4] hover:underline text-sm inline-flex items-center gap-1"}
                onClick={() => logEvent({ event: "viyaway_link_clicked", itemId: option.id, urlStatus, destination: workspace.destination ?? null })}
              >
                {useLargeButton ? <><span>🔗</span>{getSourceLabel(resolvedUrl)}</> : getSourceLabel(resolvedUrl)}
              </a>
              {!reportSent && (
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
          {urlStatus === "recovered" && (
            <a
              href={resolvedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={useLargeButton
                ? "inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#5B8BA0]/80 text-white hover:bg-[#4A7A8F] text-sm font-medium transition-colors shadow-sm"
                : "text-[#5B8BA0] dark:text-[#7DBAD4] hover:underline text-sm inline-flex items-center gap-1"}
              onClick={() => logEvent({ event: "viyaway_link_clicked", itemId: option.id, urlStatus, destination: workspace.destination ?? null })}
            >
              {useLargeButton ? <><span>🔗</span>{getSourceLabel(resolvedUrl)}</> : getSourceLabel(resolvedUrl)}
            </a>
          )}
          {urlStatus === "not_found" && <span className="text-xs text-[#9BB0C1] dark:text-[#6B8299]">Source not available</span>}
        </div>
        {urlStatus === "recovered" && (
          <span className="text-xs text-[#9BB0C1] dark:text-[#6B8299]">Couldn&apos;t verify the original link — this may be the official site</span>
        )}
      </div>
    );
  }

  // ── Shared render functions ────────────────────────────────────────────────────
  // Both the inline expanded card and the focus-mode overlay call the same functions.
  // All state (deepDiveMode, chatOpen, notes, aboutExpanded, etc.) lives here in the
  // parent component scope — one implementation, no drift between the two presentations.

  function renderExpandedCardMode(inOverlay = false) {
    return (
      <div className="space-y-4">
        {/* Focus-mode trigger — inline card only, desktop only */}
        {!isDetail && !inOverlay && (
          <div className="flex justify-end -mb-1">
            <button
              className="hidden md:inline-flex items-center gap-1 text-xs text-[#9BB0C1] dark:text-[#6B8299] hover:text-[#5B8BA0] dark:hover:text-[#7DBAD4] transition-colors"
              onClick={() => setOverlayOpen(true)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 3 21 3 21 9" />
                <polyline points="9 21 3 21 3 15" />
                <line x1="21" y1="3" x2="14" y2="10" />
                <line x1="3" y1="21" x2="10" y2="14" />
              </svg>
              Focus view
            </button>
          </div>
        )}

        {/* 2. About this property — collapsible, collapsed by default */}
        {option.description && (
          <div>
            <button
              className="w-full text-left"
              onClick={() => setAboutExpanded((v) => !v)}
            >
              <div className="flex items-center justify-between gap-2">
                <p className={sH}>About this property</p>
                <span className="text-[#9BB0C1] text-xs flex-shrink-0">{aboutExpanded ? "▲" : "▼"}</span>
              </div>
              {!aboutExpanded && (
                <p className="mt-0.5 text-xs text-[#9BB0C1] dark:text-[#6B8299]">Property details ↓</p>
              )}
            </button>
            {aboutExpanded && (
              <p className="mt-2 text-sm text-[#3D5A6E] dark:text-[#B8D4E3] leading-relaxed">{option.description}</p>
            )}
          </div>
        )}

        {/* Source link — teal button in overlay/detail, text link in inline card */}
        {renderSourceBlock(inOverlay)}

        {/* 3. Traveler fit */}
        {travelers.length > 0 && (
          <div>
            <p className={`${sH} mb-2.5`}>Traveler fit</p>
            <div className="space-y-2.5">
              {travelers.map((traveler, idx) => {
                const ts = option.travelerScores?.[traveler.id];
                const tScore = ts?.alignmentScore ?? option.alignmentScore;
                const violations = ts?.thresholdViolations ?? [];
                const tTier = fitTier(tScore);
                const barWidth = Math.max(0, Math.min(100, tScore));
                return (
                  <div key={traveler.id}>
                    <div className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 ${AVATAR_COLORS[idx % AVATAR_COLORS.length]}`}>
                        {traveler.name[0]}
                      </div>
                      <span className="text-sm text-[#3D5A6E] dark:text-[#B8D4E3] w-20 truncate flex-shrink-0">{traveler.name}</span>
                      <div
                        className="flex-1 relative bg-[#E0E8ED] dark:bg-[#3D5A6E]"
                        style={{ height: "8px", borderRadius: "9999px" }}
                      >
                        <div
                          style={{
                            position: "absolute", top: 0, left: 0, height: "8px", borderRadius: "9999px",
                            width: `${barWidth}%`, backgroundColor: tTier.hex, backgroundImage: "none", background: tTier.hex,
                          }}
                        />
                      </div>
                      <span className="text-xs font-mono tabular-nums w-10 text-right flex-shrink-0 font-medium" style={{ color: tTier.hex }}>
                        {tScore}%
                      </span>
                    </div>
                    {violations.length > 0 && (
                      <div className="ml-[calc(1.5rem+0.75rem+5rem+0.75rem)] mt-1">
                        <span className="text-xs text-amber-600 dark:text-amber-400">⚠ Below threshold: {violations.join(", ")}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 4. THE VERDICT — shown when deep dive data is available */}
        {deepDive?.bottomLine && (
          <div className="rounded-xl px-4 py-4 bg-green-50/60 dark:bg-green-900/10 border-l-4 border-green-500 dark:border-green-600">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-green-600 dark:text-green-500 mb-1.5">The Verdict</p>
            <p className="text-sm text-[#2C3E50] dark:text-[#B8D4E3] leading-relaxed font-medium">{deepDive.bottomLine}</p>
          </div>
        )}

        {/* 5. See why / Research again CTA */}
        <div>
          {deepDiveError && (
            <p className="text-xs text-red-500 dark:text-red-400 mb-2">Research failed — try again</p>
          )}
          {deepDive ? (
            <button
              className="w-full px-4 py-2.5 text-sm rounded-lg border border-[#5B8BA0]/40 dark:border-[#5B8BA0]/50 text-[#5B8BA0] dark:text-[#7DBAD4] hover:bg-[#5B8BA0]/8 dark:hover:bg-[#5B8BA0]/15 transition-colors font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              onClick={handleDeepDive}
              disabled={loadingDive}
            >
              {loadingDive ? <><span className="animate-spin inline-block">⟳</span><span>Researching…</span></> : "Research again →"}
            </button>
          ) : (
            <button
              className="w-full px-4 py-2.5 text-sm rounded-lg bg-[#5B8BA0] text-white hover:bg-[#4A7A8F] transition-colors font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              onClick={handleDeepDive}
              disabled={loadingDive}
            >
              {loadingDive ? <><span className="animate-spin inline-block">⟳</span><span>Researching…</span></> : seeWhyCopy}
            </button>
          )}
        </div>

        {/* 6. Watch out for */}
        {option.tradeoffs.length > 0 && (
          <div>
            <p className={`${sHAmber} mb-1`}>Watch out for</p>
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

        {/* 7. Ask ViyaWay chat trigger */}
        <button
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors font-medium ${
            chatOpen
              ? "bg-[#5B8BA0]/10 dark:bg-[#5B8BA0]/20 text-[#5B8BA0] dark:text-[#7DBAD4]"
              : "bg-[#EEF4F8] dark:bg-[#2a3f52] text-[#6B8299] dark:text-[#9BB0C1] hover:bg-[#E0E8ED] dark:hover:bg-[#3D5A6E]"
          }`}
          onClick={() => { setChatOpen((v) => !v); if (!chatOpen) setTimeout(() => chatInputRef.current?.focus(), 100); }}
        >
          <span className="text-sm">💬</span>
          <span>{chatOpen ? "Hide chat" : "Ask ViyaWay about this place"}</span>
          {chatMessages.length > 0 && !chatOpen && <span className="text-xs opacity-60">({chatMessages.length})</span>}
        </button>

        {/* Inline Chat */}
        {chatOpen && (
          <div className="rounded-xl bg-[#F3F7FA] dark:bg-[#1a2a38] border border-[#E0E8ED] dark:border-[#2a3f52] overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-[#E0E8ED] dark:border-[#2a3f52]">
              <div>
                <p className="text-xs font-medium text-[#3D5A6E] dark:text-[#B8D4E3]">Ask anything about {option.name}</p>
                <p className="text-[10px] text-[#9BB0C1] dark:text-[#6B8299]">
                  {travelers.length === 1
                    ? `For ${travelers[0].name}`
                    : `For ${travelers.slice(0, -1).map((t) => t.name).join(", ")} & ${travelers[travelers.length - 1].name}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {chatMessages.length > 0 && (
                  <button className="text-[10px] text-[#9BB0C1] dark:text-[#6B8299] hover:text-red-500 dark:hover:text-red-400 transition-colors"
                    onClick={() => { setChatMessages([]); onChatUpdate([]); }} title="Clear chat history">Clear</button>
                )}
                <button className="text-[10px] text-[#9BB0C1] dark:text-[#6B8299] hover:text-[#5B8BA0] dark:hover:text-[#7DBAD4] transition-colors"
                  onClick={() => setChatOpen(false)}>Collapse</button>
              </div>
            </div>
            <div className="max-h-64 sm:max-h-72 overflow-y-auto p-3 space-y-2.5">
              {chatMessages.length === 0 && (
                <p className="text-xs text-[#9BB0C1] dark:text-[#6B8299] text-center py-4">
                  Pricing, vibe, logistics, or how it fits your travel style — ask away.
                </p>
              )}
              {chatMessages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-[#5B8BA0] text-white rounded-br-md"
                      : "bg-white dark:bg-[#2a3f52] text-[#3D5A6E] dark:text-[#B8D4E3] border border-[#E0E8ED] dark:border-[#3D5A6E] rounded-bl-md"
                  }`}>{msg.content}</div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="bg-white dark:bg-[#2a3f52] border border-[#E0E8ED] dark:border-[#3D5A6E] px-3 py-2 rounded-2xl rounded-bl-md">
                    <span className="flex gap-1">
                      <span className="w-1.5 h-1.5 bg-[#9BB0C1] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-1.5 h-1.5 bg-[#9BB0C1] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-1.5 h-1.5 bg-[#9BB0C1] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            <div className="flex items-center gap-2 px-3 py-2.5 border-t border-[#E0E8ED] dark:border-[#2a3f52] bg-white dark:bg-[#1e2d3d] sticky bottom-0">
              <input
                ref={chatInputRef}
                type="text"
                className="flex-1 bg-transparent text-sm text-[#2C3E50] dark:text-[#B8D4E3] placeholder-[#9BB0C1] dark:placeholder-[#6B8299] outline-none min-w-0"
                placeholder="Ask about pricing, vibe, logistics…"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleChatSend(); } }}
                disabled={chatLoading}
              />
              <button
                className="text-[#5B8BA0] dark:text-[#7DBAD4] hover:text-[#4A7A8F] dark:hover:text-[#9DCAE8] disabled:opacity-40 transition-colors text-sm font-medium px-2 py-1 flex-shrink-0"
                onClick={handleChatSend}
                disabled={chatLoading || !chatInput.trim()}
              >Send</button>
            </div>
          </div>
        )}

        {/* 8. Notes */}
        <div>
          <p className={`${sH} mb-1.5`}>Notes</p>
          <textarea
            className="w-full bg-[#F8FAFB] dark:bg-[#2a3f52] text-[#2C3E50] dark:text-[#B8D4E3] text-sm rounded-lg border border-[#E0E8ED] dark:border-[#3D5A6E] p-2.5 resize-none focus:outline-none focus:border-[#5B8BA0] transition-colors"
            rows={2} placeholder="Add notes…" value={notes}
            onChange={(e) => setNotes(e.target.value)} onBlur={() => onNotesChange(notes)}
          />
        </div>

        {/* Post-trip feedback */}
        {option.feedback ? (
          <div className="rounded-xl border border-[#E0E8ED] dark:border-[#3D5A6E] bg-[#F8FAFB] dark:bg-[#2a3f52]/60 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[#9BB0C1] dark:text-[#6B8299] mb-1.5">Your feedback</p>
            <p className="text-sm text-[#3D5A6E] dark:text-[#B8D4E3]">
              {option.feedback.metExpectations === "yes" ? "Met expectations ✓" : option.feedback.metExpectations === "no" ? "Didn't meet expectations ✗" : "Mixed — partly met expectations"}
            </p>
            {option.feedback.axisFlags.length > 0 && (
              <ul className="mt-1.5 space-y-1">
                {option.feedback.axisFlags.map((axis) => (
                  <li key={axis} className="text-xs text-amber-600 dark:text-amber-400">⚠ {AXIS_FEEDBACK_FLAGS[axis]}</li>
                ))}
              </ul>
            )}
            {option.feedback.note && (
              <p className="text-sm text-[#6B8299] dark:text-[#9BB0C1] mt-1.5 italic">&quot;{option.feedback.note}&quot;</p>
            )}
          </div>
        ) : feedbackEligible && !feedbackDismissed ? (
          <div className="rounded-xl border border-[#5B8BA0]/40 dark:border-[#5B8BA0] bg-[#5B8BA0]/8 dark:bg-[#5B8BA0]/15 px-4 py-3 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-[#3D5A6E] dark:text-[#B8D4E3]">How was {option.name}?</p>
              <button className="text-xs text-[#9BB0C1] dark:text-[#6B8299] hover:text-[#3D5A6E] dark:hover:text-[#B8D4E3] flex-shrink-0"
                onClick={() => setFeedbackDismissed(true)}>Not now</button>
            </div>
            <div className="flex gap-1.5">
              {(["yes", "mixed", "no"] as PropertyFeedback["metExpectations"][]).map((v) => (
                <button key={v}
                  className={`px-3 py-1 text-xs rounded-lg capitalize transition-colors ${
                    metExpectations === v
                      ? "bg-[#5B8BA0] text-white font-medium"
                      : "bg-white dark:bg-[#1e2d3d] text-[#6B8299] dark:text-[#9BB0C1] border border-[#E0E8ED] dark:border-[#3D5A6E] hover:border-[#5B8BA0]"
                  }`}
                  onClick={() => setMetExpectations(v)}>
                  {v === "yes" ? "Met expectations" : v === "no" ? "Didn't meet expectations" : "Mixed"}
                </button>
              ))}
            </div>
            {feedbackAxes.length > 0 && (
              <div className="space-y-1">
                {feedbackAxes.map((axis) => (
                  <label key={axis} className="flex items-center gap-2 text-xs text-[#3D5A6E] dark:text-[#B8D4E3] cursor-pointer">
                    <input type="checkbox" className="accent-[#5B8BA0]" checked={flaggedAxes.has(axis)} onChange={() => toggleAxisFlag(axis)} />
                    {AXIS_FEEDBACK_FLAGS[axis]}
                  </label>
                ))}
              </div>
            )}
            <textarea
              className="w-full bg-white dark:bg-[#1e2d3d] text-[#2C3E50] dark:text-[#B8D4E3] text-xs rounded-lg border border-[#E0E8ED] dark:border-[#3D5A6E] p-2 resize-none focus:outline-none focus:border-[#5B8BA0] transition-colors"
              rows={2} placeholder="Anything worth remembering for next time? (optional)"
              value={feedbackNote} onChange={(e) => setFeedbackNote(e.target.value)}
            />
            <button
              className="px-3 py-1.5 text-xs rounded-lg bg-[#5B8BA0] text-white hover:bg-[#4A7A8F] disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium"
              onClick={handleFeedbackSubmit} disabled={!metExpectations}>Save feedback</button>
          </div>
        ) : null}

        {/* 9. Actions */}
        <div className="flex gap-2 flex-wrap">
          <button
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors font-medium ${
              isSaved
                ? "bg-[#5B8BA0]/10 dark:bg-[#5B8BA0]/20 text-[#5B8BA0] dark:text-[#7DBAD4] hover:bg-[#5B8BA0]/20 dark:hover:bg-[#5B8BA0]/30"
                : "bg-[#5B8BA0] text-white hover:bg-[#4A7A8F]"
            }`}
            onClick={onSave}
          >{isSaved ? "Saved ✓" : "Save"}</button>
          {(["interested", "rejected", "booked"] as ScoredOption["status"][]).map((s) => {
            const isActive = option.status === s;
            const activeClass =
              s === "booked" ? "bg-emerald-500 dark:bg-emerald-600 text-white font-semibold shadow-sm"
              : s === "interested" ? "bg-amber-400 dark:bg-amber-500 text-amber-900 dark:text-white font-semibold shadow-sm"
              : "bg-red-400 dark:bg-red-600 text-white font-semibold shadow-sm";
            return (
              <button key={s}
                className={`px-3 py-1.5 text-sm rounded-lg transition-all active:scale-95 ${isActive ? activeClass : "bg-[#EEF4F8] dark:bg-[#2a3f52] text-[#6B8299] dark:text-[#9BB0C1] hover:bg-[#E0E8ED] dark:hover:bg-[#3D5A6E]"}`}
                onClick={() => onStatusChange(s)}>
                {s === "interested" ? "⭐ Interested" : s === "rejected" ? "✗ Reject" : "✅ Booked"}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  function renderDeepDiveMode() {
    return (
      /* ── DEEP DIVE MODE ── mutually exclusive with expanded card mode.
         "About this property" intentionally absent — it lives in the expanded card above. */
      <div className="space-y-4">
        {/* Back link at top */}
        <button
          className="text-xs text-[#5B8BA0] dark:text-[#7DBAD4] hover:underline"
          onClick={() => setDeepDiveMode(false)}
        >
          ← Back to results
        </button>

        {/* THE VERDICT — leads deep dive */}
        {deepDive!.bottomLine && (
          <div className="rounded-xl px-4 py-4 bg-green-50/60 dark:bg-green-900/10 border-l-4 border-green-500 dark:border-green-600">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-green-600 dark:text-green-500 mb-1.5">The Verdict</p>
            <p className="text-sm text-[#2C3E50] dark:text-[#B8D4E3] leading-relaxed font-medium">{deepDive!.bottomLine}</p>
          </div>
        )}

        <div className="rounded-xl border border-[#E0E8ED] dark:border-[#3D5A6E] overflow-hidden">
          {/* Why this fits you */}
          {deepDive!.whyItFits.length > 0 && (
            <div className="px-4 py-4">
              <p className={`${sHGreen} mb-2.5`}>Why this fits you</p>
              <ul className="space-y-2">
                {deepDive!.whyItFits.slice(0, 2).map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-[#3D5A6E] dark:text-[#B8D4E3] leading-snug">
                    <span className="text-green-500 flex-shrink-0 mt-0.5 font-medium">✓</span>
                    <span>{item}</span>
                  </li>
                ))}
                {showMoreWhyItFits && deepDive!.whyItFits.slice(2).map((item, i) => (
                  <li key={i + 2} className="flex items-start gap-2 text-sm text-[#3D5A6E] dark:text-[#B8D4E3] leading-snug">
                    <span className="text-green-500 flex-shrink-0 mt-0.5 font-medium">✓</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              {deepDive!.whyItFits.length > 2 && (
                <button className="mt-2 text-xs text-[#5B8BA0] dark:text-[#7DBAD4] hover:underline"
                  onClick={() => setShowMoreWhyItFits((v) => !v)}>
                  {showMoreWhyItFits ? "Show less" : `Show ${deepDive!.whyItFits.length - 2} more reason${deepDive!.whyItFits.length - 2 === 1 ? "" : "s"} →`}
                </button>
              )}
            </div>
          )}

          {/* Watch out for — Deep Dive mode only; option.tradeoffs not rendered here */}
          {deepDive!.watchOutFor.length > 0 && (
            <div className="px-4 py-4 border-t border-[#E0E8ED] dark:border-[#3D5A6E]">
              <div className="flex items-center justify-between gap-2 cursor-pointer"
                onClick={() => setWatchOutForExpanded((v) => !v)}>
                <p className={sHAmber}>Watch out for</p>
                <span className="text-[#9BB0C1] text-xs flex-shrink-0">{watchOutForExpanded ? "▲" : "▼"}</span>
              </div>
              <ul className="mt-2 space-y-2">
                <li className="flex items-start gap-2 text-sm text-[#3D5A6E] dark:text-[#B8D4E3] leading-snug">
                  <span className="text-amber-500 flex-shrink-0 mt-0.5">⚠</span>
                  <span>{deepDive!.watchOutFor[0]}</span>
                </li>
                {watchOutForExpanded && deepDive!.watchOutFor.slice(1).map((item, i) => (
                  <li key={i + 1} className="flex items-start gap-2 text-sm text-[#3D5A6E] dark:text-[#B8D4E3] leading-snug">
                    <span className="text-amber-500 flex-shrink-0 mt-0.5">⚠</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              {!watchOutForExpanded && deepDive!.watchOutFor.length > 1 && (
                <button className="mt-1.5 text-xs text-[#9BB0C1] dark:text-[#6B8299] hover:text-[#5B8BA0] dark:hover:text-[#7DBAD4]"
                  onClick={() => setWatchOutForExpanded(true)}>
                  {deepDive!.watchOutFor.length - 1} more thing{deepDive!.watchOutFor.length - 1 === 1 ? "" : "s"} to know ↓
                </button>
              )}
            </div>
          )}

          {/* What makes it stand out */}
          {deepDive!.standoutFeatures.length > 0 && (
            <div className="px-4 py-4 border-t border-[#E0E8ED] dark:border-[#3D5A6E]">
              <button className="w-full text-left" onClick={() => setStandoutExpanded((v) => !v)}>
                <div className="flex items-center justify-between gap-2">
                  <p className={sH}>What makes it stand out</p>
                  <span className="text-[#9BB0C1] text-xs flex-shrink-0">{standoutExpanded ? "▲" : "▼"}</span>
                </div>
                {!standoutExpanded && <p className="mt-1 text-xs text-[#9BB0C1] dark:text-[#6B8299]">See what&apos;s special ↓</p>}
              </button>
              {standoutExpanded && (
                <ul className="mt-2.5 space-y-2">
                  {deepDive!.standoutFeatures.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-[#3D5A6E] dark:text-[#B8D4E3] leading-snug">
                      <span className="text-[#9BB0C1] dark:text-[#6B8299] flex-shrink-0 mt-0.5">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Notes */}
        <div>
          <p className={`${sH} mb-1.5`}>Notes</p>
          <textarea
            className="w-full bg-[#F8FAFB] dark:bg-[#2a3f52] text-[#2C3E50] dark:text-[#B8D4E3] text-sm rounded-lg border border-[#E0E8ED] dark:border-[#3D5A6E] p-2.5 resize-none focus:outline-none focus:border-[#5B8BA0] transition-colors"
            rows={2} placeholder="Add notes…" value={notes}
            onChange={(e) => setNotes(e.target.value)} onBlur={() => onNotesChange(notes)}
          />
        </div>

        {/* Back link at bottom */}
        <button
          className="text-xs text-[#5B8BA0] dark:text-[#7DBAD4] hover:underline"
          onClick={() => setDeepDiveMode(false)}
        >
          ← Back to results
        </button>
      </div>
    );
  }

  return (
    <div ref={cardRef} className={`border rounded-xl bg-white dark:bg-[#1e2d3d] ${borderColor} ${selectionRing} transition-all`}>
      {/* Header */}
      <div
        className={`flex items-start gap-3 p-4 select-none ${isList ? "cursor-pointer" : isDetail ? "" : "cursor-pointer"}`}
        onClick={() => {
          if (isList) { onSelect?.(); return; }
          if (isDetail) return;
          const next = !expanded; setExpanded(next); onExpandedChange?.(next);
          if (next) logEvent({ event: "viyaway_result_expanded", itemId: option.id, fitScore: option.alignmentScore, enneagramType: travelers[0]?.enneagramType ?? "" });
        }}
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
            <p className={`text-[#6B8299] dark:text-[#9BB0C1] text-sm leading-relaxed ${isList ? "line-clamp-2" : showFullExplanation ? "" : "line-clamp-3"}`}>
              {option.fitExplanation}
            </p>
            {!isList && option.fitExplanation && option.fitExplanation.length > 160 && (
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
          {!isList && !isDetail && !expanded && (
            <div className="flex items-center gap-4 mt-2" onClick={(e) => e.stopPropagation()}>
              <button
                className="text-xs text-[#5B8BA0] dark:text-[#7DBAD4] hover:underline"
                onClick={() => {
                  const next = true;
                  setExpanded(next);
                  onExpandedChange?.(next);
                  logEvent({ event: "viyaway_result_expanded", itemId: option.id, fitScore: option.alignmentScore, enneagramType: travelers[0]?.enneagramType ?? "" });
                  handleDeepDive();
                }}
              >
                See why →
              </button>
              <button
                className="text-xs text-[#5B8BA0] dark:text-[#7DBAD4] hover:underline"
                onClick={() => {
                  const next = true;
                  setExpanded(next);
                  onExpandedChange?.(next);
                  setChatOpen(true);
                  setTimeout(() => chatInputRef.current?.focus(), 100);
                }}
              >
                Have a question? Ask ViyaWay →
              </button>
            </div>
          )}
        </div>

        {/* Chevron + focus-mode expand icon (default variant only) */}
        {!isList && !isDetail && (
          <div className="flex items-center gap-1.5 flex-shrink-0 mt-1" onClick={(e) => e.stopPropagation()}>
            {expanded && (
              <button
                className="text-[#9BB0C1] hover:text-[#5B8BA0] dark:hover:text-[#7DBAD4] transition-colors p-0.5 rounded"
                onClick={() => setOverlayOpen(true)}
                title="Open in focus view"
                aria-label="Open in focus view"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 3 21 3 21 9" />
                  <polyline points="9 21 3 21 3 15" />
                  <line x1="21" y1="3" x2="14" y2="10" />
                  <line x1="3" y1="21" x2="10" y2="14" />
                </svg>
              </button>
            )}
            <span className="text-[#9BB0C1] text-xs">{expanded ? "▲" : "▼"}</span>
          </div>
        )}
      </div>

      {/* Expanded details — always on in detail variant, toggled in default */}
      {(isDetail || (!isList && expanded)) && (
        <div className="px-4 pb-4 border-t border-[#E0E8ED] dark:border-[#2a3f52] pt-4">
          {!deepDiveMode ? renderExpandedCardMode() : renderDeepDiveMode()}
        </div>
      )}

      {/* Focus-mode overlay — desktop only (hidden on mobile), portal to document.body.
          Uses the same renderExpandedCardMode / renderDeepDiveMode functions as the inline
          card — no duplicate logic, state shared through closure. */}
      {overlayOpen && createPortal(
        <div
          className="fixed inset-0 z-50 hidden md:flex items-center justify-center"
          style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setOverlayOpen(false); }}
        >
          <div
            className={`bg-white dark:bg-[#1e2d3d] border ${borderColor} rounded-xl overflow-hidden flex flex-col`}
            style={{
              width: "65vw",
              maxWidth: "900px",
              height: "82vh",
              boxShadow: "0 32px 80px rgba(0,0,0,0.35), 0 12px 30px rgba(0,0,0,0.2), 0 3px 10px rgba(0,0,0,0.12)",
            }}
          >
            {/* Overlay header — property identity + fit explanation + close */}
            <div className="flex items-start gap-3 p-4 border-b border-[#E0E8ED] dark:border-[#2a3f52] flex-shrink-0">
              <div className="relative flex-shrink-0">
                <span className={`text-lg font-bold tabular-nums ${tier.text}`}>{score}%</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {hasMultipleTravelers && groupMin !== null && groupMinTier && groupMin !== score && (
                    <span className={`text-xs px-1.5 py-0.5 rounded-full border font-medium ${groupMinTier.text} ${groupMinTier.border} ${groupMinTier.bg}`}>
                      min {groupMin}%
                    </span>
                  )}
                  {statusEmoji[option.status] && <span className="text-sm">{statusEmoji[option.status]}</span>}
                  <span className="text-[#2C3E50] dark:text-white font-semibold">{option.name}</span>
                  {option.price && <span className="text-[#6B8299] dark:text-[#9BB0C1] text-sm">{option.price}</span>}
                  {category && CATEGORY_META[category] && (
                    <span className="text-[10px] text-[#E8A87C] uppercase tracking-wider font-medium">
                      {CATEGORY_META[category].icon} {CATEGORY_META[category].label}
                    </span>
                  )}
                </div>
                <p className="text-[#6B8299] dark:text-[#9BB0C1] text-sm leading-relaxed mt-1">{option.fitExplanation}</p>
              </div>
              <button
                className="text-[#9BB0C1] hover:text-[#2C3E50] dark:hover:text-white text-2xl leading-none flex-shrink-0 ml-2 transition-colors"
                onClick={() => setOverlayOpen(false)}
                aria-label="Close focus view"
              >×</button>
            </div>

            {/* Scrollable content — same render functions as the inline card */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {!deepDiveMode ? renderExpandedCardMode(true) : renderDeepDiveMode()}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
