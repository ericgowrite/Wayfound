"use client";

import { useState, useEffect, useRef } from "react";
import {
  Profile,
  TripWorkspace,
  Search,
  ScoredOption,
  SavedOption,
  SearchCategory,
  PropertyFeedback,
} from "@/types";
import { sortByAlignment, sortByGroupFit, attachTravelerScores } from "@/lib/scoring";
import { CATEGORY_META } from "@/lib/categories";
import {
  analyzeFeedbackCalibration,
  shouldTriggerFeedbackCalibration,
  markFeedbackCalibrationShown,
  logCalibrationEvent,
  CalibrationSuggestion,
} from "@/lib/calibration";
import { getEligiblePrompt, JOURNEY_DISPLAY, journeyDisplayKey } from "@/lib/journey";
import { logEvent } from "@/lib/analytics";
import ResultCard from "./ResultCard";
import ComparisonView from "./ComparisonView";
import CalibrationPrompt from "./CalibrationPrompt";
import JourneyPromptCard from "./JourneyPromptCard";
import UpgradePrompt from "./UpgradePrompt";
import WorkspaceTour from "./WorkspaceTour";
import SearchLoadingScreen from "./SearchLoadingScreen";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { useAuth } from "@/lib/AuthContext";
import { useTourState } from "@/lib/useTourState";

interface AutoSearch {
  workspaceId: string;
  query: string;
  category: SearchCategory;
  intent?: string;
}

interface Props {
  workspace: TripWorkspace;
  travelers: Profile[];
  onChange: (w: TripWorkspace) => void;
  onProfileUpdate: (profile: Profile) => void;
  onOpenProfile?: () => void;
  activeSearchId: string | null;
  onSearchChange: (id: string) => void;
  autoSearch?: AutoSearch;
}

type SortMode = "fit" | "group";

