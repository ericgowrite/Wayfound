"use client";

import { useState } from "react";
import { Profile, TripWorkspace, Search, SearchCategory } from "@/types";
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
  get_away:       "Where are you thinking? Tell us what kind of escape you need.",
  celebrating:    "Tell us about it — where you're thinking, who you're with, what would make it feel right.",
  reconnect:      "Where are you heading? We'll find somewhere that works for both of you.",
  new_place:      "Tell us what you're drawn to — we'll find somewhere you haven't been.",
  decompress:     "Where are you thinking? Tell us what a real reset looks like for you.",
  food_wine:      "Where are you heading? Tell us what kind of food moment you're after.",
  feel_different: "Tell us where — we'll find what's going to shift something.",
  work_trip:      "Where's the trip? Tell us what you want to squeeze in around it.",
};

const CATEGORIES: { value: SearchCategory; label: string }[] = [
  { value: "accommodation", label: "Places to stay" },
  { value: "restaurant",    label: "Restaurants" },
  { value: "activity",      label: "Activities" },
  { value: "tour",          label: "Tours" },
  { value: "attraction",    label: "Attractions" },
];

interface Props {
  profiles: Profile[];
  onWorkspaceReady: (workspace: TripWorkspace, search: Search) => void;
  onSkipToModal: () => void;
}

export default function IntentScreen({ profiles, onWorkspaceReady, onSkipToModal }: Props) {
  const [intentKey, setIntentKey] = useState<IntentKey | null>(null);
  const [fading, setFading] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<SearchCategory>("accommodation");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function selectIntent(key: IntentKey) {
    setFading(true);
    // Let the fade-out finish before hiding the list
    setTimeout(() => {
      setIntentKey(key);
      setFading(false);
    }, 260);
  }

  function dismissIntent() {
    setIntentKey(null);
    setQuery("");
    setError("");
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

      // Create workspace first
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

      // Fire search with intent as additional context
      const searchRes = await fetchWithAuth("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId: workspace.id,
          query: query.trim(),
          category,
          ...(intentKey ? { intent: intentKey } : {}),
        }),
      });
      if (!searchRes.ok) {
        const err = await searchRes.json();
        throw new Error(err.error || "Search failed");
      }
      const search: Search = await searchRes.json();
      onWorkspaceReady(workspace, search);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  const intentObj = INTENTS.find((i) => i.key === intentKey);
  const placeholder = intentKey ? INTENT_PLACEHOLDERS[intentKey] : "Where are you heading?";
  const showIntentList = !intentKey && !fading;
  const showSearch = !!intentKey;

  return (
    <div className="flex flex-col items-center justify-center h-full px-8 py-12">
      <div className="w-full max-w-2xl">

        {/* Headline — visually dominant */}
        <h1 className="text-6xl font-bold text-[#2C3E50] dark:text-white tracking-tight mb-10 text-center leading-tight">
          Going somewhere?
        </h1>

        {/* Intent list */}
        <div
          style={{
            opacity: fading ? 0 : (showIntentList ? 1 : 0),
            maxHeight: showIntentList ? "600px" : "0px",
            overflow: "hidden",
            pointerEvents: showIntentList ? "auto" : "none",
            transition: "opacity 250ms ease-out, max-height 300ms ease-out",
          }}
        >
          <div className="grid grid-cols-2 gap-x-12 gap-y-1 mb-8">
            {INTENTS.map((intent) => (
              <button
                key={intent.key}
                className="text-left text-[#3D5A6E] dark:text-[#9BB0C1] hover:text-[#2C3E50] dark:hover:text-white text-base leading-relaxed py-2.5 transition-colors duration-150 border-b border-[#E0E8ED] dark:border-[#2a3f52] hover:border-[#5B8BA0]/40 dark:hover:border-[#5B8BA0]/40"
                onClick={() => selectIntent(intent.key)}
              >
                {intent.label}
              </button>
            ))}
          </div>

          <p className="text-center mt-4">
            <button
              className="text-xs text-[#9BB0C1] dark:text-[#6B8299] hover:text-[#5B8BA0] dark:hover:text-[#7DBAD4] transition-colors"
              onClick={onSkipToModal}
            >
              Already know where you&apos;re going? →
            </button>
          </p>
        </div>

        {/* Search area — slides in after intent selected */}
        <div
          style={{
            opacity: showSearch ? 1 : 0,
            transform: showSearch ? "translateY(0)" : "translateY(10px)",
            pointerEvents: showSearch ? "auto" : "none",
            transition: "opacity 250ms ease-in-out 60ms, transform 250ms ease-in-out 60ms",
          }}
        >
          {/* Intent chip */}
          {intentObj && (
            <div className="mb-4">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#5B8BA0]/10 dark:bg-[#5B8BA0]/20 border border-[#5B8BA0]/30 dark:border-[#5B8BA0]/50 rounded-full text-xs text-[#5B8BA0] dark:text-[#7DBAD4]">
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
            </div>
          )}

          {/* Search row */}
          <div className="flex gap-2">
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
            />
            <button
              className="px-5 py-3 bg-[#5B8BA0] text-white rounded-lg text-sm font-medium hover:bg-[#4A7A8F] disabled:opacity-50 transition-colors flex-shrink-0"
              onClick={handleSearch}
              disabled={submitting || !query.trim()}
            >
              {submitting ? "…" : "Search"}
            </button>
          </div>

          {error && <p className="text-red-500 text-xs mt-2">{error}</p>}

          <p className="text-center mt-8">
            <button
              className="text-xs text-[#9BB0C1] dark:text-[#6B8299] hover:text-[#5B8BA0] dark:hover:text-[#7DBAD4] transition-colors"
              onClick={onSkipToModal}
            >
              Already know where you&apos;re going? →
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
