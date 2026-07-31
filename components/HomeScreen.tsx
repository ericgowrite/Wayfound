"use client";

import { useState } from "react";
import { Profile, TripWorkspace, SearchCategory } from "@/types";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { TYPE_INFO } from "@/lib/typeInfo";
import { AutoSearch } from "@/components/IntentScreen";

// ── Icons ──────────────────────────────────────────────────────────────────
function StayIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M4 20V9.5l8-5.5 8 5.5V20" />
      <path d="M3 20h18" />
      <rect x="9.5" y="13" width="5" height="7" />
    </svg>
  );
}
function EatIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="12" cy="12" r="9" opacity="0.45" />
      <path d="M7 5v4a1.4 1.4 0 0 0 2.8 0V5M8.4 5v13" />
      <path d="M15.5 5c-1 1.4-1 3.4 0 5v8" />
    </svg>
  );
}
function DoIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2" />
      <path d="M15.3 8.7l-2 4.6-4.6 2 2-4.6 4.6-2z" fill="currentColor" stroke="none" />
    </svg>
  );
}
function TourIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" />
      <circle cx="12" cy="10" r="2.3" />
    </svg>
  );
}

// ── Data ───────────────────────────────────────────────────────────────────
const CATEGORIES: { value: SearchCategory; label: string; Icon: typeof StayIcon }[] = [
  { value: "accommodation", label: "Stay", Icon: StayIcon },
  { value: "restaurant",    label: "Eat",  Icon: EatIcon  },
  { value: "activity",      label: "Do",   Icon: DoIcon   },
  { value: "tour",          label: "Tour", Icon: TourIcon },
];

const VIBE_CHIPS_PRIMARY = [
  { label: "Reset & recharge",    intent: "get_away"      },
  { label: "Somewhere new",       intent: "new_place"     },
  { label: "Reconnect",           intent: "reconnect"     },
];

const VIBE_CHIPS_SECONDARY = [
  { label: "Action & adventure",      intent: "feel_different" },
  { label: "Romantic getaway",        intent: "celebrating"    },
  { label: "Solo trip",               intent: "get_away"       },
  { label: "Family time",             intent: "reconnect"      },
  { label: "Work (& a little play)",  intent: "work_trip"      },
  { label: "Last minute escape",      intent: "get_away"       },
];

// ── Component ──────────────────────────────────────────────────────────────
interface Props {
  profiles: Profile[];
  workspaces: TripWorkspace[];
  onWorkspaceCreated: (workspace: TripWorkspace, autoSearch: AutoSearch) => void;
  onSelectWorkspace: (id: string) => void;
}