export default function WorkspaceView({ workspace, travelers, onChange, onProfileUpdate, onOpenProfile, activeSearchId, onSearchChange, autoSearch }: Props) {
  const { isAnonymous } = useAuth();
  const primaryProfile = travelers[0];
  const profileWeights = primaryProfile?.axisWeights;

  const [mode, setMode] = useState<"search" | "score">("search");
  const [sortMode, setSortMode] = useState<SortMode>("fit");
  const [query, setQuery] = useState(autoSearch?.query ?? workspace.searches[0]?.query ?? "");
  const [scoreInput, setScoreInput] = useState("");
  const [category, setCategory] = useState<SearchCategory>(autoSearch?.category ?? "accommodation");
  const autoSearchFiredRef = useRef(false);
  const [searching, setSearching] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [loadingItems, setLoadingItems] = useState<import("@/types").LoadingContentItem[]>([]);
  const [loadingContentReady, setLoadingContentReady] = useState(false);
  const [showHandoff, setShowHandoff] = useState(false);
  const [activeTab, setActiveTab] = useState<"search" | "saved" | "history">("search");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedSavedIds, setSelectedSavedIds] = useState<Set<string>>(new Set());
  const [showComparison, setShowComparison] = useState(false);
  const [comparisonOptions, setComparisonOptions] = useState<ScoredOption[]>([]);
  const { isDone: tourDone, markDone: markTourDone } = useTourState("workspace");
  const [showTour, setShowTour] = useState(false);
  const [workspaceNotes, setWorkspaceNotes] = useState(workspace.notes);
  // Keep notes in sync when the workspace prop is refreshed from the server.
  // Computed during render (React's recommended "adjusting state when a prop
  // changes" pattern) rather than in an effect — avoids an extra post-commit
  // render and the react-hooks/set-state-in-effect lint error.
  const [prevWorkspaceNotes, setPrevWorkspaceNotes] = useState(workspace.notes);
  if (workspace.notes !== prevWorkspaceNotes) {
    setPrevWorkspaceNotes(workspace.notes);
    setWorkspaceNotes(workspace.notes);
  }
  const [pendingCalibration, setPendingCalibration] = useState<CalibrationSuggestion[] | null>(null);
  const [calibrationSource, setCalibrationSource] = useState<"saves" | "feedback">("saves");
  const [pendingReject, setPendingReject] = useState<{
    searchId: string;
    optionId: string;
    option: ScoredOption;
  } | null>(null);
  const [showFitCallout, setShowFitCallout] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<SearchCategory | null>(null);
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [selectedSavedCardId, setSelectedSavedCardId] = useState<string | null>(null);
  const [rescoring, setRescoring] = useState(false);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  // true while localStorage not yet read (avoids SSR mismatch); flips to false post-hydration if not dismissed
  const [onboardingPromptDismissed, setOnboardingPromptDismissed] = useState(true);
  const [showCategoryPop, setShowCategoryPop] = useState(false);
  const categoryPopRef = useRef<HTMLDivElement>(null);

  // Auto-start workspace tour on first visit — 600ms delay so the DOM is painted
  useEffect(() => {
    if (tourDone) return;
    const t = setTimeout(() => setShowTour(true), 600);
    return () => clearTimeout(t);
  }, [tourDone]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close category popover on outside click
  useEffect(() => {
    if (!showCategoryPop) return;
    function handleOutside(e: MouseEvent) {
      if (categoryPopRef.current && !categoryPopRef.current.contains(e.target as Node)) {
        setShowCategoryPop(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [showCategoryPop]);

  // Fire the first search when the workspace was just created from the intent screen.
  // The ref guard ensures it fires at most once per WorkspaceView mount.
  useEffect(() => {
    if (!autoSearch || autoSearchFiredRef.current) return;
    autoSearchFiredRef.current = true;
    handleSearch(autoSearch.intent);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleTourDone() {
    setShowTour(false);
    await markTourDone();
  }

  useEffect(() => {
    // localStorage requires browser access — checking it during render would
    // cause an SSR/hydration mismatch, so an effect is the correct tool here
    // despite the lint rule's general preference against setState-in-effect.
    if (
      !showFitCallout &&
      workspace.searches.length > 0 &&
      workspace.searches[0].scoredResults.length > 0 &&
      !localStorage.getItem("hasSeenFitLegend")
    ) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShowFitCallout(true);
    }
  }, [workspace.searches]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    // Read after hydration to avoid SSR mismatch — same pattern as showFitCallout above.
    if (localStorage.getItem("wayfound:onboarding-prompt-dismissed") !== "1") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOnboardingPromptDismissed(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Check feedback-based calibration when saved options with feedback change.
  // Runs after behavioral (save-count) calibration so both don't fire at once.
  useEffect(() => {
    if (!primaryProfile || pendingCalibration || workspace.savedOptions.length === 0) return;
    if (!shouldTriggerFeedbackCalibration(primaryProfile.id, workspace.savedOptions)) return;
    markFeedbackCalibrationShown(primaryProfile.id);
    const suggestions = analyzeFeedbackCalibration(primaryProfile, workspace.savedOptions);
    if (suggestions.length > 0) { setCalibrationSource("feedback"); setPendingCalibration(suggestions); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace.savedOptions]);

  const activeSearch = workspace.searches.find((s) => s.id === activeSearchId) ?? null;

  // Searches sharing the same normalised query as the active search — used for category tabs
  const siblingSearches = activeSearch
    ? workspace.searches.filter(
        (s) => s.query.trim().toLowerCase() === activeSearch.query.trim().toLowerCase()
      )
    : [];
  const showCategoryTabs = siblingSearches.length > 1;

  // If category tabs are showing, the "active search" may be overridden by the tab filter
  const displayedSearch = showCategoryTabs && categoryFilter
    ? siblingSearches.find((s) => s.category === categoryFilter) ?? activeSearch
    : activeSearch;

  const sortedResults = displayedSearch
    ? sortMode === "group" && travelers.length > 1
      ? sortByGroupFit(displayedSearch.scoredResults, travelers)
      : sortByAlignment(displayedSearch.scoredResults)
    : [];

  // Detail panel: explicit selection, or auto-select first result
  const detailCard =
    (selectedCardId ? sortedResults.find((o) => o.id === selectedCardId) : null) ??
    sortedResults[0] ??
    null;

  // Saved tab detail panel
  const detailSavedCard =
    (selectedSavedCardId ? workspace.savedOptions.find((o) => o.id === selectedSavedCardId) : null) ??
    workspace.savedOptions[0] ??
    null;

  async function handleSearch(intentOverride?: string) {
    if (!query.trim()) return;
    setSearching(true);
    setSearchError("");
    setCategoryFilter(null);
    setLoadingItems([]);
    setLoadingContentReady(false);
    setShowHandoff(false);

    // Fire loading content in parallel — never awaited before showing results
    if (workspace.destination) {
      const travelerPayload = travelers.map((t) => ({
        name: t.name,
        type: parseInt(t.enneagramType.replace(/\D/g, ""), 10) || 0,
      }));
      fetchWithAuth("/api/loading-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ destination: workspace.destination, category, travelers: travelerPayload }),
      })
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data.items) && data.items.length > 0) {
            setLoadingItems(data.items);
            setLoadingContentReady(true);
          }
        })
        .catch(() => {}); // fail silently — fallback copy shows instead
    }

    try {
      const res = await fetchWithAuth("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: workspace.id, query, category, ...(intentOverride ? { intent: intentOverride } : {}) }),
      });
      if (!res.ok) {
        const err = await res.json();
        if (err.code === "ANON_LIMIT") { setShowUpgradePrompt(true); return; }
        throw new Error(err.error || "Search failed");
      }
      const search: Search = await res.json();

      // Handoff moment: brief transition before results appear
      setSearching(false);
      setShowHandoff(true);
      setTimeout(() => {
        setShowHandoff(false);
        onChange({
          ...workspace,
          searches: [search, ...workspace.searches.filter((s) => s.id !== search.id)],
        });
        onSearchChange(search.id);
        setActiveTab("search");
      }, 1500);

      logEvent({
        event: "wayfound_search_run",
        query,
        category,
        destination: workspace.destination ?? null,
        resultCount: search.scoredResults?.length ?? 0,
      });
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : String(e));
      setSearching(false);
    }
  }

  async function handleScore() {
    if (!scoreInput.trim()) return;
    setSearching(true);
    setSearchError("");
    try {
      const res = await fetchWithAuth("/api/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: workspace.id, input: scoreInput, category }),
      });
      if (!res.ok) {
        const err = await res.json();
        if (err.code === "ANON_LIMIT") { setShowUpgradePrompt(true); return; }
        throw new Error(err.error || "Scoring failed");
      }
      const search: Search = await res.json();
      onChange({
        ...workspace,
        searches: [search, ...workspace.searches.filter((s) => s.id !== search.id)],
      });
      onSearchChange(search.id);
      setActiveTab("search");
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : String(e));
    } finally {
      setSearching(false);
    }
  }

  async function handleMore() {
    if (!activeSearchId) return;
    setLoadingMore(true);
    setSearchError("");
    // Unsatisfied signal — user asked for more results after seeing these
    if (activeSearch) {
      logEvent({
        event: "wayfound_load_more",
        query: activeSearch.query,
        category: activeSearch.category,
        existingCount: activeSearch.scoredResults.length,
      });
    }
    try {
      const res = await fetchWithAuth("/api/search/more", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: workspace.id, searchId: activeSearchId }),
      });
      if (!res.ok) {
        const err = await res.json();
        if (err.code === "ANON_LIMIT") { setShowUpgradePrompt(true); return; }
        throw new Error(err.error || "Failed to fetch more options");
      }
      const updatedSearch: Search = await res.json();
      onChange({
        ...workspace,
        searches: workspace.searches.map((s) => (s.id === activeSearchId ? updatedSearch : s)),
      });
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingMore(false);
    }
  }

  function fireBehaviorEvent(
    action: import("@/types").BehaviorAction,
    option: ScoredOption,
    reason?: import("@/types").RejectReason
  ) {
    if (isAnonymous || !primaryProfile) return;
    const body = {
      profileId: primaryProfile.id,
      workspaceId: workspace.id,
      action,
      reason: action === "reject" ? (reason ?? "other") : null,
      optionId: option.id,
      optionName: option.name,
      axisScores: option.axisScores,
      fitScore: option.alignmentScore,
    };
    fetchWithAuth("/api/behavior-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => {}); // best-effort — never block the UI
  }

  async function updateWorkspace(updated: TripWorkspace) {
    onChange(updated); // optimistic — UI reflects change instantly
    try {
      const res = await fetchWithAuth(`/api/workspaces/${updated.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const saved = await res.json();
      onChange(saved); // confirmed — server may normalise fields
      return saved;
    } catch (e) {
      console.error("Failed to save workspace:", e);
    }
  }

  function handleSaveOption(option: ScoredOption) {
    const alreadySaved = workspace.savedOptions.some((s) => s.id === option.id);
    const updated: TripWorkspace = alreadySaved
      ? { ...workspace, savedOptions: workspace.savedOptions.filter((s) => s.id !== option.id) }
      : {
          ...workspace,
          savedOptions: [
            ...workspace.savedOptions,
            {
              ...option,
              savedAt: new Date().toISOString(),
              tags: [],
              journeyState: "saved",
            } as SavedOption,
          ],
        };
    updateWorkspace(updated);

    if (!alreadySaved && primaryProfile) {
      logEvent({
        event: "wayfound_item_saved",
        itemId: option.id,
        propertyType: "accommodation",
        fitScore: option.alignmentScore,
        enneagramType: primaryProfile.enneagramType,
      });
      const rank = sortedResults.findIndex((o) => o.id === option.id);
      if (rank >= 0) {
        logEvent({ event: "wayfound_result_saved_rank", itemId: option.id, rank, fitScore: option.alignmentScore });
      }
      fireBehaviorEvent("save", option);
    }
  }

  // Map legacy status values to journeyState for sync
  const STATUS_TO_JOURNEY: Record<string, import("@/types").JourneyState> = {
    interested: "interested",
    booked: "booked",
    rejected: "not_going",
    new: "saved",
  };

  function handleStatusChange(searchId: string, optionId: string, status: ScoredOption["status"]) {
    const optionFromSearch = workspace.searches
      .find((s) => s.id === searchId)
      ?.scoredResults.find((o) => o.id === optionId);

    // Intercept reject — show reason picker before committing.
    if (status === "rejected" && optionFromSearch) {
      setPendingReject({ searchId, optionId, option: optionFromSearch });
      return;
    }

    const journeyState = STATUS_TO_JOURNEY[status] ?? "saved";
    const alreadySaved = workspace.savedOptions.some((o) => o.id === optionId);

    // Interested and Booked are journey-tracked states — auto-save the item
    // so handleJourneyUpdate can find it even if the user never clicked Save.
    let savedOptions = workspace.savedOptions.map((o) =>
      o.id === optionId ? { ...o, status, journeyState } : o
    );
    if (!alreadySaved && optionFromSearch && (status === "interested" || status === "booked")) {
      savedOptions = [
        ...savedOptions,
        { ...optionFromSearch, status, journeyState, savedAt: new Date().toISOString(), tags: [] } as SavedOption,
      ];
      if (primaryProfile) {
        logEvent({
          event: "wayfound_item_saved",
          itemId: optionId,
          propertyType: "accommodation",
          fitScore: optionFromSearch.alignmentScore,
          enneagramType: primaryProfile.enneagramType,
        });
      }
    }

    updateWorkspace({
      ...workspace,
      searches: workspace.searches.map((s) =>
        s.id === searchId
          ? { ...s, scoredResults: s.scoredResults.map((o) => (o.id === optionId ? { ...o, status } : o)) }
          : s
      ),
      savedOptions,
    });

    if (status === "interested" && primaryProfile) {
      logEvent({
        event: "wayfound_item_interested",
        itemId: optionId,
        estimatedTravelWindow: null,
      });
    }
  }

  function handleRejectWithReason(reason: import("@/types").RejectReason) {
    if (!pendingReject) return;
    const { searchId, optionId, option } = pendingReject;
    setPendingReject(null);

    // Apply the actual status change now that we have a reason.
    const alreadySaved = workspace.savedOptions.some((o) => o.id === optionId);
    const savedOptions = workspace.savedOptions.map((o) =>
      o.id === optionId ? { ...o, status: "rejected" as const, journeyState: "not_going" as const } : o
    );

    updateWorkspace({
      ...workspace,
      searches: workspace.searches.map((s) =>
        s.id === searchId
          ? { ...s, scoredResults: s.scoredResults.map((o) => (o.id === optionId ? { ...o, status: "rejected" as const } : o)) }
          : s
      ),
      savedOptions,
    });

    // Fire behavior event — skip if reason isn't "fit" (nudge won't apply, but event is still logged).
    fireBehaviorEvent("reject", option, reason);

    void alreadySaved; // suppress unused warning
  }

  function handleJourneyUpdate(optionId: string, fields: Partial<SavedOption>) {
    updateWorkspace({
      ...workspace,
      savedOptions: workspace.savedOptions.map((o) =>
        o.id === optionId ? { ...o, ...fields } : o
      ),
    });

    // Fire behavior event when journey state reaches a decisive outcome.
    if (fields.journeyState === "booked" || fields.journeyState === "not_going") {
      const option = workspace.savedOptions.find((o) => o.id === optionId);
      if (option) fireBehaviorEvent(fields.journeyState, option);
    }
  }

  function handleJourneyUpdateMultiple(updates: { optionId: string; fields: Partial<SavedOption> }[]) {
    let options = workspace.savedOptions;
    for (const { optionId, fields } of updates) {
      options = options.map((o) => (o.id === optionId ? { ...o, ...fields } : o));
    }
    updateWorkspace({ ...workspace, savedOptions: options });
  }

  function handleNotesChange(searchId: string, optionId: string, notes: string) {
    updateWorkspace({
      ...workspace,
      searches: workspace.searches.map((s) =>
        s.id === searchId
          ? { ...s, scoredResults: s.scoredResults.map((o) => (o.id === optionId ? { ...o, notes } : o)) }
          : s
      ),
      savedOptions: workspace.savedOptions.map((o) => (o.id === optionId ? { ...o, notes } : o)),
    });
  }

  function handleFeedbackSubmit(searchId: string, optionId: string, feedback: PropertyFeedback) {
    updateWorkspace({
      ...workspace,
      searches: workspace.searches.map((s) =>
        s.id === searchId
          ? { ...s, scoredResults: s.scoredResults.map((o) => (o.id === optionId ? { ...o, feedback } : o)) }
          : s
      ),
      savedOptions: workspace.savedOptions.map((o) => (o.id === optionId ? { ...o, feedback } : o)),
    });
  }

  function handleChatUpdate(searchId: string, optionId: string, chatHistory: import("@/types").ChatMessage[]) {
    updateWorkspace({
      ...workspace,
      searches: workspace.searches.map((s) =>
        s.id === searchId
          ? { ...s, scoredResults: s.scoredResults.map((o) => (o.id === optionId ? { ...o, chatHistory } : o)) }
          : s
      ),
      savedOptions: workspace.savedOptions.map((o) => (o.id === optionId ? { ...o, chatHistory } : o)),
    });
  }

  function handleCalibrationAccept(_newWeights: import("@/types").AxisWeights) {
    // Calibration is now a read-only "here's what we've learned" surface.
    // Weights are adjusted passively via the behavior nudge loop — not here.
    if (!primaryProfile || !pendingCalibration) return;
    logCalibrationEvent({
      timestamp: new Date().toISOString(),
      profileId: primaryProfile.id,
      savesCount: 0,
      suggestions: pendingCalibration,
      accepted: true,
      previousWeights: primaryProfile.axisWeights,
      newWeights: null, // no longer written independently
    });
    setPendingCalibration(null);
  }

  function handleCalibrationDismiss() {
    if (!primaryProfile || !pendingCalibration) return;
    logCalibrationEvent({
      timestamp: new Date().toISOString(),
      profileId: primaryProfile.id,
      savesCount: 0,
      suggestions: pendingCalibration,
      accepted: false,
      previousWeights: primaryProfile.axisWeights,
      newWeights: null,
    });
    setPendingCalibration(null);
  }

  // Rescore all existing searches against the current traveler set.
  // Runs client-side (scoring.ts is pure computation) — no round-trip to AI needed.
  async function handleRescore() {
    setRescoring(true);
    const rescored = {
      ...workspace,
      searches: workspace.searches.map((s) => ({
        ...s,
        scoredResults: attachTravelerScores(s.scoredResults, travelers),
      })),
    };
    await updateWorkspace(rescored);
    setRescoring(false);
  }

  // Detect if any search results are missing scores for one or more current travelers.
  const needsRescore =
    travelers.length > 1 &&
    workspace.searches.some((s) =>
      s.scoredResults.some((r) =>
        travelers.some((t) => !r.travelerScores?.[t.id])
      )
    );

  function formatDate(iso: string): string {
    try {
      return new Date(iso + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    } catch { return iso; }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 3) next.add(id);
      return next;
    });
  }

  const selectedOptions = activeSearch?.scoredResults.filter((o) => selectedIds.has(o.id)) ?? [];

  function toggleSavedSelect(id: string) {
    setSelectedSavedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 3) next.add(id);
      return next;
    });
  }

  const selectedSavedOptions = workspace.savedOptions.filter((o) => selectedSavedIds.has(o.id));

  const inputCls =
    "bg-[#EEF4F8] dark:bg-[#2a3f52] text-[#2C3E50] dark:text-[#B8D4E3] border-[#E0E8ED] dark:border-[#3D5A6E] focus:border-[#5B8BA0]";

  return (
    <div className="flex flex-col h-full">
      {/* Anonymous nudge — subtle banner encouraging sign-up */}
      {isAnonymous && (
        <div className="bg-[#5B8BA0]/10 dark:bg-[#5B8BA0]/15 border-b border-[#5B8BA0]/20 px-4 sm:px-6 py-2 flex items-center justify-between gap-3">
          <p className="text-xs text-[#3D5A6E] dark:text-[#9BB0C1]">
            You have 1 free search. <span className="font-medium">Sign in to save your experiences and keep searching.</span>
          </p>
          <button
            className="text-xs font-medium text-[#5B8BA0] dark:text-[#7DBAD4] hover:underline flex-shrink-0"
            onClick={() => setShowUpgradePrompt(true)}
          >
            Sign in →
          </button>
        </div>
      )}

      {/* Workspace header */}
      <div className="bg-white dark:bg-[#1e2d3d] border-b border-[#E0E8ED] dark:border-[#2a3f52] px-4 sm:px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold text-[#2C3E50] dark:text-white truncate">{workspace.name}</h1>
            <p className="text-[#3D5A6E] dark:text-[#9BB0C1] text-sm flex flex-wrap items-center gap-x-2">
              {workspace.destination}
              {workspace.dates?.start && workspace.dates?.end && (
                <span>· {formatDate(workspace.dates.start)} – {formatDate(workspace.dates.end)}</span>
              )}
              {workspace.partySize && workspace.partySize > 0 && (
                <span>· {workspace.partySize} guests</span>
              )}
              {travelers.length > 0 && (
                <span>· {travelers.map((t) => t.name).join(", ")}</span>
              )}
            </p>
          </div>
          {/* Search / Score mode toggle — top right of workspace header */}
          <div className="flex items-center gap-0.5 bg-[#E0E8ED] dark:bg-[#2a3f52] rounded-lg p-0.5 text-xs flex-shrink-0 self-start">
            <button
              className={`px-3 py-1 rounded-md transition-colors ${
                mode === "search"
                  ? "bg-white dark:bg-[#4A7A8F] text-[#2C3E50] dark:text-white shadow font-medium"
                  : "text-[#6B8299] dark:text-[#9BB0C1] hover:text-[#3D5A6E] dark:hover:text-[#B8D4E3]"
              }`}
              onClick={() => setMode("search")}
            >
              🔍 Search
            </button>
            <button
              className={`px-3 py-1 rounded-md transition-colors flex items-center gap-1 ${
                mode === "score"
                  ? "bg-white dark:bg-[#4A7A8F] text-[#2C3E50] dark:text-white shadow font-medium"
                  : "text-[#6B8299] dark:text-[#9BB0C1] hover:text-[#3D5A6E] dark:hover:text-[#B8D4E3]"
              }`}
              onClick={() => setMode("score")}
            >
              ✦ Score
              <span
                className="relative inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border border-current opacity-50 text-[9px] leading-none cursor-default group/info"
                onClick={(e) => e.stopPropagation()}
                onMouseEnter={(e) => e.stopPropagation()}
              >
                i
                <span className="invisible group-hover/info:visible absolute left-1/2 -translate-x-1/2 top-full mt-1.5 z-50 w-48 bg-[#2C3E50] dark:bg-[#1e2d3d] text-white text-[10px] leading-snug font-normal rounded-lg px-2.5 py-2 shadow-lg pointer-events-none opacity-0 group-hover/info:opacity-100 transition-opacity">
                  Paste a name, URL, or description of a specific option and we&apos;ll score it against your traveler profile.
                </span>
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Search bar — category pill on left, input in center, Search button on right */}
      <div className="bg-white dark:bg-[#1e2d3d] border-b border-[#E0E8ED] dark:border-[#2a3f52] px-4 sm:px-6 py-3 space-y-2">
        {mode === "search" ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {/* Category pill dropdown */}
            <div id="tour-category" ref={categoryPopRef} style={{ position: 'relative', flexShrink: 0 }}>
              <button
                onClick={() => setShowCategoryPop((v) => !v)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  border: '1px solid #E8E8E8', borderRadius: 999,
                  padding: '10px 14px', fontSize: 13, fontWeight: 600,
                  color: '#2C3E50', background: '#FAF8F5', cursor: 'pointer',
                  fontFamily: "var(--font-encode), ui-sans-serif, system-ui, sans-serif",
                  whiteSpace: 'nowrap',
                }}
              >
                {CATEGORY_META[category]?.label ?? "Category"}
                <span style={{ fontSize: 9, color: '#888888', marginLeft: 2 }}>▾</span>
              </button>
              {showCategoryPop && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 50,
                  background: '#fff', border: '1px solid #E8E8E8', borderRadius: 10,
                  boxShadow: '0 4px 16px rgba(0,0,0,0.10)', padding: '4px', minWidth: 140,
                }}>
                  {(Object.keys(CATEGORY_META) as Array<keyof typeof CATEGORY_META>).map((cat) => {
                    const meta = CATEGORY_META[cat];
                    const isActive = category === cat;
                    return (
                      <button
                        key={cat}
                        onClick={() => { setCategory(cat); setShowCategoryPop(false); }}
                        style={{
                          display: 'block', width: '100%', textAlign: 'left',
                          padding: '8px 12px', fontSize: 13, borderRadius: 7,
                          border: 'none', cursor: 'pointer',
                          background: isActive ? '#FAF8F5' : 'transparent',
                          color: isActive ? '#2C3E50' : '#555',
                          fontWeight: isActive ? 600 : 400,
                          fontFamily: "var(--font-encode), ui-sans-serif, system-ui, sans-serif",
                        }}
                      >
                        {meta.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Search input */}
            <input
              id="tour-search-input"
              style={{ flex: 1, minWidth: 0, border: '1px solid #2C3E50', borderRadius: 999, padding: '10px 18px', fontSize: 14, color: '#1A1A1A', outline: 'none', fontFamily: "var(--font-encode), ui-sans-serif, system-ui, sans-serif", background: '#fff' }}
              placeholder={`Search ${workspace.destination || "any destination"}…`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
            <button
              style={{ background: '#2C3E50', color: '#fff', borderRadius: 999, padding: '10px 20px', fontSize: 14, fontWeight: 600, border: 'none', cursor: searching || !query.trim() ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', flexShrink: 0, opacity: searching || !query.trim() ? 0.5 : 1 }}
              onClick={() => handleSearch()}
              disabled={searching || !query.trim()}
            >
              {searching ? '…' : 'Search'}
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {/* Category pill dropdown — same as search mode */}
            <div ref={categoryPopRef} style={{ position: 'relative', flexShrink: 0 }}>
              <button
                onClick={() => setShowCategoryPop((v) => !v)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  border: '1px solid #E8E8E8', borderRadius: 999,
                  padding: '10px 14px', fontSize: 13, fontWeight: 600,
                  color: '#2C3E50', background: '#FAF8F5', cursor: 'pointer',
                  fontFamily: "var(--font-encode), ui-sans-serif, system-ui, sans-serif",
                  whiteSpace: 'nowrap',
                }}
              >
                {CATEGORY_META[category]?.label ?? "Category"}
                <span style={{ fontSize: 9, color: '#888888', marginLeft: 2 }}>▾</span>
              </button>
              {showCategoryPop && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 50,
                  background: '#fff', border: '1px solid #E8E8E8', borderRadius: 10,
                  boxShadow: '0 4px 16px rgba(0,0,0,0.10)', padding: '4px', minWidth: 140,
                }}>
                  {(Object.keys(CATEGORY_META) as Array<keyof typeof CATEGORY_META>).map((cat) => {
                    const meta = CATEGORY_META[cat];
                    const isActive = category === cat;
                    return (
                      <button
                        key={cat}
                        onClick={() => { setCategory(cat); setShowCategoryPop(false); }}
                        style={{
                          display: 'block', width: '100%', textAlign: 'left',
                          padding: '8px 12px', fontSize: 13, borderRadius: 7,
                          border: 'none', cursor: 'pointer',
                          background: isActive ? '#FAF8F5' : 'transparent',
                          color: isActive ? '#2C3E50' : '#555',
                          fontWeight: isActive ? 600 : 400,
                          fontFamily: "var(--font-encode), ui-sans-serif, system-ui, sans-serif",
                        }}
                      >
                        {meta.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Score input */}
            <input
              style={{ flex: 1, minWidth: 0, border: '1px solid #2C3E50', borderRadius: 999, padding: '10px 18px', fontSize: 14, color: '#1A1A1A', outline: 'none', fontFamily: "var(--font-encode), ui-sans-serif, system-ui, sans-serif", background: '#fff' }}
              placeholder={`Paste a name, URL, or description — e.g. "Borgo Santo Pietro" or https://…`}
              value={scoreInput}
              onChange={(e) => setScoreInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleScore()}
            />
            <button
              style={{ background: '#2C3E50', color: '#fff', borderRadius: 999, padding: '10px 20px', fontSize: 14, fontWeight: 600, border: 'none', cursor: searching || !scoreInput.trim() ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', flexShrink: 0, opacity: searching || !scoreInput.trim() ? 0.5 : 1 }}
              onClick={handleScore}
              disabled={searching || !scoreInput.trim()}
            >
              {searching ? '…' : 'Score it'}
            </button>
          </div>
        )}

        {searchError && (
          <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-lg px-3 py-2.5">
            <span className="text-amber-500 text-sm mt-px flex-shrink-0">↻</span>
            <div>
              <p className="text-[#3D5A6E] dark:text-[#B8D4E3] text-xs">{searchError}</p>
              <button
                className="text-xs text-[#5B8BA0] dark:text-[#7DBAD4] hover:underline mt-1"
                onClick={() => setSearchError("")}
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Tabs + mode toggle — same row */}
      <div id="tour-tabs" className="flex items-center justify-between border-b border-[#E0E8ED] dark:border-[#2a3f52] bg-white dark:bg-[#1e2d3d] px-4 sm:px-6">
        {/* Left: result tabs */}
        <div className="flex">
          <button
            className={`py-2.5 px-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "search"
                ? "border-[#5B8BA0] text-[#2C3E50] dark:text-white"
                : "border-transparent text-[#3D5A6E] dark:text-[#9BB0C1] hover:text-[#2C3E50] dark:hover:text-[#B8D4E3]"
            }`}
            onClick={() => setActiveTab("search")}
          >
            Results
          </button>
          <button
            className={`py-2.5 px-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "saved"
                ? "border-[#5B8BA0] text-[#2C3E50] dark:text-white"
                : "border-transparent text-[#3D5A6E] dark:text-[#9BB0C1] hover:text-[#2C3E50] dark:hover:text-[#B8D4E3]"
            }`}
            onClick={() => setActiveTab("saved")}
          >
            Saved{workspace.savedOptions.length > 0 ? ` (${workspace.savedOptions.length})` : ""}
          </button>
          <button
            className={`py-2.5 px-4 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "history"
                ? "border-[#5B8BA0] text-[#2C3E50] dark:text-white"
                : "border-transparent text-[#3D5A6E] dark:text-[#9BB0C1] hover:text-[#2C3E50] dark:hover:text-[#B8D4E3]"
            }`}
            onClick={() => setActiveTab("history")}
          >
            History
          </button>
        </div>

        {/* Right: Best Fit / Best for Group — only when 2+ travelers */}
        {travelers.length > 1 && (
          <div className="flex items-center gap-0.5 bg-[#EEF4F8] dark:bg-[#2a3f52] rounded-lg p-0.5 my-1.5 text-xs flex-shrink-0">
            <button
              className={`px-2.5 py-1 rounded-md transition-colors ${
                sortMode === "fit"
                  ? "bg-white dark:bg-[#4A7A8F] text-[#2C3E50] dark:text-white shadow-sm font-medium"
                  : "text-[#6B8299] dark:text-[#9BB0C1] hover:text-[#3D5A6E] dark:hover:text-[#B8D4E3]"
              }`}
              onClick={() => setSortMode("fit")}
            >
              Best Fit
            </button>
            <button
              className={`px-2.5 py-1 rounded-md transition-colors ${
                sortMode === "group"
                  ? "bg-white dark:bg-[#4A7A8F] text-[#2C3E50] dark:text-white shadow-sm font-medium"
                  : "text-[#6B8299] dark:text-[#9BB0C1] hover:text-[#3D5A6E] dark:hover:text-[#B8D4E3]"
              }`}
              onClick={() => setSortMode("group")}
            >
              Best for Group
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {/* ── Results tab ── */}
        {activeTab === "search" && (
          <div id="tour-results" className="flex-1 min-h-0 flex flex-col">
            {/* Non-scrolling header: category tabs, banners, result count */}
            <div className="px-4 pt-4 flex-shrink-0 space-y-3">
            {/* Category tabs — shown when same query searched across multiple categories */}
            {showCategoryTabs && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                {siblingSearches.map((s) => {
                  const meta = CATEGORY_META[s.category] ?? { icon: "🔍", label: s.category, hint: "" };
                  const isActive = (categoryFilter ?? activeSearch?.category) === s.category;
                  return (
                    <button
                      key={s.id}
                      style={{ border: `1px solid ${isActive ? '#2C3E50' : '#E8E8E8'}`, borderRadius: 999, padding: '8px 14px', fontSize: 13, color: isActive ? '#2C3E50' : '#888888', background: '#fff', cursor: 'pointer', fontFamily: "var(--font-encode), ui-sans-serif, system-ui, sans-serif", fontWeight: isActive ? 600 : 400, flexShrink: 0 }}
                      onClick={() => {
                        onSearchChange(s.id);
                        setCategoryFilter(s.category);
                      }}
                    >
                      {meta.label} ({s.scoredResults.length})
                    </button>
                  );
                })}
              </div>
            )}

            {/* Comparison bar */}
            {selectedIds.size === 1 && (
              <div className="mb-4 flex items-center gap-3 bg-[#5B8BA0]/5 dark:bg-[#5B8BA0]/10 border border-[#5B8BA0]/25 dark:border-[#5B8BA0]/40 rounded-xl px-4 py-2.5">
                <span className="text-[#5B8BA0] dark:text-[#7DBAD4] text-sm">
                  1 selected — choose up to 3 to compare
                </span>
                <button
                  className="text-[#6B8299] text-sm hover:text-[#2C3E50] dark:hover:text-white ml-auto transition-colors"
                  onClick={() => setSelectedIds(new Set())}
                >
                  Clear
                </button>
              </div>
            )}
            {selectedIds.size >= 2 && (
              <div className="mb-4 flex items-center gap-3 bg-[#5B8BA0]/8 dark:bg-[#5B8BA0]/15 border border-[#5B8BA0]/40 dark:border-[#5B8BA0] rounded-xl px-4 py-2.5">
                <span className="text-[#5B8BA0] dark:text-[#7DBAD4] text-sm font-medium">
                  {selectedIds.size} selected
                </span>
                <button
                  className="px-3 py-1 bg-[#5B8BA0] text-white text-sm rounded-lg hover:bg-[#4A7A8F] transition-colors"
                  onClick={() => { setComparisonOptions(selectedOptions); setShowComparison(true); logEvent({ event: "wayfound_comparison_opened", itemCount: selectedOptions.length }); }}
                >
                  Compare →
                </button>
                <button
                  className="text-[#6B8299] text-sm hover:text-[#2C3E50] dark:hover:text-white ml-auto transition-colors"
                  onClick={() => setSelectedIds(new Set())}
                >
                  Clear
                </button>
              </div>
            )}

            </div>{/* end header */}

            {/* Scrollable content area */}
            <div className="flex-1 min-h-0 flex flex-col px-4 pb-4">

            {/* Searching / handoff state */}
            {(searching || showHandoff) && mode === "search" && (
              <SearchLoadingScreen
                phase={showHandoff ? "handoff" : "searching"}
                destination={workspace.destination ?? ""}
                travelers={travelers}
                items={loadingItems}
                contentReady={loadingContentReady}
              />
            )}
            {searching && mode === "score" && (
              <div className="flex-1 flex flex-col items-center justify-center py-16">
                <div className="text-5xl mb-4 animate-pulse">✦</div>
                <p className="text-[#3D5A6E] dark:text-[#B8D4E3] font-medium">Researching and scoring…</p>
                <p className="text-sm text-[#6B8299] mt-1">This may take 15–30 seconds</p>
              </div>
            )}

            {/* First-time fit score callout */}
            {showFitCallout && !searching && sortedResults.length > 0 && (
              <div className="mb-3 flex items-start gap-3 bg-[#5B8BA0]/8 dark:bg-[#5B8BA0]/15 border border-[#5B8BA0]/30 dark:border-[#5B8BA0]/50 rounded-xl px-4 py-3">
                <span className="text-[#5B8BA0] text-lg flex-shrink-0">💡</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#3D5A6E] dark:text-[#B8D4E3] mb-0.5">About fit scores</p>
                  <p className="text-xs text-[#5B8BA0] dark:text-[#7DBAD4] leading-relaxed">
                    Each score shows how well an option matches your profile. <span className="font-medium text-green-600 dark:text-green-400">Green (80%+)</span> is a strong fit,{" "}
                    <span className="font-medium text-yellow-600 dark:text-yellow-400">yellow (65–79%)</span> has tradeoffs,{" "}
                    <span className="font-medium text-orange-600 dark:text-orange-400">orange (50–64%)</span> is marginal,{" "}
                    <span className="font-medium text-red-600 dark:text-red-400">red (&lt;50%)</span> is a poor fit. Hover any score to see the guide.
                  </p>
                </div>
                <button
                  className="text-xs text-[#5B8BA0] dark:text-[#7DBAD4] hover:text-[#3D5A6E] dark:hover:text-[#B8D4E3] font-medium flex-shrink-0 transition-colors"
                  onClick={() => {
                    localStorage.setItem("hasSeenFitLegend", "1");
                    setShowFitCallout(false);
                  }}
                >
                  Got it
                </button>
              </div>
            )}

            {/* Rescore banner — shown when results predate a traveler being added */}
            {!searching && needsRescore && (
              <div className="mb-3 flex items-center gap-3 bg-violet-50 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-800/40 rounded-xl px-4 py-2.5">
                <span className="text-violet-500 text-sm flex-shrink-0">👥</span>
                <p className="text-xs text-[#3D5A6E] dark:text-[#B8D4E3] flex-1">
                  Some results were scored before all travelers were added. Rescore to see how options fit everyone.
                </p>
                <button
                  className="text-xs px-3 py-1 bg-violet-600 text-white rounded-lg hover:bg-violet-500 transition-colors disabled:opacity-50 whitespace-nowrap"
                  onClick={handleRescore}
                  disabled={rescoring}
                >
                  {rescoring ? "Rescoring…" : `Rescore for ${travelers.map((t) => t.name).join(" & ")} →`}
                </button>
              </div>
            )}

            {/* Results */}
            {!searching && sortedResults.length > 0 && (
              <div id="tour-fit-score" className="flex-1 min-h-0 flex flex-col">

                {/* Mobile: stacked expandable cards */}
                <div className="lg:hidden overflow-y-auto flex-1 pb-4">
                  {sortedResults.map((option) => (
                    <ResultCard
                      key={option.id}
                      option={option}
                      workspace={workspace}
                      travelers={travelers}
                      profileWeights={profileWeights}
                      isSelected={selectedIds.has(option.id)}
                      category={displayedSearch!.category}
                      searchQuery={displayedSearch!.query}
                      onToggleSelect={() => toggleSelect(option.id)}
                      onSave={() => handleSaveOption(option)}
                      onStatusChange={(s) => handleStatusChange(displayedSearch!.id, option.id, s)}
                      onNotesChange={(n) => handleNotesChange(displayedSearch!.id, option.id, n)}
                      onChatUpdate={(msgs) => handleChatUpdate(displayedSearch!.id, option.id, msgs)}
                      onDeepDive={() => {}}
                      onFeedbackSubmit={(fb) => handleFeedbackSubmit(displayedSearch!.id, option.id, fb)}
                    />
                  ))}
                  <div className="pt-2 pb-4 flex justify-center">
                    {loadingMore ? (
                      <div className="text-center text-[#6B8299]">
                        <div className="text-2xl mb-1 animate-spin">⟳</div>
                        <p className="text-sm">Finding more options…</p>
                      </div>
                    ) : (
                      <button
                        className="flex items-center gap-2 px-5 py-3 rounded-full bg-[#5B8BA0] text-white hover:bg-[#4A7A8F] transition-colors text-sm font-medium shadow-sm"
                        onClick={handleMore}
                      >
                        <span>Find more options</span>
                        <span>→</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Desktop: master-detail — each panel scrolls independently */}
                <div className="hidden lg:flex gap-4 flex-1 min-h-0">
                  {/* Left: scrollable compact list */}
                  <div className="w-72 xl:w-80 flex-shrink-0 overflow-y-auto pb-4">
                    {sortedResults.map((option) => (
                      <ResultCard
                        key={option.id}
                        option={option}
                        workspace={workspace}
                        travelers={travelers}
                        profileWeights={profileWeights}
                        isSelected={selectedIds.has(option.id)}
                        category={displayedSearch!.category}
                        searchQuery={displayedSearch!.query}
                        variant="list"
                        selected={detailCard?.id === option.id}
                        onSelect={() => setSelectedCardId(option.id)}
                        onToggleSelect={() => toggleSelect(option.id)}
                        onSave={() => handleSaveOption(option)}
                        onStatusChange={(s) => handleStatusChange(displayedSearch!.id, option.id, s)}
                        onNotesChange={(n) => handleNotesChange(displayedSearch!.id, option.id, n)}
                        onChatUpdate={(msgs) => handleChatUpdate(displayedSearch!.id, option.id, msgs)}
                        onDeepDive={() => {}}
                        onFeedbackSubmit={(fb) => handleFeedbackSubmit(displayedSearch!.id, option.id, fb)}
                      />
                    ))}
                    <div className="pt-2 pb-4 flex justify-center">
                      {loadingMore ? (
                        <div className="text-center text-[#6B8299]">
                          <div className="text-2xl mb-1 animate-spin">⟳</div>
                          <p className="text-sm">Finding more…</p>
                        </div>
                      ) : (
                        <button
                          className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#5B8BA0] text-white hover:bg-[#4A7A8F] transition-colors text-sm font-medium shadow-sm"
                          onClick={handleMore}
                        >
                          <span>Find more</span>
                          <span>→</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Right: independently scrollable detail panel */}
                  <div className="flex-1 overflow-y-auto pb-4">
                    {detailCard && (
                      <ResultCard
                        key={detailCard.id}
                        option={detailCard}
                        workspace={workspace}
                        travelers={travelers}
                        profileWeights={profileWeights}
                        isSelected={selectedIds.has(detailCard.id)}
                        category={displayedSearch!.category}
                        searchQuery={displayedSearch!.query}
                        variant="detail"
                        onToggleSelect={() => toggleSelect(detailCard.id)}
                        onSave={() => handleSaveOption(detailCard)}
                        onStatusChange={(s) => handleStatusChange(displayedSearch!.id, detailCard.id, s)}
                        onNotesChange={(n) => handleNotesChange(displayedSearch!.id, detailCard.id, n)}
                        onChatUpdate={(msgs) => handleChatUpdate(displayedSearch!.id, detailCard.id, msgs)}
                        onDeepDive={() => {}}
                        onFeedbackSubmit={(fb) => handleFeedbackSubmit(displayedSearch!.id, detailCard.id, fb)}
                      />
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Empty state */}
            {!searching && sortedResults.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center py-16">
                {workspace.searches.length > 0 ? (
                  <>
                    <p style={{ fontFamily: 'var(--font-noto-serif), Georgia, ui-serif, serif', fontSize: 19, fontWeight: 500, color: '#2C3E50', textAlign: 'center' }}>
                      Nothing quite fits that yet.
                    </p>
                    <p style={{ fontSize: 13, color: '#888888', marginTop: 8, textAlign: 'center' }}>
                      Try a different search or adjust your filters.
                    </p>
                  </>
                ) : (
                  <>
                    <p style={{ fontFamily: 'var(--font-noto-serif), Georgia, ui-serif, serif', fontSize: 19, fontWeight: 500, color: '#2C3E50', textAlign: 'center' }}>
                      {workspace.destination
                        ? `What are you looking for in ${workspace.destination}?`
                        : "What are you looking for?"}
                    </p>
                    <p style={{ fontSize: 13, color: '#888888', marginTop: 8, textAlign: 'center' }}>
                      Try &quot;boutique eco resort&quot; or &quot;rooftop restaurant with a view&quot;
                    </p>
                  </>
                )}
              </div>
            )}

            </div>{/* end content area */}
          </div>
        )}

        {/* ── Saved tab ── */}
        {activeTab === "saved" && (
          <div className="flex-1 min-h-0 flex flex-col">
            {/* Journey prompt card — non-scrolling header */}
            {workspace.savedOptions.length > 0 && primaryProfile && (
              <div className="px-4 pt-4 flex-shrink-0">
                <JourneyPromptCard
                  prompt={getEligiblePrompt(workspace.savedOptions)}
                  savedOptions={workspace.savedOptions}
                  primaryEnneagramType={primaryProfile.enneagramType}
                  destination={workspace.destination}
                  onUpdate={handleJourneyUpdate}
                  onUpdateMultiple={handleJourneyUpdateMultiple}
                />
              </div>
            )}

            {/* Comparison bar */}
            {selectedSavedIds.size === 1 && (
              <div className="px-4 pb-2 flex-shrink-0">
                <div className="flex items-center gap-3 bg-[#5B8BA0]/5 dark:bg-[#5B8BA0]/10 border border-[#5B8BA0]/25 dark:border-[#5B8BA0]/40 rounded-xl px-4 py-2.5">
                  <span className="text-[#5B8BA0] dark:text-[#7DBAD4] text-sm">
                    1 selected — choose up to 3 to compare
                  </span>
                  <button
                    className="text-[#6B8299] text-sm hover:text-[#2C3E50] dark:hover:text-white ml-auto transition-colors"
                    onClick={() => setSelectedSavedIds(new Set())}
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}
            {selectedSavedIds.size >= 2 && (
              <div className="px-4 pb-2 flex-shrink-0">
                <div className="flex items-center gap-3 bg-[#5B8BA0]/8 dark:bg-[#5B8BA0]/15 border border-[#5B8BA0]/40 dark:border-[#5B8BA0] rounded-xl px-4 py-2.5">
                  <span className="text-[#5B8BA0] dark:text-[#7DBAD4] text-sm font-medium">
                    {selectedSavedIds.size} selected
                  </span>
                  <button
                    className="px-3 py-1 bg-[#5B8BA0] text-white text-sm rounded-lg hover:bg-[#4A7A8F] transition-colors"
                    onClick={() => { setComparisonOptions(selectedSavedOptions); setShowComparison(true); logEvent({ event: "wayfound_comparison_opened", itemCount: selectedSavedOptions.length }); }}
                  >
                    Compare →
                  </button>
                  <button
                    className="text-[#6B8299] text-sm hover:text-[#2C3E50] dark:hover:text-white ml-auto transition-colors"
                    onClick={() => setSelectedSavedIds(new Set())}
                  >
                    Clear
                  </button>
                </div>
              </div>
            )}

            {/* Empty state */}
            {workspace.savedOptions.length === 0 && (
              <div className="flex flex-col items-center justify-center min-h-[65vh] px-6">
                <div className="text-6xl mb-4">📋</div>
                <p className="text-lg font-medium text-[#3D5A6E] dark:text-[#B8D4E3]">No saved options yet</p>
                <p className="text-sm text-[#6B8299] mt-1">Save results from your searches to compare later</p>

                {/* Post-search calibration prompt — one-time, only after 2+ searches with nothing saved */}
                {!onboardingPromptDismissed && workspace.searches.length >= 2 && (
                  <div className="mt-8 max-w-xs text-center">
                    <p className="text-sm font-medium text-[#3D5A6E] dark:text-[#B8D4E3]">Not quite finding what fits?</p>
                    <p className="text-sm text-[#6B8299] dark:text-[#9BB0C1] mt-1.5 leading-relaxed">
                      Wayfound's results are only as good as what it knows about you.
                      If something feels off, updating your travel style takes 2 minutes.
                    </p>
                    <button
                      className="mt-3 text-sm text-[#5B8BA0] dark:text-[#7DBAD4] hover:underline font-medium"
                      onClick={() => {
                        setOnboardingPromptDismissed(true);
                        localStorage.setItem("wayfound:onboarding-prompt-dismissed", "1");
                        onOpenProfile?.();
                      }}
                    >
                      Update your travel style →
                    </button>
                    <button
                      className="mt-2 block mx-auto text-xs text-[#9BB0C1] dark:text-[#6B8299] hover:text-[#6B8299] dark:hover:text-[#9BB0C1] transition-colors"
                      onClick={() => {
                        setOnboardingPromptDismissed(true);
                        localStorage.setItem("wayfound:onboarding-prompt-dismissed", "1");
                      }}
                    >
                      Dismiss
                    </button>
                  </div>
                )}
              </div>
            )}

            {workspace.savedOptions.length > 0 && (
              <>
                {/* Mobile: stacked expandable cards */}
                <div className="lg:hidden flex-1 overflow-y-auto p-4 space-y-3">
                  {workspace.savedOptions.map((option) => {
                    const sourceSearch = workspace.searches.find((s) => s.id === option.searchId);
                    return (
                      <ResultCard
                        key={option.id}
                        option={option}
                        workspace={workspace}
                        travelers={travelers}
                        profileWeights={profileWeights}
                        isSelected={selectedSavedIds.has(option.id)}
                        category={sourceSearch?.category}
                        searchQuery={sourceSearch?.query}
                        onToggleSelect={() => toggleSavedSelect(option.id)}
                        onSave={() => handleSaveOption(option)}
                        onStatusChange={(s) => handleStatusChange(option.searchId, option.id, s)}
                        onNotesChange={(n) => handleNotesChange(option.searchId, option.id, n)}
                        onChatUpdate={(msgs) => handleChatUpdate(option.searchId, option.id, msgs)}
                        onDeepDive={() => {}}
                        onFeedbackSubmit={(fb) => handleFeedbackSubmit(option.searchId, option.id, fb)}
                      />
                    );
                  })}
                  <div className="mt-6">
                    <p className="text-[#6B8299] text-xs uppercase tracking-wide mb-2">Experience Notes</p>
                    <textarea
                      className={`w-full ${inputCls} text-sm rounded-lg border p-3 resize-none focus:outline-none transition-colors`}
                      rows={4}
                      placeholder="Notes about this experience…"
                      value={workspaceNotes}
                      onChange={(e) => setWorkspaceNotes(e.target.value)}
                      onBlur={() => updateWorkspace({ ...workspace, notes: workspaceNotes })}
                    />
                  </div>
                </div>

                {/* Desktop: master-detail */}
                <div className="hidden lg:flex gap-4 flex-1 min-h-0 px-4 pt-4 pb-4">
                  {/* Left: compact list + trip notes */}
                  <div className="w-72 xl:w-80 flex-shrink-0 overflow-y-auto space-y-2 pb-4">
                    {workspace.savedOptions.map((option) => {
                      const sourceSearch = workspace.searches.find((s) => s.id === option.searchId);
                      return (
                        <ResultCard
                          key={option.id}
                          option={option}
                          workspace={workspace}
                          travelers={travelers}
                          profileWeights={profileWeights}
                          isSelected={selectedSavedIds.has(option.id)}
                          category={sourceSearch?.category}
                          searchQuery={sourceSearch?.query}
                          variant="list"
                          selected={detailSavedCard?.id === option.id}
                          onSelect={() => setSelectedSavedCardId(option.id)}
                          onToggleSelect={() => toggleSavedSelect(option.id)}
                          onSave={() => handleSaveOption(option)}
                          onStatusChange={(s) => handleStatusChange(option.searchId, option.id, s)}
                          onNotesChange={(n) => handleNotesChange(option.searchId, option.id, n)}
                          onChatUpdate={(msgs) => handleChatUpdate(option.searchId, option.id, msgs)}
                          onDeepDive={() => {}}
                          onFeedbackSubmit={(fb) => handleFeedbackSubmit(option.searchId, option.id, fb)}
                        />
                      );
                    })}
                    <div className="pt-4">
                      <p className="text-[#6B8299] text-xs uppercase tracking-wide mb-2">Experience Notes</p>
                      <textarea
                        className={`w-full ${inputCls} text-sm rounded-lg border p-3 resize-none focus:outline-none transition-colors`}
                        rows={4}
                        placeholder="Notes about this experience…"
                        value={workspaceNotes}
                        onChange={(e) => setWorkspaceNotes(e.target.value)}
                        onBlur={() => updateWorkspace({ ...workspace, notes: workspaceNotes })}
                      />
                    </div>
                  </div>

                  {/* Right: detail panel */}
                  <div className="flex-1 overflow-y-auto pb-4">
                    {detailSavedCard && (() => {
                      const sourceSearch = workspace.searches.find((s) => s.id === detailSavedCard.searchId);
                      return (
                        <ResultCard
                          key={detailSavedCard.id}
                          option={detailSavedCard}
                          workspace={workspace}
                          travelers={travelers}
                          profileWeights={profileWeights}
                          isSelected={false}
                          category={sourceSearch?.category}
                          searchQuery={sourceSearch?.query}
                          variant="detail"
                          onToggleSelect={() => {}}
                          onSave={() => handleSaveOption(detailSavedCard)}
                          onStatusChange={(s) => handleStatusChange(detailSavedCard.searchId, detailSavedCard.id, s)}
                          onNotesChange={(n) => handleNotesChange(detailSavedCard.searchId, detailSavedCard.id, n)}
                          onChatUpdate={(msgs) => handleChatUpdate(detailSavedCard.searchId, detailSavedCard.id, msgs)}
                          onDeepDive={() => {}}
                          onFeedbackSubmit={(fb) => handleFeedbackSubmit(detailSavedCard.searchId, detailSavedCard.id, fb)}
                        />
                      );
                    })()}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── History tab ── */}
        {activeTab === "history" && (
          <div className="flex-1 overflow-y-auto p-4">
            {(() => {
              const confirmed = workspace.savedOptions.filter(
                (o) => o.journeyState === "fit_confirmed"
              );
              const goodOrPerfect = confirmed.filter(
                (o) => o.fitOutcome === "perfect" || o.fitOutcome === "good"
              );
              const sorted = [...workspace.savedOptions].sort((a, b) => {
                const dateA =
                  a.fitConfirmedAt ?? a.bookedAt ?? a.savedAt;
                const dateB =
                  b.fitConfirmedAt ?? b.bookedAt ?? b.savedAt;
                return new Date(dateB).getTime() - new Date(dateA).getTime();
              });

              return (
                <>
                  {/* Accuracy summary card — only when at least one confirmation exists */}
                  {confirmed.length > 0 && (
                    <div className="mb-4 bg-gradient-to-r from-[#5B8BA0]/10 to-[#5B8BA0]/5 dark:from-[#5B8BA0]/20 dark:to-[#5B8BA0]/10 border border-[#5B8BA0]/30 dark:border-[#5B8BA0]/40 rounded-xl px-4 py-3">
                      <p className="text-sm font-semibold text-[#2C3E50] dark:text-white">
                        Wayfound got it right {goodOrPerfect.length} out of {confirmed.length} time{confirmed.length !== 1 ? "s" : ""}.
                      </p>
                      {confirmed.length >= 2 && (
                        <p className="text-xs text-[#6B8299] dark:text-[#9BB0C1] mt-0.5">
                          {Math.round((goodOrPerfect.length / confirmed.length) * 100)}% accuracy on this experience
                        </p>
                      )}
                    </div>
                  )}

                  {sorted.length === 0 ? (
                    <div className="flex flex-col items-center justify-center min-h-[65vh]">
                      <div className="text-6xl mb-4">🗓️</div>
                      <p className="text-lg font-medium text-[#3D5A6E] dark:text-[#B8D4E3]">No history yet</p>
                      <p className="text-sm text-[#6B8299] mt-1">Save options from your searches to start tracking your journey</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {sorted.map((opt) => {
                        const key = journeyDisplayKey(opt);
                        const display = JOURNEY_DISPLAY[key] ?? JOURNEY_DISPLAY.saved;
                        const isNotGoing = opt.journeyState === "not_going";
                        return (
                          <div
                            key={opt.id}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors ${
                              isNotGoing
                                ? "border-[#E0E8ED] dark:border-[#2a3f52] bg-[#F8FAFB] dark:bg-[#0f1923] opacity-50"
                                : "border-[#E0E8ED] dark:border-[#2a3f52] bg-white dark:bg-[#1e2d3d]"
                            }`}
                          >
                            <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${display.dot}`} />
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-medium truncate ${isNotGoing ? "line-through text-[#9BB0C1] dark:text-[#6B8299]" : "text-[#2C3E50] dark:text-white"}`}>
                                {opt.name}
                              </p>
                              <p className="text-xs text-[#9BB0C1] dark:text-[#6B8299] truncate">
                                {opt.alignmentScore}% fit
                                {workspace.destination ? ` · ${workspace.destination}` : ""}
                              </p>
                            </div>
                            <div className="flex-shrink-0 text-right">
                              {opt.journeyState === "unresolved" ? (
                                <button
                                  className="text-xs text-[#5B8BA0] dark:text-[#7DBAD4] hover:underline"
                                  onClick={() =>
                                    handleJourneyUpdate(opt.id, {
                                      journeyState: "booked",
                                      promptDismissCount: 0,
                                      promptDismissedAt: undefined,
                                    })
                                  }
                                >
                                  Did you go?
                                </button>
                              ) : (
                                <span className={`text-xs font-medium ${display.textColor}`}>
                                  {display.label}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}
      </div>

      {showComparison && comparisonOptions.length >= 2 && (
        <ComparisonView
          options={comparisonOptions}
          travelers={travelers}
          workspaceId={workspace.id}
          onClose={() => setShowComparison(false)}
        />
      )}

      {pendingCalibration && primaryProfile && (
        <CalibrationPrompt
          profile={primaryProfile}
          suggestions={pendingCalibration}
          savesCount={pendingCalibration.length}
          sourceDescription={
            calibrationSource === "feedback"
              ? "Based on your feedback, I noticed:"
              : undefined
          }
          onAccept={handleCalibrationAccept}
          onDismiss={handleCalibrationDismiss}
        />
      )}

      {showUpgradePrompt && (
        <UpgradePrompt onClose={() => setShowUpgradePrompt(false)} />
      )}

      {showTour && <WorkspaceTour onDone={handleTourDone} />}

      {/* Reject reason picker — inline chip overlay, appears before reject commits */}
      {pendingReject && (
        <div className="fixed inset-0 z-50 flex items-end justify-center pb-8 px-4 pointer-events-none">
          <div
            className="pointer-events-auto w-full max-w-sm bg-white border border-[#E8E8E8] rounded-2xl shadow-xl p-5"
            style={{ background: "var(--color-canvas, #FAF8F5)" }}
          >
            <p className="text-sm font-semibold text-[#2C3E50] mb-1">
              Why are you passing on <span className="font-bold">{pendingReject.option.name}</span>?
            </p>
            <p className="text-xs text-[#888888] mb-4">Helps us improve future recommendations</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {(["fit", "price", "dates", "other"] as import("@/types").RejectReason[]).map((r) => (
                <button
                  key={r}
                  onClick={() => handleRejectWithReason(r)}
                  className="px-4 py-2 text-sm font-medium rounded-full border border-[#E8E8E8] text-[#2C3E50] hover:bg-[#2C3E50] hover:text-white hover:border-[#2C3E50] transition-colors"
                >
                  {r === "fit" ? "Not the right fit" : r === "price" ? "Price" : r === "dates" ? "Dates don't work" : "Something else"}
                </button>
              ))}
            </div>
            <button
              onClick={() => setPendingReject(null)}
              className="text-xs text-[#888888] hover:text-[#2C3E50] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
