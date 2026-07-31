"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Profile, ScoredOption, TripWorkspace, AxisWeights, DeepDiveResult, SearchCategory, ChatMessage, PropertyFeedback } from "@/types";
import { fitTier, FIT_TIERS } from "@/lib/fitScore";
import { CATEGORY_META } from "@/lib/categories";
import { validateUrl, reportBadUrl, findReplacementUrl } from "@/lib/urlValidation";
import { isSpamUrl } from "@/lib/urlSanitize";
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
  /** "list" = compact row, click fires onSelect; "detail" = always-expanded panel; "default" = toggle behavior */
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

function CategoryIcon({ category, size = 14 }: { category?: SearchCategory; size?: number }) {
  const p = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "#2C3E50",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (category) {
    case "accommodation":
      return (
        <svg {...p}>
          <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
          <polyline points="9 22 9 12 15 12 15 22" />
        </svg>
      );
    case "tour":
      return (
        <svg {...p}>
          <polygon points="3 11 22 2 13 21 11 13 3 11" />
        </svg>
      );
    case "restaurant":
      return (
        <svg {...p}>
          <path d="M18 8h1a4 4 0 010 8h-1" />
          <path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z" />
          <line x1="6" y1="1" x2="6" y2="4" />
          <line x1="10" y1="1" x2="10" y2="4" />
          <line x1="14" y1="1" x2="14" y2="4" />
        </svg>
      );
    case "activity":
      return (
        <svg {...p}>
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      );
    case "attraction":
      return (
        <svg {...p}>
          <circle cx="12" cy="10" r="3" />
          <path d="M12 2C8.13 2 5 5.13 5 10c0 5.25 7 12 7 12s7-6.75 7-12c0-3.87-3.13-8-7-8z" />
        </svg>
      );
    default:
      return (
        <svg {...p}>
          <circle cx="12" cy="10" r="3" />
          <path d="M12 2C8.13 2 5 5.13 5 10c0 5.25 7 12 7 12s7-6.75 7-12c0-3.87-3.13-8-7-8z" />
        </svg>
      );
  }
}

function ExpandIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
    </svg>
  );
}

const AVATAR_BG = ["#2C3E50", "#C4956A", "#2C3E50", "#C4956A", "#2C3E50"];