export default function HomeScreen({ profiles, workspaces, onWorkspaceCreated, onSelectWorkspace }: Props) {
  const [selectedCategory, setSelectedCategory] = useState<SearchCategory>("accommodation");
  const [selectedIntent, setSelectedIntent] = useState<string | null>(null);
  const [destination, setDestination] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const defaultProfile = profiles.find((p) => p.isDefault) ?? profiles[0] ?? null;
  const personaInfo = defaultProfile ? TYPE_INFO[defaultProfile.enneagramType] : null;
  const activeTrip = workspaces[0] ?? null;

  // Collect all saved options across workspaces for the saved panel
  const allSaved = workspaces.flatMap((w) => w.savedOptions).slice(0, 3);

  async function handleSearch() {
    if (!destination.trim() || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const chip = [...VIBE_CHIPS_PRIMARY, ...VIBE_CHIPS_SECONDARY].find((c) => c.intent === selectedIntent);
      const tripName = chip
        ? `${destination.trim()} · ${chip.label}`
        : destination.trim();

      const wsRes = await fetchWithAuth("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: tripName,
          destination: destination.trim(),
          travelers: profiles.length > 0 ? [profiles[0].id] : [],
        }),
      });
      if (!wsRes.ok) throw new Error("Couldn't create trip — please try again.");
      const workspace: TripWorkspace = await wsRes.json();

      onWorkspaceCreated(workspace, {
        workspaceId: workspace.id,
        query: destination.trim(),
        category: selectedCategory,
        ...(selectedIntent ? { intent: selectedIntent } : {}),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setSubmitting(false);
    }
  }

  function openSearch(intent?: string) {
    if (intent) setSelectedIntent(intent);
  }

  // ── New user state ──────────────────────────────────────────────────────
  if (workspaces.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-5 py-10 text-center" style={{ background: "var(--color-canvas)" }}>
        <div style={{ width: "100%", maxWidth: 480 }}>

          {/* Persona eyebrow */}
          {personaInfo && (
            <p className="text-xs font-semibold uppercase tracking-wider text-[#C4956A] mb-3" style={{ letterSpacing: "0.08em" }}>
              {personaInfo.name}
            </p>
          )}

          {/* Serif identity statement */}
          <p
            className="font-medium text-[#2C3E50] leading-snug mb-2"
            style={{ fontFamily: 'var(--font-lora, "Lora", Georgia, serif)', fontSize: 28, lineHeight: 1.35 }}
          >
            {personaInfo?.descriptor ?? "Travel that fits who you are."}
          </p>

          {/* Subtitle */}
          <p className="text-sm text-[#888888] mb-6">Going somewhere?</p>

          {/* Category picker */}
          <div className="flex items-center justify-center gap-6 mb-6">
            {CATEGORIES.map(({ value, label, Icon }) => (
              <button
                key={value}
                className="flex flex-col items-center gap-2"
                onClick={() => setSelectedCategory(value)}
              >
                <div
                  className="flex items-center justify-center rounded-full transition-all"
                  style={{
                    width: 44,
                    height: 44,
                    background: selectedCategory === value ? "#2C3E50" : "#FAF8F5",
                    border: `1px solid ${selectedCategory === value ? "#2C3E50" : "#E8E8E8"}`,
                    color: selectedCategory === value ? "#fff" : "#2C3E50",
                  }}
                >
                  <Icon />
                </div>
                <span className="text-xs" style={{ color: selectedCategory === value ? "#2C3E50" : "#888888" }}>{label}</span>
              </button>
            ))}
          </div>

          {/* Search — always visible */}
          <div style={{ maxWidth: 400, margin: "0 auto" }}>
            <div className="flex gap-2">
              <input
                className="flex-1 border border-[#E8E8E8] rounded-full px-4 py-3 text-sm text-[#1A1A1A] placeholder:text-[#888888] focus:outline-none focus:border-[#2C3E50] bg-white"
                placeholder="Where to?"
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                disabled={submitting}
                style={{ background: "#fff" }}
              />
              <button
                className="bg-[#2C3E50] text-white text-sm font-semibold rounded-full px-5 disabled:opacity-40 transition-opacity hover:opacity-90"
                onClick={handleSearch}
                disabled={submitting || !destination.trim()}
              >
                {submitting ? "…" : "Go"}
              </button>
            </div>
            {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
          </div>

          {/* Intent chips — below search bar */}
          <div className="flex flex-wrap justify-center gap-2 mt-5" style={{ maxWidth: 440, margin: "20px auto 0" }}>
            {[...VIBE_CHIPS_PRIMARY, ...VIBE_CHIPS_SECONDARY].map((chip) => (
              <button
                key={chip.label}
                className="border rounded-full text-sm transition-all"
                style={{
                  padding: "8px 15px",
                  border: `1px solid ${selectedIntent === chip.intent ? "#C4956A" : "#2C3E50"}`,
                  background: selectedIntent === chip.intent ? "#C4956A" : "transparent",
                  color: selectedIntent === chip.intent ? "#fff" : "#2C3E50",
                }}
                onClick={() => openSearch(chip.intent)}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Returning user state ────────────────────────────────────────────────
  const hasSaves = activeTrip && activeTrip.savedOptions.length > 0;

  return (
    <div className="flex flex-col items-center justify-center h-full px-5 py-10" style={{ background: "var(--color-canvas)" }}>
      <div style={{ width: "100%", maxWidth: 480 }}>

        {/* Active trip card */}
        {activeTrip && (
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#888888] mb-3" style={{ letterSpacing: "0.08em" }}>
              Active trip
            </p>
            <div
              className="rounded-xl p-4 bg-white"
              style={{
                border: hasSaves ? "1px solid #C4956A" : "1px solid #E8E8E8",
                borderLeft: hasSaves ? "3px solid #C4956A" : "1px solid #E8E8E8",
              }}
            >
              <p
                className="font-medium text-[#2C3E50]"
                style={{ fontFamily: 'var(--font-lora, "Lora", Georgia, serif)', fontSize: 16 }}
              >
                {activeTrip.destination || activeTrip.name}
              </p>
              {hasSaves && (
                <p className="text-xs text-[#C4956A] mt-1">
                  {activeTrip.savedOptions.length} saved · ready to review
                </p>
              )}
              {!hasSaves && (
                <p className="text-sm text-[#888888] mt-1">Just started</p>
              )}
              <button
                className="text-sm font-medium text-[#2C3E50] underline mt-2 transition-opacity hover:opacity-70"
                onClick={() => onSelectWorkspace(activeTrip.id)}
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* Saved items preview */}
        {allSaved.length > 0 && (
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#888888] mb-3" style={{ letterSpacing: "0.08em" }}>
              Saved
            </p>
            <div className="flex gap-2 flex-wrap">
              {allSaved.map((item) => (
                <div
                  key={item.id}
                  className="border border-[#E8E8E8] rounded-lg bg-white flex items-center justify-center px-3"
                  style={{ height: 52, minWidth: 90 }}
                >
                  <span className="text-xs text-[#888888] truncate">{item.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* New search prompt */}
        <div className="pt-5 border-t border-[#E8E8E8]">
          <p
            className="font-medium text-[#2C3E50] mb-4 text-center"
            style={{ fontFamily: 'var(--font-lora, "Lora", Georgia, serif)', fontSize: 20 }}
          >
            {activeTrip?.destination
              ? `Still thinking about ${activeTrip.destination}?`
              : "No trip yet — where to next?"}
          </p>

          <div className="flex gap-2" style={{ maxWidth: 400, margin: "0 auto 16px" }}>
            <input
              className="flex-1 border border-[#E8E8E8] rounded-full px-4 py-3 text-sm text-[#1A1A1A] placeholder:text-[#888888] focus:outline-none focus:border-[#2C3E50] bg-white"
              placeholder="Where to?"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              disabled={submitting}
            />
            <button
              className="bg-[#2C3E50] text-white text-sm font-semibold rounded-full px-5 disabled:opacity-40 transition-opacity hover:opacity-90"
              onClick={handleSearch}
              disabled={submitting || !destination.trim()}
            >
              {submitting ? "…" : "Go"}
            </button>
          </div>
          {error && <p className="text-red-500 text-xs mt-1 text-center">{error}</p>}

          {/* Intent chips */}
          <div className="flex flex-wrap justify-center gap-2 mt-2">
            {[...VIBE_CHIPS_PRIMARY, ...VIBE_CHIPS_SECONDARY].map((chip) => (
              <button
                key={chip.label}
                className="border rounded-full text-sm transition-all"
                style={{
                  padding: "7px 14px",
                  border: `1px solid ${selectedIntent === chip.intent ? "#C4956A" : "#E8E8E8"}`,
                  background: selectedIntent === chip.intent ? "#C4956A" : "#fff",
                  color: selectedIntent === chip.intent ? "#fff" : "#888888",
                }}
                onClick={() => openSearch(chip.intent)}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
