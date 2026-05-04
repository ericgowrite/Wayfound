"use client";

import { useState } from "react";
import {
  Profile,
  TripWorkspace,
  Search,
  ScoredOption,
  SavedOption,
  SearchCategory,
} from "@/types";
import { sortByAlignment, sortByGroupFit } from "@/lib/scoring";
import ResultCard from "./ResultCard";
import ComparisonView from "./ComparisonView";

interface Props {
  workspace: TripWorkspace;
  travelers: Profile[];
  onChange: (w: TripWorkspace) => void;
}

const CATEGORIES: SearchCategory[] = [
  "accommodation",
  "tour",
  "restaurant",
  "activity",
  "destination",
];

type SortMode = "fit" | "group";

export default function WorkspaceView({ workspace, travelers, onChange }: Props) {
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

  const activeSearch = workspace.searches.find((s) => s.id === activeSearchId) ?? null;

  const sortedResults = activeSearch
    ? sortMode === "group" && travelers.length > 1
      ? sortByGroupFit(activeSearch.scoredResults, travelers)
      : sortByAlignment(activeSearch.scoredResults)
    : [];

  async function handleSearch() {
    if (!query.trim()) return;
    setSearching(true);
    setSearchError("");
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
    const res = await fetch(`/api/workspaces/${updated.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated),
    });
    const saved = await res.json();
    onChange(saved);
    return saved;
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
    "bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-gray-700 focus:border-blue-500";

  return (
    <div className="flex flex-col h-full">
      {/* Workspace header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{workspace.name}</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              {workspace.destination}
              {travelers.length > 0 && (
                <span className="ml-2 text-gray-400 dark:text-gray-500">
                  · {travelers.map((t) => t.name).join(", ")}
                </span>
              )}
            </p>
          </div>
          {/* Group sort toggle — only visible when 2+ travelers */}
          {travelers.length > 1 && (
            <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5 text-xs flex-shrink-0">
              <button
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  sortMode === "fit"
                    ? "bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm font-medium"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                }`}
                onClick={() => setSortMode("fit")}
              >
                Best Fit
              </button>
              <button
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  sortMode === "group"
                    ? "bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm font-medium"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
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
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-3 space-y-2">
        {/* Mode toggle */}
        <div className="flex items-center gap-0.5 bg-gray-200 dark:bg-gray-800 rounded-lg p-0.5 w-fit">
          <button
            className={`px-3 py-1 text-xs rounded-md transition-colors ${
              mode === "search"
                ? "bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow font-medium"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            }`}
            onClick={() => setMode("search")}
          >
            🔍 Search
          </button>
          <button
            className={`px-3 py-1 text-xs rounded-md transition-colors ${
              mode === "score"
                ? "bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow font-medium"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            }`}
            onClick={() => setMode("score")}
          >
            ✦ Score specific
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
            <select
              className={`${inputCls} text-sm rounded-lg border px-2 py-2 focus:outline-none transition-colors`}
              value={category}
              onChange={(e) => setCategory(e.target.value as SearchCategory)}
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c.charAt(0).toUpperCase() + c.slice(1)}
                </option>
              ))}
            </select>
            <button
              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
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
              <select
                className={`${inputCls} text-sm rounded-lg border px-2 py-1.5 focus:outline-none transition-colors`}
                value={category}
                onChange={(e) => setCategory(e.target.value as SearchCategory)}
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c.charAt(0).toUpperCase() + c.slice(1)}
                  </option>
                ))}
              </select>
              <button
                className="px-4 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
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
          <div className="flex items-start gap-2 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
            <span className="text-red-500 text-xs mt-0.5 flex-shrink-0">⚠</span>
            <p className="text-red-700 dark:text-red-400 text-xs">{searchError}</p>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-6">
        <button
          className={`py-2.5 px-4 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "search"
              ? "border-blue-500 text-blue-600 dark:text-blue-400"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          }`}
          onClick={() => setActiveTab("search")}
        >
          Results
        </button>
        <button
          className={`py-2.5 px-4 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "saved"
              ? "border-blue-500 text-blue-600 dark:text-blue-400"
              : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
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
                {workspace.searches.map((s) => (
                  <button
                    key={s.id}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      s.id === activeSearchId
                        ? "border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 font-medium"
                        : "border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-500"
                    }`}
                    onClick={() => setActiveSearchId(s.id)}
                  >
                    {s.query}
                  </button>
                ))}
              </div>
            )}

            {/* Comparison bar */}
            {selectedIds.size >= 2 && (
              <div className="mb-4 flex items-center gap-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700 rounded-xl px-4 py-2.5">
                <span className="text-blue-700 dark:text-blue-300 text-sm font-medium">
                  {selectedIds.size} selected
                </span>
                <button
                  className="px-3 py-1 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-500 transition-colors"
                  onClick={() => setShowComparison(true)}
                >
                  Compare →
                </button>
                <button
                  className="text-gray-500 text-sm hover:text-gray-800 dark:hover:text-white ml-auto transition-colors"
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
                <p className="text-gray-700 dark:text-gray-300 font-medium">
                  {mode === "score" ? "Researching and scoring…" : "Searching and scoring options…"}
                </p>
                <p className="text-sm text-gray-500 mt-1">This may take 15–30 seconds</p>
              </div>
            )}

            {/* Group sort info */}
            {!searching && sortMode === "group" && travelers.length > 1 && sortedResults.length > 0 && (
              <div className="mb-3 flex items-center gap-2 text-xs">
                <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                <span className="text-gray-600 dark:text-gray-400">
                  <span className="font-medium text-gray-700 dark:text-gray-300">Group sort</span>
                  {" "}— options where everyone scores ≥65% rank first, then by average
                </span>
              </div>
            )}

            {/* Results */}
            {!searching && sortedResults.length > 0 && (
              <div className="space-y-3">
                <p className="text-gray-400 dark:text-gray-500 text-xs">
                  {sortedResults.length} result{sortedResults.length !== 1 ? "s" : ""} · &quot;{activeSearch!.query}&quot;
                </p>
                {sortedResults.map((option) => (
                  <ResultCard
                    key={option.id}
                    option={option}
                    workspace={workspace}
                    travelers={travelers}
                    profileWeights={profileWeights}
                    isSelected={selectedIds.has(option.id)}
                    onToggleSelect={() => toggleSelect(option.id)}
                    onSave={() => handleSaveOption(option)}
                    onStatusChange={(s) => handleStatusChange(activeSearch!.id, option.id, s)}
                    onNotesChange={(n) => handleNotesChange(activeSearch!.id, option.id, n)}
                    onDeepDive={() => {}}
                  />
                ))}

                {/* Find more */}
                <div className="pt-2 pb-4 flex justify-center">
                  {loadingMore ? (
                    <div className="text-center text-gray-500">
                      <div className="text-2xl mb-1 animate-spin">⟳</div>
                      <p className="text-sm">Finding more options…</p>
                    </div>
                  ) : (
                    <button
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors text-sm"
                      onClick={handleMore}
                    >
                      <span>Find more options</span>
                      <span className="text-xs text-gray-400 dark:text-gray-600">aligned to your profile</span>
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
                <p className="text-lg font-medium text-gray-700 dark:text-gray-300">
                  {workspace.searches.length > 0 ? "No results found" : "Search to get started"}
                </p>
                <p className="text-sm text-gray-500 mt-1">
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
                <p className="text-lg font-medium text-gray-700 dark:text-gray-300">No saved options yet</p>
                <p className="text-sm text-gray-500 mt-1">Save results from your searches to compare later</p>
              </div>
            ) : (
              <div className="space-y-3">
                {workspace.savedOptions.map((option) => (
                  <ResultCard
                    key={option.id}
                    option={option}
                    workspace={workspace}
                    travelers={travelers}
                    profileWeights={profileWeights}
                    isSelected={false}
                    onToggleSelect={() => {}}
                    onSave={() => handleSaveOption(option)}
                    onStatusChange={(s) => handleStatusChange(option.searchId, option.id, s)}
                    onNotesChange={(n) => handleNotesChange(option.searchId, option.id, n)}
                    onDeepDive={() => {}}
                  />
                ))}
              </div>
            )}

            {/* Trip notes */}
            <div className="mt-6">
              <p className="text-gray-500 text-xs uppercase tracking-wide mb-2">Trip Notes</p>
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
          onClose={() => setShowComparison(false)}
        />
      )}
    </div>
  );
}