const CATEGORY_LABELS: Record<string, string> = {
  accommodation: "Accommodation",
  tour: "Tour",
  restaurant: "Restaurant",
  activity: "Activity",
  attraction: "Attraction",
};

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
  const [notes, setNotes] = useState(option.notes);
  const [feedbackDismissed, setFeedbackDismissed] = useState(false);
  const [metExpectations, setMetExpectations] = useState<PropertyFeedback["metExpectations"] | null>(null);
  const [flaggedAxes, setFlaggedAxes] = useState<Set<keyof AxisWeights>>(new Set());
  const [feedbackNote, setFeedbackNote] = useState("");
  const [deepDive, setDeepDive] = useState<DeepDiveResult | null>(null);
  const [deepDiveMode, setDeepDiveMode] = useState(false);
  const [loadingDive, setLoadingDive] = useState(false);
  const [deepDiveError, setDeepDiveError] = useState(false);
  const [flipClass, setFlipClass] = useState("");
  const [aboutExpanded, setAboutExpanded] = useState(false);
  const [tradeoffsExpanded, setTradeoffsExpanded] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const [showMoreWhyItFits, setShowMoreWhyItFits] = useState(false);
  const [watchOutForExpanded, setWatchOutForExpanded] = useState(false);
  const [standoutExpanded, setStandoutExpanded] = useState(false);

  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(option.chatHistory ?? []);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  useEffect(() => {
    setShowMoreWhyItFits(false);
    setWatchOutForExpanded(false);
    setStandoutExpanded(false);
  }, [deepDive]);

  useEffect(() => {
    if (!overlayOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setOverlayOpen(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [overlayOpen]);

  useEffect(() => {
    if (overlayOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [overlayOpen]);

  const handleChatSend = useCallback(async () => {
    const msg = chatInput.trim();
    if (!msg || chatLoading) return;
    const userMsg: ChatMessage = { id: `msg-${Date.now()}`, role: "user", content: msg, timestamp: new Date().toISOString() };
    const updatedHistory = [...chatMessages, userMsg];
    setChatMessages(updatedHistory);
    setChatInput("");
    setChatLoading(true);
    try {
      const res = await fetchWithAuth("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ option, workspaceId: workspace.id, history: updatedHistory, message: msg, searchQuery }),
      });
      const data = await res.json();
      const replyMsg: ChatMessage = { id: `msg-${Date.now()}`, role: "assistant", content: data.reply || data.error || "Sorry, I couldn't get a response. Try again.", timestamp: new Date().toISOString() };
      const fullHistory = [...updatedHistory, replyMsg];
      setChatMessages(fullHistory);
      onChatUpdate(fullHistory);
    } catch {
      const errorMsg: ChatMessage = { id: `msg-${Date.now()}`, role: "assistant", content: "Something went wrong. Please try again.", timestamp: new Date().toISOString() };
      const fullHistory = [...updatedHistory, errorMsg];
      setChatMessages(fullHistory);
      onChatUpdate(fullHistory);
    } finally {
      setChatLoading(false);
    }
  }, [chatInput, chatLoading, chatMessages, option, workspace.id, searchQuery, onChatUpdate]);

  type UrlStatus = "idle" | "checking" | "valid" | "recovering" | "recovered" | "not_found";
  const [urlStatus, setUrlStatus] = useState<UrlStatus>("idle");
  const [resolvedUrl, setResolvedUrl] = useState<string>(
    option.source && !isSpamUrl(option.source) ? option.source : ""
  );
  const [reportSent, setReportSent] = useState(false);

  function recoverUrl() {
    setUrlStatus("recovering");
    findReplacementUrl({ name: option.name, category, destination: workspace.destination }).then((found) => {
      if (found && !isSpamUrl(found)) { setResolvedUrl(found); setUrlStatus("recovered"); }
      else setUrlStatus("not_found");
    });
  }

  useEffect(() => {
    if ((!expanded && !isDetail) || urlStatus !== "idle") return;
    const raw = option.source?.trim();
    if (!raw || !/^https?:\/\//i.test(raw) || isSpamUrl(raw)) { recoverUrl(); return; }
    setUrlStatus("checking");
    validateUrl(raw).then((result) => {
      if (result.valid && result.finalUrl && !isSpamUrl(result.finalUrl)) { setResolvedUrl(result.finalUrl); setUrlStatus("valid"); }
      else recoverUrl();
    });
  }, [expanded, isDetail]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleReport() {
    reportBadUrl({ resultId: option.id, resultName: option.name, reportedUrl: resolvedUrl || option.source || "", timestamp: new Date().toISOString() });
    setReportSent(true);
    recoverUrl();
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
        if (hostname === domain || hostname.endsWith(`.${domain}`)) return `Book on ${name} →`;
      }
    } catch { /* invalid URL */ }
    return "View source →";
  }

  const isSaved = workspace.savedOptions.some((s) => s.id === option.id);

  const feedbackEligible = isFeedbackEligible(option, workspace);
  const feedbackAxes = relevantFeedbackAxes(profileWeights ?? travelers[0]?.axisWeights ?? option.axisScores);

  function toggleAxisFlag(axis: keyof AxisWeights) {
    setFlaggedAxes((prev) => { const next = new Set(prev); if (next.has(axis)) next.delete(axis); else next.add(axis); return next; });
  }

  function handleFeedbackSubmit() {
    if (!metExpectations) return;
    onFeedbackSubmit({ metExpectations, axisFlags: Array.from(flaggedAxes), note: feedbackNote.trim(), submittedAt: new Date().toISOString() });
  }

  async function fetchDeepDiveData(): Promise<DeepDiveResult | null> {
    try {
      const res = await fetchWithAuth("/api/deepdive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ option, workspaceId: workspace.id }),
      });
      const data = await res.json();
      if (data.deepDive) {
        setDeepDive(data.deepDive);
        onDeepDive();
        return data.deepDive;
      }
      setDeepDiveError(true);
      return null;
    } catch {
      setDeepDiveError(true);
      return null;
    }
  }

  function animateFlip(onMidpoint: () => void) {
    setFlipClass("card-flip-out");
    setTimeout(() => {
      onMidpoint();
      setFlipClass("card-flip-in");
      setTimeout(() => setFlipClass(""), 210);
    }, 200);
  }

  async function handleEnterDeepDive() {
    if (loadingDive) return;
    let data = deepDive;
    if (!data) {
      setLoadingDive(true);
      data = await fetchDeepDiveData();
      setLoadingDive(false);
      if (!data) return;
      setTimeout(() => cardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    }
    animateFlip(() => setDeepDiveMode(true));
  }

  function handleExitDeepDive() {
    animateFlip(() => setDeepDiveMode(false));
  }

  const judgmentLine = option.judgmentLine ?? (() => {
    const first = option.fitExplanation.split(/\.\s+/)[0];
    return first.length > 120 ? first.slice(0, 117) + "…" : first;
  })();

  const seeWhyCopy =
    travelers.length === 1 ? "See why this fits you →"
    : travelers.length === 2 ? `See why this fits ${travelers[0].name} & ${travelers[1].name} →`
    : "See why this fits everyone →";

  const aboutLabel = (() => {
    switch (category) {
      case "accommodation": return "About this property";
      case "tour":          return "About this tour";
      case "restaurant":    return "About this restaurant";
      case "activity":      return "About this activity";
      default:              return "About this place";
    }
  })();

  const categoryDisplay = CATEGORY_LABELS[category ?? ""] ?? "";
  const locationRow = [workspace.destination, categoryDisplay].filter(Boolean).join(" · ");

  // ── Source link block ─────────────────────────────────────────────────────────
  function renderSourceBlock() {
    return (
      <div className="flex flex-col gap-0.5 min-h-6">
        <div className="flex items-center gap-3 flex-wrap">
          {(urlStatus === "checking" || urlStatus === "recovering") && (
            <span className="text-xs text-[#888888] animate-pulse">
              {urlStatus === "recovering" ? "Finding link…" : "Checking source…"}
            </span>
          )}
          {(urlStatus === "valid" || urlStatus === "recovered") && (
            <>
              <a
                href={resolvedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-[#2C3E50] underline hover:opacity-70 transition-opacity"
                onClick={() => logEvent({ event: "viyaway_link_clicked", itemId: option.id, urlStatus, destination: workspace.destination ?? null })}
              >
                {getSourceLabel(resolvedUrl)}
              </a>
              {!reportSent && (
                <button onClick={handleReport} className="text-xs text-[#888888] hover:text-[#B5654A] transition-colors">
                  Report link
                </button>
              )}
            </>
          )}
          {urlStatus === "recovered" && (
            <span className="text-xs text-[#888888]">Couldn&apos;t verify original link</span>
          )}
          {urlStatus === "not_found" && <span className="text-xs text-[#888888]">Source not available</span>}
        </div>
      </div>
    );
  }

  // ── Expanded card content ─────────────────────────────────────────────────────
  function renderExpandedCardMode(_inOverlay = false) {
    const watchOutItems = deepDive?.watchOutFor?.length
      ? deepDive.watchOutFor
      : option.tradeoffs;

    return (
      <div className="space-y-5">
        {/* THE VERDICT */}
        {option.fitExplanation && (
          <div>
            <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "#C4956A", marginBottom: 10, fontFamily: "var(--font-encode-semi), ui-sans-serif, system-ui, sans-serif" }}>
              The Verdict
            </p>
            <div className="text-sm leading-[1.65] text-[#1A1A1A]" style={{ borderLeft: "3px solid #C4956A", paddingLeft: "14px" }}>
              {option.fitExplanation}
            </div>
          </div>
        )}

        {/* Traveler fit bars */}
        {travelers.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#888888] mb-3">
              Traveler fit
            </p>
            <div className="space-y-2.5">
              {travelers.map((traveler, idx) => {
                const ts = option.travelerScores?.[traveler.id];
                const tScore = ts?.alignmentScore ?? option.alignmentScore;
                const violations = ts?.thresholdViolations ?? [];
                const barWidth = Math.max(0, Math.min(100, tScore));
                return (
                  <div key={traveler.id}>
                    <div className="flex items-center gap-3">
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold text-white flex-shrink-0"
                        style={{ backgroundColor: AVATAR_BG[idx % AVATAR_BG.length] }}
                      >
                        {traveler.name[0]}
                      </div>
                      <span className="text-sm text-[#1A1A1A] truncate flex-shrink-0" style={{ width: "52px" }}>{traveler.name}</span>
                      <div
                        className="flex-1 relative"
                        style={{ height: "6px", borderRadius: "999px", backgroundColor: "#E8E8E8" }}
                      >
                        <div
                          style={{
                            position: "absolute", top: 0, left: 0, height: "6px",
                            borderRadius: "999px", width: `${barWidth}%`,
                            backgroundColor: "#6E9C74",
                          }}
                        />
                      </div>
                    </div>
                    {violations.length > 0 && (
                      <div className="mt-1" style={{ marginLeft: "calc(1.5rem + 0.75rem + 52px + 0.75rem)" }}>
                        <span className="text-xs text-[#B5654A]">⚠ Below threshold: {violations.join(", ")}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* See why CTA — triggers Deep Dive with card flip */}
        <div>
          {deepDiveError && (
            <p className="text-xs text-[#B5654A] mb-2">Research failed — try again</p>
          )}
          <button
            className="w-full bg-[#2C3E50] text-white text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ paddingTop: "13px", paddingBottom: "13px", borderRadius: 9999, fontFamily: "var(--font-encode-semi), ui-sans-serif, system-ui, sans-serif" }}
            onClick={handleEnterDeepDive}
            disabled={loadingDive}
          >
            {loadingDive
              ? <><span className="animate-spin inline-block">⟳</span><span>Researching…</span></>
              : seeWhyCopy}
          </button>
        </div>

        {/* Ask ViyaWay text link */}
        <div className="text-center">
          <button
            className="text-sm text-[#888888] underline hover:text-[#2C3E50] transition-colors"
            onClick={() => { setChatOpen((v) => !v); if (!chatOpen) setTimeout(() => chatInputRef.current?.focus(), 100); }}
          >
            {chatOpen ? "Hide chat" : "Ask ViyaWay about this place"}
            {chatMessages.length > 0 && !chatOpen && <span className="ml-1 opacity-60">({chatMessages.length})</span>}
          </button>
        </div>

        {/* Inline chat */}
        {chatOpen && (
          <div className="rounded-[4px] bg-[#F5F4F0] border border-[#E8E8E8] overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-[#E8E8E8] bg-white">
              <div>
                <p className="text-xs font-medium text-[#2C3E50]">Ask anything about {option.name}</p>
                {travelers.length > 0 && (
                  <p className="text-xs text-[#888888]">
                    {travelers.length === 1
                      ? `For ${travelers[0].name}`
                      : `For ${travelers.slice(0, -1).map((t) => t.name).join(", ")} & ${travelers[travelers.length - 1].name}`}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {chatMessages.length > 0 && (
                  <button className="text-xs text-[#888888] hover:text-[#B5654A] transition-colors"
                    onClick={() => { setChatMessages([]); onChatUpdate([]); }}>Clear</button>
                )}
                <button className="text-xs text-[#888888] hover:text-[#2C3E50] transition-colors"
                  onClick={() => setChatOpen(false)}>Collapse</button>
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto p-3 space-y-2.5">
              {chatMessages.length === 0 && (
                <p className="text-xs text-[#888888] text-center py-4">
                  Pricing, vibe, logistics, or how it fits your travel style — ask away.
                </p>
              )}
              {chatMessages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-[#2C3E50] text-white rounded-br-md"
                      : "bg-white text-[#1A1A1A] border border-[#E8E8E8] rounded-bl-md"
                  }`}>{msg.content}</div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="bg-white border border-[#E8E8E8] px-3 py-2 rounded-2xl rounded-bl-md">
                    <span className="flex gap-1">
                      <span className="w-1.5 h-1.5 bg-[#888888] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-1.5 h-1.5 bg-[#888888] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-1.5 h-1.5 bg-[#888888] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </span>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
            <div className="flex items-center gap-2 px-3 py-2.5 border-t border-[#E8E8E8] bg-white">
              <input
                ref={chatInputRef}
                type="text"
                className="flex-1 bg-transparent text-sm text-[#2C3E50] placeholder-[#888888] outline-none min-w-0"
                placeholder="Ask about pricing, vibe, logistics…"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleChatSend(); } }}
                disabled={chatLoading}
              />
              <button
                className="text-[#2C3E50] hover:opacity-70 disabled:opacity-40 transition-opacity text-sm font-medium px-2 py-1 flex-shrink-0"
                onClick={handleChatSend}
                disabled={chatLoading || !chatInput.trim()}
              >Send</button>
            </div>
          </div>
        )}

        <hr className="border-t border-[#E8E8E8]" />

        {/* Watch out for — first item visible, rest collapsible */}
        {watchOutItems.length > 0 && (
          <div>
            <p className="text-sm font-semibold mb-1.5" style={{ color: "#8a4530" }}>Watch out for</p>
            <div className="space-y-1.5">
              <div className="text-sm text-[#1A1A1A]" style={{ lineHeight: 1.6 }}>▲ {watchOutItems[0]}</div>
              {tradeoffsExpanded && watchOutItems.slice(1).map((t, i) => (
                <div key={i + 1} className="text-sm text-[#1A1A1A]" style={{ lineHeight: 1.6 }}>▲ {t}</div>
              ))}
            </div>
            {watchOutItems.length > 1 && !tradeoffsExpanded && (
              <button
                className="mt-1.5 text-xs text-[#888888] hover:text-[#2C3E50] transition-colors"
                onClick={() => setTradeoffsExpanded(true)}
              >
                {watchOutItems.length - 1} more thing{watchOutItems.length - 1 === 1 ? "" : "s"} to know ↓
              </button>
            )}
            {tradeoffsExpanded && watchOutItems.length > 1 && (
              <button
                className="mt-1.5 text-xs text-[#888888] hover:text-[#2C3E50] transition-colors"
                onClick={() => setTradeoffsExpanded(false)}
              >
                Show less ↑
              </button>
            )}
          </div>
        )}

        {/* What makes it stand out — from deepDive */}
        {deepDive && deepDive.standoutFeatures.length > 0 && (
          <div>
            <p className="text-sm font-semibold text-[#2C3E50] mb-1.5">What makes it stand out</p>
            <p className="text-sm text-[#1A1A1A]" style={{ lineHeight: 1.6 }}>
              {deepDive.standoutFeatures[0]}
            </p>
          </div>
        )}

        {/* About this property — collapsible */}
        {option.description && (
          <div>
            <button
              className="w-full text-left flex items-center justify-between gap-2"
              onClick={() => setAboutExpanded((v) => !v)}
            >
              <p className="text-sm font-semibold text-[#2C3E50]">{aboutLabel}</p>
              <span className="text-xs text-[#888888] flex-shrink-0">
                {aboutExpanded ? "▲" : "Property details ↓"}
              </span>
            </button>
            {aboutExpanded && (
              <p className="text-sm text-[#1A1A1A] mt-2" style={{ lineHeight: 1.6 }}>{option.description}</p>
            )}
          </div>
        )}

        {/* Source link */}
        {renderSourceBlock()}

        {/* Notes */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#888888] mb-2">Notes</p>
          <textarea
            className="w-full text-sm text-[#1A1A1A] border border-[#E8E8E8] rounded-[4px] p-3 resize-none focus:outline-none focus:border-[#2C3E50] transition-colors bg-white placeholder-[#888888]"
            rows={2}
            placeholder="Add a note…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={() => onNotesChange(notes)}
          />
        </div>

        {/* Post-trip feedback */}
        {option.feedback ? (
          <div className="rounded-[4px] border border-[#E8E8E8] bg-[#F5F4F0] px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#888888] mb-1.5">Your feedback</p>
            <p className="text-sm text-[#1A1A1A]">
              {option.feedback.metExpectations === "yes" ? "Met expectations ✓" : option.feedback.metExpectations === "no" ? "Didn't meet expectations ✗" : "Mixed — partly met expectations"}
            </p>
            {option.feedback.axisFlags.length > 0 && (
              <ul className="mt-1.5 space-y-1">
                {option.feedback.axisFlags.map((axis) => (
                  <li key={axis} className="text-xs text-[#B5654A]">⚠ {AXIS_FEEDBACK_FLAGS[axis]}</li>
                ))}
              </ul>
            )}
            {option.feedback.note && (
              <p className="text-sm text-[#888888] mt-1.5 italic">&quot;{option.feedback.note}&quot;</p>
            )}
          </div>
        ) : feedbackEligible && !feedbackDismissed ? (
          <div className="rounded-[4px] border border-[#C4956A]/40 bg-[#FBF4EC] px-4 py-3 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium text-[#2C3E50]">How was {option.name}?</p>
              <button className="text-xs text-[#888888] hover:text-[#2C3E50] flex-shrink-0" onClick={() => setFeedbackDismissed(true)}>Not now</button>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {(["yes", "mixed", "no"] as PropertyFeedback["metExpectations"][]).map((v) => (
                <button key={v}
                  className={`px-3 py-1 text-xs rounded-full capitalize transition-colors ${
                    metExpectations === v
                      ? "bg-[#2C3E50] text-white font-medium"
                      : "bg-white text-[#888888] border border-[#E8E8E8] hover:border-[#2C3E50]"
                  }`}
                  onClick={() => setMetExpectations(v)}>
                  {v === "yes" ? "Met expectations" : v === "no" ? "Didn't meet expectations" : "Mixed"}
                </button>
              ))}
            </div>
            {feedbackAxes.length > 0 && (
              <div className="space-y-1">
                {feedbackAxes.map((axis) => (
                  <label key={axis} className="flex items-center gap-2 text-xs text-[#1A1A1A] cursor-pointer">
                    <input type="checkbox" className="accent-[#2C3E50]" checked={flaggedAxes.has(axis)} onChange={() => toggleAxisFlag(axis)} />
                    {AXIS_FEEDBACK_FLAGS[axis]}
                  </label>
                ))}
              </div>
            )}
            <textarea
              className="w-full bg-white text-[#1A1A1A] text-xs rounded-[4px] border border-[#E8E8E8] p-2 resize-none focus:outline-none focus:border-[#2C3E50] transition-colors"
              rows={2} placeholder="Anything worth remembering? (optional)"
              value={feedbackNote} onChange={(e) => setFeedbackNote(e.target.value)}
            />
            <button
              className="px-3 py-1.5 text-xs rounded-full bg-[#2C3E50] text-white hover:opacity-90 disabled:opacity-40 transition-opacity font-medium"
              onClick={handleFeedbackSubmit} disabled={!metExpectations}>Save feedback</button>
          </div>
        ) : null}

        {/* Action row */}
        <div className="flex border-t border-[#E8E8E8] pt-4">
          <button
            className={`flex-1 text-center text-sm transition-colors ${
              isSaved ? "font-semibold text-[#2C3E50]" : "text-[#888888] hover:text-[#2C3E50]"
            }`}
            onClick={onSave}
          >
            {isSaved ? "Saved ✓" : "Save"}
          </button>
          {(["interested", "rejected", "booked"] as ScoredOption["status"][]).map((s) => {
            const isActive = option.status === s;
            return (
              <button
                key={s}
                className={`flex-1 text-center text-sm transition-colors ${
                  isActive ? "font-semibold text-[#2C3E50]" : "text-[#888888] hover:text-[#2C3E50]"
                }`}
                onClick={() => onStatusChange(s)}
              >
                {s === "interested" ? "Interested" : s === "rejected" ? "Reject" : "Booked"}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Deep Dive mode ────────────────────────────────────────────────────────────
  function renderDeepDiveMode() {
    return (
      <div className="space-y-4">
        <button className="text-xs text-[#2C3E50] hover:underline transition-opacity hover:opacity-70" onClick={handleExitDeepDive}>
          ← Back to results
        </button>

        {deepDive!.bottomLine && (
          <div className="rounded-[4px] px-4 py-4 bg-[#FBF4EC] border-l-4 border-[#C4956A]">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#C4956A] mb-1.5">The Verdict</p>
            <p className="text-sm text-[#2C3E50] leading-relaxed font-medium">{deepDive!.bottomLine}</p>
          </div>
        )}

        <div className="rounded-[4px] border border-[#E8E8E8] overflow-hidden">
          {deepDive!.whyItFits.length > 0 && (
            <div className="px-4 py-4">
              <p className="text-sm font-semibold text-[#6E9C74] mb-2.5">Why this fits you</p>
              <ul className="space-y-2">
                {deepDive!.whyItFits.slice(0, 2).map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-[#1A1A1A] leading-snug">
                    <span className="text-[#6E9C74] flex-shrink-0 mt-0.5 font-medium">✓</span>
                    <span>{item}</span>
                  </li>
                ))}
                {showMoreWhyItFits && deepDive!.whyItFits.slice(2).map((item, i) => (
                  <li key={i + 2} className="flex items-start gap-2 text-sm text-[#1A1A1A] leading-snug">
                    <span className="text-[#6E9C74] flex-shrink-0 mt-0.5 font-medium">✓</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              {deepDive!.whyItFits.length > 2 && (
                <button className="mt-2 text-xs text-[#888888] hover:text-[#2C3E50] underline"
                  onClick={() => setShowMoreWhyItFits((v) => !v)}>
                  {showMoreWhyItFits ? "Show less" : `Show ${deepDive!.whyItFits.length - 2} more reasons →`}
                </button>
              )}
            </div>
          )}

          {deepDive!.watchOutFor.length > 0 && (
            <div className="px-4 py-4 border-t border-[#E8E8E8]">
              <div className="flex items-center justify-between gap-2 cursor-pointer"
                onClick={() => setWatchOutForExpanded((v) => !v)}>
                <p className="text-sm font-semibold text-[#8a4530]">Watch out for</p>
                <span className="text-[#888888] text-xs">{watchOutForExpanded ? "▲" : "▼"}</span>
              </div>
              <ul className="mt-2 space-y-2">
                <li className="flex items-start gap-2 text-sm text-[#1A1A1A] leading-snug">
                  <span className="text-[#B5654A] flex-shrink-0 mt-0.5">▲</span>
                  <span>{deepDive!.watchOutFor[0]}</span>
                </li>
                {watchOutForExpanded && deepDive!.watchOutFor.slice(1).map((item, i) => (
                  <li key={i + 1} className="flex items-start gap-2 text-sm text-[#1A1A1A] leading-snug">
                    <span className="text-[#B5654A] flex-shrink-0 mt-0.5">▲</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              {!watchOutForExpanded && deepDive!.watchOutFor.length > 1 && (
                <button className="mt-1.5 text-xs text-[#888888] hover:text-[#2C3E50]"
                  onClick={() => setWatchOutForExpanded(true)}>
                  {deepDive!.watchOutFor.length - 1} more thing{deepDive!.watchOutFor.length - 1 === 1 ? "" : "s"} to know ↓
                </button>
              )}
            </div>
          )}

          {deepDive!.standoutFeatures.length > 0 && (
            <div className="px-4 py-4 border-t border-[#E8E8E8]">
              <button className="w-full text-left" onClick={() => setStandoutExpanded((v) => !v)}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-[#2C3E50]">What makes it stand out</p>
                  <span className="text-[#888888] text-xs">{standoutExpanded ? "▲" : "▼"}</span>
                </div>
              </button>
              {standoutExpanded && (
                <ul className="mt-2.5 space-y-2">
                  {deepDive!.standoutFeatures.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-[#1A1A1A] leading-snug">
                      <span className="text-[#888888] flex-shrink-0 mt-0.5">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {option.description && (
            <div className="px-4 py-4 border-t border-[#E8E8E8]">
              <button className="w-full text-left" onClick={() => setAboutExpanded((v) => !v)}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-[#2C3E50]">{aboutLabel}</p>
                  <span className="text-[#888888] text-xs">{aboutExpanded ? "▲" : "▼"}</span>
                </div>
              </button>
              {aboutExpanded && (
                <p className="text-sm text-[#1A1A1A] mt-2" style={{ lineHeight: 1.6 }}>{option.description}</p>
              )}
            </div>
          )}
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[#888888] mb-2">Notes</p>
          <textarea
            className="w-full text-sm text-[#1A1A1A] border border-[#E8E8E8] rounded-[4px] p-3 resize-none focus:outline-none focus:border-[#2C3E50] transition-colors bg-white placeholder-[#888888]"
            rows={2} placeholder="Add notes…" value={notes}
            onChange={(e) => setNotes(e.target.value)} onBlur={() => onNotesChange(notes)}
          />
        </div>

        <button className="text-xs text-[#888888] underline hover:text-[#2C3E50] transition-colors" onClick={handleExitDeepDive}>
          ← Back to results
        </button>
      </div>
    );
  }

  // ── Collapsed card header ─────────────────────────────────────────────────────
  function renderCollapsedHeader(clickable: boolean) {
    return (
      <div
        style={{ display: "flex", gap: 14, padding: "16px 20px", borderBottom: isDetail || expanded ? "1px solid #E8E8E8" : "none", cursor: clickable ? "pointer" : "default", userSelect: "none" }}
        onClick={() => {
          if (!clickable) return;
          const next = !expanded;
          setExpanded(next);
          onExpandedChange?.(next);
          if (next) logEvent({ event: "viyaway_result_expanded", itemId: option.id, fitScore: option.alignmentScore, enneagramType: travelers[0]?.enneagramType ?? "" });
        }}
      >
        {/* Category icon */}
        <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#F5F4F0", border: "1px solid #E8E8E8", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "#2C3E50", marginTop: 2 }}>
          <CategoryIcon category={category} size={13} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Row 1: Property name + Focus Mode expand icon (detail only) */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
            <a
              href={resolvedUrl || undefined}
              target={resolvedUrl ? "_blank" : undefined}
              rel="noopener noreferrer"
              style={{ fontSize: 16, fontWeight: 600, color: "#2C3E50", lineHeight: 1.3, textDecoration: "none", fontFamily: "var(--font-noto-serif), Georgia, ui-serif, serif" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.textDecoration = "underline"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.textDecoration = "none"; }}
              onClick={(e) => {
                e.stopPropagation();
                if (!resolvedUrl) e.preventDefault();
              }}
            >
              {option.name}
            </a>
            {isDetail && (
              <button
                style={{ color: "#888888", background: "none", border: "none", padding: "2px 4px", cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center" }}
                onClick={(e) => { e.stopPropagation(); setOverlayOpen(true); }}
                aria-label="Open focus view"
                title="Focus view"
              >
                <ExpandIcon />
              </button>
            )}
          </div>

          {/* Row 2: Location · Category */}
          {locationRow && (
            <div style={{ fontSize: 12, color: "#888888", marginTop: 3, lineHeight: 1.3 }}>
              {locationRow}
            </div>
          )}

          {/* Row 3: Judgment line — dominant element */}
          {judgmentLine && (
            <div style={{ fontFamily: "var(--font-noto-serif), Georgia, ui-serif, serif", fontSize: 18, fontWeight: 400, color: "#2C3E50", marginTop: 8, lineHeight: 1.4 }}>
              {judgmentLine}
            </div>
          )}

          {/* Row 4: First tradeoff signal — collapsed only */}
          {!expanded && !isDetail && option.tradeoffs.length > 0 && (
            <p style={{ marginTop: 8, fontSize: 13, color: "#8a4530" }} onClick={(e) => e.stopPropagation()}>
              <span style={{ color: "#B5654A" }}>▲</span> {option.tradeoffs[0]}
            </p>
          )}

          {/* Row 5: Footer links — collapsed only */}
          {!expanded && !isDetail && (
            <div style={{ display: "flex", gap: 16, marginTop: 10 }} onClick={(e) => e.stopPropagation()}>
              <button
                style={{ fontSize: 13, color: "#888888", textDecoration: "underline", background: "none", border: "none", padding: 0, cursor: "pointer" }}
                onClick={() => {
                  setExpanded(true);
                  onExpandedChange?.(true);
                  logEvent({ event: "viyaway_result_expanded", itemId: option.id, fitScore: option.alignmentScore, enneagramType: travelers[0]?.enneagramType ?? "" });
                  handleEnterDeepDive();
                }}
              >
                See why →
              </button>
              <button
                style={{ fontSize: 13, color: "#888888", textDecoration: "underline", background: "none", border: "none", padding: 0, cursor: "pointer" }}
                onClick={() => {
                  setExpanded(true);
                  onExpandedChange?.(true);
                  setChatOpen(true);
                  setTimeout(() => chatInputRef.current?.focus(), 100);
                }}
              >
                Ask ViyaWay →
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── List variant ──────────────────────────────────────────────────────────────
  if (isList) {
    return (
      <div
        style={{ display: "flex", gap: 14, padding: "16px 0", borderBottom: "1px solid #E8E8E8", cursor: "pointer", background: selected ? "#F9F8F6" : "transparent" }}
        onClick={() => onSelect?.()}
      >
        <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#F5F4F0", border: "1px solid #E8E8E8", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "#2C3E50", marginTop: 1 }}>
          <CategoryIcon category={category} size={13} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#2C3E50", lineHeight: 1.3, fontFamily: "var(--font-noto-serif), Georgia, ui-serif, serif" }}>{option.name}</div>
          {judgmentLine && (
            <div style={{ fontFamily: "var(--font-noto-serif), Georgia, ui-serif, serif", fontSize: 14, color: "#1A1A1A", marginTop: 3, lineHeight: 1.4, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
              {judgmentLine}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Default + detail variants ─────────────────────────────────────────────────
  return (
    <div ref={cardRef} style={{ border: isDetail ? "1px solid #E8E8E8" : "none", borderBottom: isDetail ? "none" : "1px solid #E8E8E8", borderRadius: isDetail ? 4 : 0, background: "#fff" }}>

      {renderCollapsedHeader(!isDetail)}

      {(isDetail || expanded) && (
        <div className={`px-5 sm:px-8 pb-5 sm:pb-7 border-t border-[#E8E8E8] pt-5 sm:pt-7 ${flipClass}`}>
          {!deepDiveMode ? renderExpandedCardMode(false) : renderDeepDiveMode()}
        </div>
      )}

      {/* Focus-mode overlay — detail variant, desktop only */}
      {isDetail && overlayOpen && createPortal(
        <div
          className="fixed inset-0 z-50 hidden md:flex items-center justify-center"
          style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setOverlayOpen(false); }}
        >
          <div
            className="bg-white border border-[#E8E8E8] rounded-[4px] overflow-hidden flex flex-col"
            style={{ width: "65vw", maxWidth: "900px", height: "82vh", boxShadow: "0 32px 80px rgba(0,0,0,0.25)" }}
          >
            {/* Overlay header */}
            <div className="flex items-start gap-3 px-8 py-6 border-b border-[#E8E8E8] flex-shrink-0">
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <span style={{ fontSize: 16, fontWeight: 600, color: "#2C3E50", fontFamily: "var(--font-noto-serif), Georgia, ui-serif, serif" }}>{option.name}</span>
                  <div className="w-6 h-6 rounded-full bg-[#F5F4F0] border border-[#E8E8E8] flex items-center justify-center flex-shrink-0">
                    <CategoryIcon category={category} size={14} />
                  </div>
                </div>
                {locationRow && (
                  <div className="text-xs text-[#888888] mt-1">{locationRow}</div>
                )}
                <p style={{ fontSize: 20, fontWeight: 400, lineHeight: 1.5, color: "#2C3E50", marginTop: 16, maxWidth: "92%", fontFamily: "var(--font-noto-serif), Georgia, ui-serif, serif" }}>
                  {judgmentLine}
                </p>
              </div>
              <button
                className="text-[#888888] hover:text-[#2C3E50] text-2xl leading-none flex-shrink-0 ml-2 transition-colors"
                onClick={() => setOverlayOpen(false)}
                aria-label="Close focus view"
              >×</button>
            </div>

            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-8 py-6">
              {!deepDiveMode ? renderExpandedCardMode(true) : renderDeepDiveMode()}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
