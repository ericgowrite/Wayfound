"use client";

import { useState, useEffect } from "react";
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
import CategorySelect from "@/components/CategorySelect";
import {
  trackSave,
  trackReject,
  shouldTriggerCalibration,
  markCalibrationShown,
  analyzeCalibration,
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
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { useAuth } from "@/lib/AuthContext";

interface Props {
  workspace: TripWorkspace;
  travelers: Profile[];
  onChange: (w: TripWorkspace) => void;
  onProfileUpdate: (profile: Profile) => void;
}

type SortMode = "fit" | "group";

export default function WorkspaceView({ workspace, travelers, onChange, onProfileUpdate }: Props) {
  const { isAnonymous } = useAuth();
  const primaryProfile = travelers[0];
  const profileWeights = primaryProfile?.axisWeights;

  const [mode, setMode] = useState<"search" | "score">("search");
  const [sortMode, setSortMode] = useState<SortMode>("fit");
  const [query, setQuery] = useState(workspace.searches[0]?.query ?? "");
  const [scoreInput, setScoreInput] = useState("");
  const [category, setCategory] = useState<SearchCategory>("accommodation");
  const [searching, setSearching] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [activeTab, setActiveTab] = useState<"search" | "saved" | "history">("search");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showComparison, setShowComparison] = useState(false);
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
  const [activeSearchId, setActiveSearchId] = useState<string | null>(
    workspace.searches[0]?.id ?? null
  );
  const [pendingCalibration, setPendingCalibration] = useState<CalibrationSuggestion[] | null>(null);
  const [showFitCallout, setShowFitCallout] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<SearchCategory | null>(null);
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [selectedSavedCardId, setSelectedSavedCardId] = useState<string | null>(null);
  const [rescoring, setRescoring] = useState(false);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);

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

  async function handleSearch() {
    if (!query.trim()) return;
    setSearching(true);
    setSearchError("");
    setCategoryFilter(null);
    try {
      const res = await fetchWithAuth("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: workspace.id, query, category }),
      });
      if (!res.ok) {
        const err = await res.json();
        if (err.code === "ANON_LIMIT") { setShowUpgradePrompt(true); return; }
        throw new Error(err.error || "Search failed");
      }
      const search: Search = await res.json();
      onChange({
        ...workspace,
        searches: [search, ...workspace.searches.filter((s) => s.id !== search.id)],
      });
      setActiveSearchId(search.id);
      setActiveTab("search");
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : String(e));
    } finally {
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
      setActiveSearchId(search.id);
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
        event: "viyaway_item_saved",
        itemId: option.id,
        propertyType: "accommodation",
        fitScore: option.alignmentScore,
        enneagramType: primaryProfile.enneagramType,
      });
      trackSave(option, primaryProfile.id);
      if (shouldTriggerCalibration(primaryProfile.id)) {
        markCalibrationShown(primaryProfile.id);
        const suggestions = analyzeCalibration(primaryProfile);
        if (suggestions.length > 0) setPendingCalibration(suggestions);
      }
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
    const journeyState = STATUS_TO_JOURNEY[status] ?? "saved";

    const optionFromSearch = workspace.searches
      .find((s) => s.id === searchId)
      ?.scoredResults.find((o) => o.id === optionId);
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
          event: "viyaway_item_saved",
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
        event: "viyaway_item_interested",
        itemId: optionId,
        estimatedTravelWindow: null,
      });
    }
    if (status === "rejected" && primaryProfile) {
      const option = optionFromSearch ?? workspace.savedOptions.find((o) => o.id === optionId);
      if (option) trackReject(option, primaryProfile.id);
    }
  }

  function handleJourneyUpdate(optionId: string, fields: Partial<SavedOption>) {
    updateWorkspace({
      ...workspace,
      savedOptions: workspace.savedOptions.map((o) =>
        o.id === optionId ? { ...o, ...fields } : o
      ),
    });
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

  async function handleCalibrationAccept(newWeights: import("@/types").AxisWeights) {
    if (!primaryProfile || !pendingCalibration) return;
    try {
      const res = await fetchWithAuth(`/api/profiles/${primaryProfile.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...primaryProfile, axisWeights: newWeights }),
      });
      if (!res.ok) {
        console.error("[calibration] profile save failed:", res.status, await res.text());
        setPendingCalibration(null);
        return;
      }
      const saved = await res.json();
      logCalibrationEvent({
        timestamp: new Date().toISOString(),
        profileId: primaryProfile.id,
        savesCount: 0,
        suggestions: pendingCalibration,
        accepted: true,
        previousWeights: primaryProfile.axisWeights,
        newWeights,
      });
      onProfileUpdate(saved);
    } catch (e) {
      console.error("[calibration] network error:", e);
    } finally {
      setPendingCalibration(null);
    }
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

  const inputCls =
    "bg-[#EEF4F8] dark:bg-[#2a3f52] text-[#2C3E50] dark:text-[#B8D4E3] border-[#E0E8ED] dark:border-[#3D5A6E] focus:border-[#5B8BA0]";

  return (
    <div className="flex flex-col h-full">
      {/* Anonymous nudge — subtle banner encouraging sign-up */}
      {isAnonymous && (
        <div className="bg-[#5B8BA0]/10 dark:bg-[#5B8BA0]/15 border-b border-[#5B8BA0]/20 px-4 sm:px-6 py-2 flex items-center justify-between gap-3">
          <p className="text-xs text-[#3D5A6E] dark:text-[#9BB0C1]">
            You have 2 free searches. <span className="font-medium">Sign in to save your trips and keep searching.</span>
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
            <p className="text-[#6B8299] dark:text-[#9BB0C1] text-sm flex flex-wrap items-center gap-x-2">
              {workspace.destination}
              {workspace.dates?.start && workspace.dates?.end && (
                <span className="text-[#9BB0C1] dark:text-[#6B8299]">
                  · {formatDate(workspace.dates.start)} – {formatDate(workspace.dates.end)}
                </span>
              )}
              {workspace.partySize && workspace.partySize > 0 && (
                <span className="text-[#9BB0C1] dark:text-[#6B8299]">· {workspace.partySize} guests</span>
              )}
              {travelers.length > 0 && (
                <span className="text-[#9BB0C1] dark:text-[#6B8299]">
                  · {travelers.map((t) => t.name).join(", ")}
                </span>
              )}
            </p>
          </div>
          {/* Group sort toggle — only visible when 2+ travelers */}
          {travelers.length > 1 && (
            <div className="flex items-center gap-0.5 bg-[#EEF4F8] dark:bg-[#2a3f52] rounded-lg p-0.5 text-xs flex-shrink-0 self-start">
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
      </div>

      {/* Search / Score bar */}
      <div className="bg-white dark:bg-[#1e2d3d] border-b border-[#E0E8ED] dark:border-[#2a3f52] px-4 sm:px-6 py-3 space-y-2">
        {/* Mode toggle */}
        <div className="flex items-center gap-0.5 bg-[#E0E8ED] dark:bg-[#2a3f52] rounded-lg p-0.5 w-fit">
          <button
            className={`px-3 py-1 text-xs rounded-md transition-colors ${
              mode === "search"
                ? "bg-white dark:bg-[#4A7A8F] text-[#2C3E50] dark:text-white shadow font-medium"
                : "text-[#6B8299] dark:text-[#9BB0C1] hover:text-[#3D5A6E] dark:hover:text-[#B8D4E3]"
            }`}
            onClick={() => setMode("search")}
          >
            🔍 Search
          </button>
          <button
            className={`px-3 py-1 text-xs rounded-md transition-colors flex items-center gap-1 ${
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

        {mode === "search" ? (
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              className={`flex-1 min-w-0 ${inputCls} rounded-lg border px-3 py-2 text-sm focus:outline-none transition-colors`}
              placeholder={`Search ${workspace.destination || "any destination"}…`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
            <div className="flex gap-2">
              <CategorySelect value={category} onChange={setCategory} />
              <button
                className="flex-1 sm:flex-initial px-4 py-2 bg-[#5B8BA0] text-white text-sm rounded-lg hover:bg-[#4A7A8F] disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium whitespace-nowrap"
                onClick={handleSearch}
                disabled={searching || !query.trim()}
              >
                {searching ? (
                  <span className="flex items-center justify-center gap-1.5">
                    <span className="inline-block animate-spin">⟳</span> Searching…
                  </span>
                ) : (
                  "Search"
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <textarea
              className={`w-full ${inputCls} rounded-lg border px-3 py-2 text-sm focus:outline-none resize-none transition-colors`}
              rows={2}
              placeholder={`Paste a name, URL, or description — e.g. "Borgo Santo Pietro, Tuscany" or https://…`}
              value={scoreInput}
              onChange={(e) => setScoreInput(e.target.value)}
            />
            <div className="flex gap-2">
              <CategorySelect value={category} onChange={setCategory} />
              <button
                className="flex-1 sm:flex-initial px-4 py-1.5 bg-[#5B8BA0] text-white text-sm rounded-lg hover:bg-[#4A7A8F] disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium whitespace-nowrap"
                onClick={handleScore}
                disabled={searching || !scoreInput.trim()}
              >
                {searching ? (
                  <span className="flex items-center justify-center gap-1.5">
                    <span className="inline-block animate-spin">⟳</span> Scoring…
                  </span>
                ) : (
                  "Score it"
                )}
              </button>
            </div>
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

      {/* Tabs */}
      <div className="flex border-b border-[#E0E8ED] dark:border-[#2a3f52] bg-white dark:bg-[#1e2d3d] px-4 sm:px-6">
        <button
          className={`py-2.5 px-4 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "search"
              ? "border-[#E8A87C] text-[#2C3E50] dark:text-white"
              : "border-transparent text-[#6B8299] hover:text-[#3D5A6E] dark:hover:text-[#B8D4E3]"
          }`}
          onClick={() => setActiveTab("search")}
        >
          Results
        </button>
        <button
          className={`py-2.5 px-4 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "saved"
              ? "border-[#E8A87C] text-[#2C3E50] dark:text-white"
              : "border-transparent text-[#6B8299] hover:text-[#3D5A6E] dark:hover:text-[#B8D4E3]"
          }`}
          onClick={() => setActiveTab("saved")}
        >
          Saved{workspace.savedOptions.length > 0 ? ` (${workspace.savedOptions.length})` : ""}
        </button>
        <button
          className={`py-2.5 px-4 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "history"
              ? "border-[#E8A87C] text-[#2C3E50] dark:text-white"
              : "border-transparent text-[#6B8299] hover:text-[#3D5A6E] dark:hover:text-[#B8D4E3]"
          }`}
          onClick={() => setActiveTab("history")}
        >
          History
        </button>
      </div>

      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {/* ── Results tab ── */}
        {activeTab === "search" && (
          <div className="flex-1 min-h-0 flex flex-col">
            {/* Non-scrolling header: pills, banners, result count */}
            <div className="px-4 pt-4 flex-shrink-0 space-y-3">
            {/* Search history pills */}
            {workspace.searches.length > 1 && (
              <div className="flex gap-2 flex-wrap">
                {workspace.searches.map((s) => {
                  const meta = CATEGORY_META[s.category] ?? { icon: "🔍", label: s.category, hint: "" };
                  const isActive = s.id === activeSearchId;
                  return (
                    <button
                      key={s.id}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors flex items-center gap-1 ${
                        isActive
                          ? "border-[#5B8BA0] text-[#5B8BA0] dark:text-[#7DBAD4] bg-[#5B8BA0]/8 dark:bg-[#5B8BA0]/15 font-medium"
                          : "border-[#E0E8ED] dark:border-[#3D5A6E] text-[#6B8299] dark:text-[#9BB0C1] hover:border-[#9BB0C1] dark:hover:border-[#9BB0C1]"
                      }`}
                      onClick={() => { setActiveSearchId(s.id); setCategoryFilter(null); setQuery(s.query); }}
                    >
                      <span>{meta.icon}</span>
                      <span className="truncate max-w-[160px]">{s.query}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Category tabs — shown when same query searched across multiple categories */}
            {showCategoryTabs && (
              <div className="mb-3 flex gap-1 flex-wrap">
                {siblingSearches.map((s) => {
                  const meta = CATEGORY_META[s.category] ?? { icon: "🔍", label: s.category, hint: "" };
                  const isActive = (categoryFilter ?? activeSearch?.category) === s.category;
                  return (
                    <button
                      key={s.id}
                      className={`text-xs px-3 py-1 rounded-lg border transition-colors flex items-center gap-1.5 ${
                        isActive
                          ? "border-[#5B8BA0] bg-[#5B8BA0]/8 dark:bg-[#5B8BA0]/15 text-[#5B8BA0] dark:text-[#7DBAD4] font-medium"
                          : "border-[#E0E8ED] dark:border-[#3D5A6E] text-[#6B8299] dark:text-[#9BB0C1] hover:border-[#9BB0C1] dark:hover:border-[#9BB0C1] bg-white dark:bg-[#1e2d3d]"
                      }`}
                      onClick={() => {
                        setActiveSearchId(s.id);
                        setCategoryFilter(s.category);
                      }}
                    >
                      <span>{meta.icon}</span>
                      <span>{meta.label}</span>
                      <span className="text-[#9BB0C1] dark:text-[#6B8299]">({s.scoredResults.length})</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Comparison bar */}
            {selectedIds.size >= 2 && (
              <div className="mb-4 flex items-center gap-3 bg-[#5B8BA0]/8 dark:bg-[#5B8BA0]/15 border border-[#5B8BA0]/40 dark:border-[#5B8BA0] rounded-xl px-4 py-2.5">
                <span className="text-[#5B8BA0] dark:text-[#7DBAD4] text-sm font-medium">
                  {selectedIds.size} selected
                </span>
                <button
                  className="px-3 py-1 bg-[#5B8BA0] text-white text-sm rounded-lg hover:bg-[#4A7A8F] transition-colors"
                  onClick={() => setShowComparison(true)}
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

            {/* Result count — shown in header so it stays visible */}
            {!searching && sortedResults.length > 0 && (
              <p className="text-[#9BB0C1] dark:text-[#6B8299] text-xs">
                {sortedResults.length} result{sortedResults.length !== 1 ? "s" : ""}
                {" · "}{CATEGORY_META[displayedSearch!.category]?.icon} {CATEGORY_META[displayedSearch!.category]?.label ?? displayedSearch!.category}
                {" · "}&quot;{displayedSearch!.query}&quot;
              </p>
            )}
            </div>{/* end header */}

            {/* Scrollable content area */}
            <div className="flex-1 min-h-0 flex flex-col px-4 pb-4">

            {/* Searching state */}
            {searching && (
              <div className="flex-1 flex flex-col items-center justify-center py-16">
                <div className="text-5xl mb-4 animate-pulse">{mode === "score" ? "✦" : "🔍"}</div>
                <p className="text-[#3D5A6E] dark:text-[#B8D4E3] font-medium">
                  {mode === "score" ? "Researching and scoring…" : "Searching and scoring options…"}
                </p>
                <p className="text-sm text-[#6B8299] mt-1">This may take 15–30 seconds</p>
              </div>
            )}

            {/* Group sort info */}
            {!searching && sortMode === "group" && travelers.length > 1 && sortedResults.length > 0 && (
              <div className="mb-3 flex items-center gap-2 text-xs">
                <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                <span className="text-[#6B8299] dark:text-[#9BB0C1]">
                  <span className="font-medium text-[#3D5A6E] dark:text-[#B8D4E3]">Group sort</span>
                  {" "}— options where everyone scores ≥65% rank first, then by average
                </span>
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
              <div className="flex-1 min-h-0 flex flex-col">

                {/* Mobile: stacked expandable cards */}
                <div className="lg:hidden overflow-y-auto flex-1 space-y-3 pb-4">
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
                  <div className="w-72 xl:w-80 flex-shrink-0 overflow-y-auto space-y-2 pb-4">
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
                <div className="text-6xl mb-4">✈️</div>
                <p className="text-lg font-medium text-[#3D5A6E] dark:text-[#B8D4E3]">
                  {workspace.searches.length > 0 ? "No results found" : "Search to get started"}
                </p>
                <p className="text-sm text-[#6B8299] mt-1">
                  Try &quot;boutique hotels in {workspace.destination || "Tuscany"}&quot;
                </p>
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

            {/* Empty state */}
            {workspace.savedOptions.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center py-16">
                <div className="text-6xl mb-4">📋</div>
                <p className="text-lg font-medium text-[#3D5A6E] dark:text-[#B8D4E3]">No saved options yet</p>
                <p className="text-sm text-[#6B8299] mt-1">Save results from your searches to compare later</p>
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
                        isSelected={false}
                        category={sourceSearch?.category}
                        searchQuery={sourceSearch?.query}
                        onToggleSelect={() => {}}
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
                    <p className="text-[#6B8299] text-xs uppercase tracking-wide mb-2">Trip Notes</p>
                    <textarea
                      className={`w-full ${inputCls} text-sm rounded-lg border p-3 resize-none focus:outline-none transition-colors`}
                      rows={4}
                      placeholder="Notes about this trip…"
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
                          isSelected={false}
                          category={sourceSearch?.category}
                          searchQuery={sourceSearch?.query}
                          variant="list"
                          selected={detailSavedCard?.id === option.id}
                          onSelect={() => setSelectedSavedCardId(option.id)}
                          onToggleSelect={() => {}}
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
                      <p className="text-[#6B8299] text-xs uppercase tracking-wide mb-2">Trip Notes</p>
                      <textarea
                        className={`w-full ${inputCls} text-sm rounded-lg border p-3 resize-none focus:outline-none transition-colors`}
                        rows={4}
                        placeholder="Notes about this trip…"
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
                      <p className="text-xs text-[#6B8299] dark:text-[#9BB0C1] uppercase tracking-wide font-medium mb-0.5">
                        ViyaWay accuracy
                      </p>
                      <p className="text-sm font-semibold text-[#2C3E50] dark:text-white">
                        {goodOrPerfect.length} of {confirmed.length} stay{confirmed.length !== 1 ? "s" : ""} confirmed as{" "}
                        {goodOrPerfect.length === 1 ? "a " : ""}good or perfect fit
                      </p>
                      {confirmed.length >= 2 && (
                        <p className="text-xs text-[#6B8299] dark:text-[#9BB0C1] mt-0.5">
                          {Math.round((goodOrPerfect.length / confirmed.length) * 100)}% accuracy on this trip
                        </p>
                      )}
                    </div>
                  )}

                  {sorted.length === 0 ? (
                    <div className="text-center py-16">
                      <div className="text-5xl mb-4">🗓️</div>
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

      {showComparison && selectedOptions.length >= 2 && profileWeights && (
        <ComparisonView
          options={selectedOptions}
          profileWeights={profileWeights}
          workspaceId={workspace.id}
          onClose={() => setShowComparison(false)}
        />
      )}

      {pendingCalibration && primaryProfile && (
        <CalibrationPrompt
          profile={primaryProfile}
          suggestions={pendingCalibration}
          savesCount={pendingCalibration.length}
          onAccept={handleCalibrationAccept}
          onDismiss={handleCalibrationDismiss}
        />
      )}

      {showUpgradePrompt && (
        <UpgradePrompt onClose={() => setShowUpgradePrompt(false)} />
      )}
    </div>
  );
}
