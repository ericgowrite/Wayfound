"use client";

import { useState } from "react";
import { Profile, TripWorkspace, SearchCategory } from "@/types";
import { fetchWithAuth } from "@/lib/fetchWithAuth";

export const INTENTS = [
  { key: "get_away",       label: "I need to get away — properly",                      chip: "Getting away properly" },
  { key: "celebrating",    label: "I'm celebrating something",                           chip: "Celebrating something" },
  { key: "reconnect",      label: "I'm going with someone I want to reconnect with",     chip: "Reconnecting with someone" },
  { key: "new_place",      label: "I want somewhere completely new",                     chip: "Somewhere completely new" },
  { key: "decompress",     label: "I need to decompress, not just change location",      chip: "Genuine decompression" },
  { key: "food_wine",      label: "I'm chasing good food and good wine",                 chip: "Food & wine" },
  { key: "feel_different", label: "I want to feel something different",                  chip: "Feel something different" },
  { key: "work_trip",      label: "Work trip — making the most of it",                   chip: "Work trip" },
] as const;

export type IntentKey = typeof INTENTS[number]["key"];

export const INTENT_PLACEHOLDERS: Record<IntentKey, string> = {
  get_away:       "Where to? Tell us what kind of escape you need.",
  celebrating:    "Where to? Tell us what would make it feel special.",
  reconnect:      "Where to? We'll find somewhere that works for both of you.",
  new_place:      "Where to? Tell us what you're drawn to.",
  decompress:     "Where to? Tell us what a real reset looks like.",
  food_wine:      "Where to? Tell us what kind of food moment you want.",
  feel_different: "Where to? We'll find what shifts something.",
  work_trip:      "Where to? Tell us what you want to fit in around it.",
};

const DEFAULT_PLACEHOLDER = "Let's search";

const CATEGORIES: { value: SearchCategory; label: string }[] = [
  { value: "accommodation", label: "Places to stay" },
  { value: "restaurant",    label: "Restaurants" },
  { value: "activity",      label: "Activities" },
  { value: "tour",          label: "Tours" },
  { value: "attraction",    label: "Attractions" },
];

export interface AutoSearch {
  workspaceId: string;
  query: string;
  category: SearchCategory;
  intent?: string;
}

interface Props {
  profiles: Profile[];
  /** Called once the workspace is created — WorkspaceView will fire the search */
  onWorkspaceCreated: (workspace: TripWorkspace, autoSearch: AutoSearch) => void;
  onSkipToModal: () => void;
}

export default function IntentScreen({ profiles, onWorkspaceCreated, onSkipToModal }: Props) {
  const [intentKey, setIntentKey] = useState<IntentKey | null>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<SearchCategory>("accommodation");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function selectIntent(key: IntentKey) {
    setIntentKey(key);
  }

  function dismissIntent() {
    setIntentKey(null);
  }

  async function handleSearch() {
    if (!query.trim() || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const intent = INTENTS.find((i) => i.key === intentKey);
      const tripName = intent
        ? `${query.trim()} · ${intent.chip}`
        : query.trim();

      const wsRes = await fetchWithAuth("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: tripName,
          destination: query.trim(),
          travelers: profiles.length > 0 ? [profiles[0].id] : [],
        }),
      });
      if (!wsRes.ok) throw new Error("Couldn't create trip — please try again.");
      const workspace: TripWorkspace = await wsRes.json();

      onWorkspaceCreated(workspace, {
        workspaceId: workspace.id,
        query: query.trim(),
        category,
        ...(intentKey ? { intent: intentKey } : {}),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  const intentObj = INTENTS.find((i) => i.key === intentKey);
  const placeholder = intentKey ? INTENT_PLACEHOLDERS[intentKey] : DEFAULT_PLACEHOLDER;

  return (
    <div className="flex flex-col items-center justify-center h-full px-8 py-12">
      <div className="w-full max-w-2xl">

        {/* Headline — visually dominant */}
        <h1 className="text-6xl font-bold text-[#2C3E50] dark:text-white tracking-tight mb-8 text-center leading-tight">
          Going somewhere?
        </h1>

        {/* Intent chip — appears above search when an intent is selected */}
        <div className="mb-3 min-h-[28px]">
          {intentObj && (
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#5B8BA0]/10 dark:bg-[#5B8BA0]/20 border border-[#5B8BA0]/30 dark:border-[#5B8BA0]/50 rounded-full text-xs text-[#5B8BA0] dark:text-[#7DBAD4]"
              style={{ animation: "fadeIn 150ms ease-out" }}
            >
              <span aria-hidden>✦</span>
              <span>{intentObj.chip}</span>
              <button
                className="ml-0.5 opacity-60 hover:opacity-100 transition-opacity leading-none"
                onClick={dismissIntent}
                aria-label="Clear intent"
              >
                ×
              </button>
            </span>
          )}
        </div>

        {/* Search row — always visible */}
        <div className="flex gap-2 mb-2">
          <select
            className="bg-[#EEF4F8] dark:bg-[#2a3f52] text-[#3D5A6E] dark:text-[#B8D4E3] border border-[#E0E8ED] dark:border-[#3D5A6E] rounded-lg px-3 py-3 text-sm focus:outline-none focus:border-[#5B8BA0] flex-shrink-0"
            value={category}
            onChange={(e) => setCategory(e.target.value as SearchCategory)}
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          <input
            autoFocus
            className="flex-1 bg-[#EEF4F8] dark:bg-[#2a3f52] text-[#2C3E50] dark:text-[#B8D4E3] border border-[#E0E8ED] dark:border-[#3D5A6E] rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-[#5B8BA0] placeholder:text-[#9BB0C1] dark:placeholder:text-[#6B8299]"
            placeholder={placeholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            disabled={submitting}
          />
          <button
            className="px-5 py-3 bg-[#5B8BA0] text-white rounded-lg text-sm font-medium hover:bg-[#4A7A8F] disabled:opacity-50 transition-colors flex-shrink-0"
            onClick={handleSearch}
            disabled={submitting || !query.trim()}
          >
            {submitting ? "…" : "Search"}
          </button>
        </div>

        {error && <p className="text-red-500 text-xs mb-3">{error}</p>}

        {/* "Tell us more" label — bridge between search and intent options */}
        <p className="text-xs text-[#9BB0C1] dark:text-[#6B8299] mb-4 mt-6">
          Tell us more
        </p>

        {/* Intent options — always visible, optional enrichment */}
        <div className="grid grid-cols-2 gap-x-12 gap-y-1">
          {INTENTS.map((intent) => (
            <button
              key={intent.key}
              className={`text-left text-base leading-relaxed py-2.5 transition-colors duration-150 border-b border-[#E0E8ED] dark:border-[#2a3f52] hover:border-[#5B8BA0]/40 dark:hover:border-[#5B8BA0]/40 ${
                intentKey === intent.key
                  ? "text-[#5B8BA0] dark:text-[#7DBAD4] border-[#5B8BA0]/40"
                  : "text-[#3D5A6E] dark:text-[#9BB0C1] hover:text-[#2C3E50] dark:hover:text-white"
              }`}
              onClick={() => intentKey === intent.key ? dismissIntent() : selectIntent(intent.key)}
            >
              {intent.label}
            </button>
          ))}
        </div>

      </div>

      <style>{`@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }`}</style>
    </div>
  );
}
