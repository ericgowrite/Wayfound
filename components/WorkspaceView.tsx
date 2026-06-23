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
import ResultCard from "./ResultCard";
import ComparisonView from "./ComparisonView";
import CalibrationPrompt from "./CalibrationPrompt";
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
  const [activeTab, setActiveTab] = useState<"search" | "saved">("search");
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
    try {
      const res = await fetchWithAuth(`/api/workspaces/${updated.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const saved = await res.json();
      onChange(saved);
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
            { ...option, savedAt: new Date().toISOString(), tags: [] } as SavedOption,
          ],
        };
    updateWorkspace(updated);

    if (!alreadySaved && primaryProfile) {
      trackSave(option, primaryProfile.id);
      if (shouldTriggerCalibration(primaryProfile.id)) {
        markCalibrationShown(primaryProfile.id);
        const suggestions = analyzeCalibration(primaryProfile);
        if (suggestions.length > 0) setPendingCalibration(suggestions);
      }
    }
  }

  function handleStatusChange(searchId: string, optionId: string, status: ScoredOption["status"]) {
    updateWorkspace({
      ...workspace,
      searches: workspace.searches.map((s) =>
        s.id === searchId
          ? { ...s, scoredResults: s.scoredResults.map((o) => (o.id === optionId ? { ...o, status } : o)) }
          : s
      ),
      savedOptions: workspace.savedOptions.map((o) => (o.id === optionId ? { ...o, status } : o)),
    });

    if (status === "rejected" && primaryProfile) {
      const option =
        workspace.searches.find((s) => s.id === searchId)?.scoredResults.find((o) => o.id === optionId) ??
        workspace.savedOptions.find((o) => o.id === optionId);
      if (option) trackReject(option, primaryProfile.id);
    }
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
      </div>

      <div className="flex-1 overflow-auto">
        {/* ── Results tab ── */}
        {activeTab === "search" && (
          <div className="p-4">
            {/* Search history pills */}
            {workspace.searches.length > 1 && (
              <div className="mb-4 flex gap-2 flex-wrap">
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

            {/* Searching state */}
            {searching && (
              <div className="text-center py-16">
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
              <div className="space-y-3">
                <p className="text-[#9BB0C1] dark:text-[#6B8299] text-xs">
                  {sortedResults.length} result{sortedResults.length !== 1 ? "s" : ""}
                  {" · "}{CATEGORY_META[displayedSearch!.category]?.icon} {CATEGORY_META[displayedSearch!.category]?.label ?? displayedSearch!.category}
                  {" · "}&quot;{displayedSearch!.query}&quot;
                </p>
                {/* Grid on desktop (more visible at a glance, less scrolling), single column on mobile */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {sortedResults.map((option) => (
                    <div key={option.id} className={expandedCardId === option.id ? "lg:col-span-2" : ""}>
                      <ResultCard
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
                        onExpandedChange={(exp) => setExpandedCardId(exp ? option.id : null)}
                      />
                    </div>
                  ))}
                </div>

                {/* Find more */}
                <div className="pt-2 pb-4 flex justify-center">
                  {loadingMore ? (
                    <div className="text-center text-[#6B8299]">
                      <div className="text-2xl mb-1 animate-spin">⟳</div>
                      <p className="text-sm">Finding more options…</p>
                    </div>
                  ) : (
                    <button
                      className="flex items-center gap-2 px-5 sm:px-6 py-3 rounded-full bg-[#5B8BA0] text-white hover:bg-[#4A7A8F] transition-colors text-sm font-medium shadow-sm"
                      onClick={handleMore}
                    >
                      <span>Find more options</span>
                      <span className="hidden sm:inline text-xs text-white/70">aligned to your profile</span>
                      <span>→</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Empty state */}
            {!searching && sortedResults.length === 0 && (
              <div className="text-center py-16">
                <div className="text-6xl mb-4">✈️</div>
                <p className="text-lg font-medium text-[#3D5A6E] dark:text-[#B8D4E3]">
                  {workspace.searches.length > 0 ? "No results found" : "Search to get started"}
                </p>
                <p className="text-sm text-[#6B8299] mt-1">
                  Try &quot;boutique hotels in {workspace.destination || "Tuscany"}&quot;
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── Saved tab ── */}
        {activeTab === "saved" && (
          <div className="p-4">
            {workspace.savedOptions.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-6xl mb-4">📋</div>
                <p className="text-lg font-medium text-[#3D5A6E] dark:text-[#B8D4E3]">No saved options yet</p>
                <p className="text-sm text-[#6B8299] mt-1">Save results from your searches to compare later</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {workspace.savedOptions.map((option) => {
                  const sourceSearch = workspace.searches.find((s) => s.id === option.searchId);
                  return (
                    <div key={option.id} className={expandedCardId === option.id ? "lg:col-span-2" : ""}>
                      <ResultCard
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
                        onExpandedChange={(exp) => setExpandedCardId(exp ? option.id : null)}
                      />
                    </div>
                  );
                })}
              </div>
            )}

            {/* Trip notes */}
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
