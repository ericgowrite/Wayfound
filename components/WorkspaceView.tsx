"use client";

import { useState, useEffect } from "react";
import {
  Profile,
  TripWorkspace,
  Search,
  ScoredOption,
  SavedOption,
  SearchCategory,
} from "@/types";
import { sortByAlignment, sortByGroupFit } from "@/lib/scoring";
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

interface Props {
  workspace: TripWorkspace;
  travelers: Profile[];
  onChange: (w: TripWorkspace) => void;
  onProfileUpdate: (profile: Profile) => void;
}

type SortMode = "fit" | "group";

export default function WorkspaceView({ workspace, travelers, onChange, onProfileUpdate }: Props) {
  const primaryProfile = travelers[0];
  const profileWeights = primaryProfile?.axisWeights;

  const [mode, setMode] = useState<"search" | "score">("search");
  const [sortMode, setSortMode] = useState<SortMode>("fit");
  const [query, setQuery] = useState("");
  const [scoreInput, setScoreInput] = useState("");
  const [category, setCategory] = useState<SearchCategory>("accommodation");
  const [searching, setSearching] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [activeTab, setActiveTab] = useState<"search" | "saved">("search");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showComparison, setShowComparison] = useState(false);
  const [workspaceNotes, setWorkspaceNotes] = useState(workspace.notes);
  const [activeSearchId, setActiveSearchId] = useState<string | null>(
    workspace.searches[0]?.id ?? null
  );
  const [pendingCalibration, setPendingCalibration] = useState<CalibrationSuggestion[] | null>(null);
  const [showFitCallout, setShowFitCallout] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<SearchCategory | null>(null);

  useEffect(() => {
    if (
      !showFitCallout &&
      workspace.searches.length > 0 &&
      workspace.searches[0].scoredResults.length > 0 &&
      !localStorage.getItem("hasSeenFitLegend")
    ) {
      setShowFitCallout(true);
    }
  }, [workspace.searches]);

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
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: workspace.id, query, category }),
      });
      if (!res.ok) {
        const err = await res.json();
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
      const res = await fetch("/api/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: workspace.id, input: scoreInput, category }),
      });
      if (!res.ok) {
        const err = await res.json();
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
      const res = await fetch("/api/search/more", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: workspace.id, searchId: activeSearchId }),
      });
      if (!res.ok) {
        const err = await res.json();
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
      const res = await fetch(`/api/workspaces/${updated.id}`, {
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

  async function handleCalibrationAccept(newWeights: import("@/types").AxisWeights) {
    if (!primaryProfile || !pendingCalibration) return;
    const res = await fetch(`/api/profiles/${primaryProfile.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...primaryProfile, axisWeights: newWeights }),
    });
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
      {/* Workspace header */}
      <div className="bg-white dark:bg-[#1e2d3d] border-b border-[#E0E8ED] dark:border-[#2a3f52] px-6 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-[#2C3E50] dark:text-white">{workspace.name}</h1>
            <p className="text-[#6B8299] dark:text-[#9BB0C1] text-sm">
              {workspace.destination}
              {travelers.length > 0 && (
                <span className="ml-2 text-[#9BB0C1] dark:text-[#6B8299]">
                  · {travelers.map((t) => t.name).join(", ")}
                </span>
              )}
            </p>
          </div>
          {/* Group sort toggle — only visible when 2+ travelers */}
          {travelers.length > 1 && (
            <div className="flex items-center gap-0.5 bg-[#EEF4F8] dark:bg-[#2a3f52] rounded-lg p-0.5 text-xs flex-shrink-0">
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
      <div className="bg-white dark:bg-[#1e2d3d] border-b border-[#E0E8ED] dark:border-[#2a3f52] px-6 py-3 space-y-2">
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
              className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border border-current opacity-50 text-[9px] leading-none cursor-default"
              title="Paste a specific travel option here to score"
            >
              i
            </span>
          </button>
        </div>

        {mode === "search" ? (
          <div className="flex gap-2">
            <input
              className={`flex-1 ${inputCls} rounded-lg border px-3 py-2 text-sm focus:outline-none transition-colors`}
              placeholder={`Search ${workspace.destination || "any destination"}…`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
            <CategorySelect value={category} onChange={setCategory} />
            <button
              className="px-4 py-2 bg-[#5B8BA0] text-white text-sm rounded-lg hover:bg-[#4A7A8F] disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
              onClick={handleSearch}
              disabled={searching || !query.trim()}
            >
              {searching ? (
                <span className="flex items-center gap-1.5">
                  <span className="inline-block animate-spin">⟳</span> Searching…
                </span>
              ) : (
                "Search"
              )}
            </button>
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
                className="px-4 py-1.5 bg-[#5B8BA0] text-white text-sm rounded-lg hover:bg-[#4A7A8F] disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                onClick={handleScore}
                disabled={searching || !scoreInput.trim()}
              >
                {searching ? (
                  <span className="flex items-center gap-1.5">
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
      <div className="flex border-b border-[#E0E8ED] dark:border-[#2a3f52] bg-white dark:bg-[#1e2d3d] px-6">
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
                      onClick={() => { setActiveSearchId(s.id); setCategoryFilter(null); }}
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

            {/* Results */}
            {!searching && sortedResults.length > 0 && (
              <div className="space-y-3">
                <p className="text-[#9BB0C1] dark:text-[#6B8299] text-xs">
                  {sortedResults.length} result{sortedResults.length !== 1 ? "s" : ""}
                  {" · "}{CATEGORY_META[displayedSearch!.category]?.icon} {CATEGORY_META[displayedSearch!.category]?.label ?? displayedSearch!.category}
                  {" · "}&quot;{displayedSearch!.query}&quot;
                </p>
                {sortedResults.map((option) => (
                  <ResultCard
                    key={option.id}
                    option={option}
                    workspace={workspace}
                    travelers={travelers}
                    profileWeights={profileWeights}
                    isSelected={selectedIds.has(option.id)}
                    category={displayedSearch!.category}
                    onToggleSelect={() => toggleSelect(option.id)}
                    onSave={() => handleSaveOption(option)}
                    onStatusChange={(s) => handleStatusChange(displayedSearch!.id, option.id, s)}
                    onNotesChange={(n) => handleNotesChange(displayedSearch!.id, option.id, n)}
                    onDeepDive={() => {}}
                  />
                ))}

                {/* Find more */}
                <div className="pt-2 pb-4 flex justify-center">
                  {loadingMore ? (
                    <div className="text-center text-[#6B8299]">
                      <div className="text-2xl mb-1 animate-spin">⟳</div>
                      <p className="text-sm">Finding more options…</p>
                    </div>
                  ) : (
                    <button
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-[#E0E8ED] dark:border-[#3D5A6E] text-[#6B8299] dark:text-[#9BB0C1] hover:border-[#5B8BA0] hover:text-[#5B8BA0] dark:hover:text-[#7DBAD4] transition-colors text-sm"
                      onClick={handleMore}
                    >
                      <span>Find more options</span>
                      <span className="text-xs text-[#9BB0C1] dark:text-[#6B8299]">aligned to your profile</span>
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
              <div className="space-y-3">
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
                      onToggleSelect={() => {}}
                      onSave={() => handleSaveOption(option)}
                      onStatusChange={(s) => handleStatusChange(option.searchId, option.id, s)}
                      onNotesChange={(n) => handleNotesChange(option.searchId, option.id, n)}
                      onDeepDive={() => {}}
                    />
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
    </div>
  );
}
