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
  const [searchOpen, setSearchOpen] = useState(false);
  const [destination, setDestination] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [chipsExpanded, setChipsExpanded] = useState(false);

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
    setSearchOpen(true);
  }

  // ── New user state ──────────────────────────────────────────────────────
  if (workspaces.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-6 py-12 text-center">
        <div style={{ width: "100%", maxWidth: 480 }}>

          {/* Persona eyebrow */}
          {personaInfo && (
            <p className="text-xs font-semibold uppercase tracking-wider text-[#C4956A] mb-3">
              {personaInfo.name}
            </p>
          )}

          {/* Serif quote */}
          <p
            className="font-medium text-[#2C3E50] leading-snug mb-2"
            style={{ fontFamily: 'var(--font-lora, "Lora", Georgia, serif)', fontSize: 30 }}
          >
            {personaInfo?.descriptor ?? "Travel that fits who you are."}
          </p>

          {/* Subtitle */}
          <p className="text-sm text-[#888888] mb-7">Going somewhere?</p>

          {/* Category picker */}
          <div className="flex items-center justify-center gap-6 mb-7">
            {CATEGORIES.map(({ value, label, Icon }) => (
              <button
                key={value}
                className="flex flex-col items-center gap-2"
                onClick={() => setSelectedCategory(value)}
              >
                <div
                  className="flex items-center justify-center rounded-full text-[#2C3E50] transition-all"
                  style={{
                    width: 44,
                    height: 44,
                    background: selectedCategory === value ? "#2C3E50" : "#F5F4F0",
                    border: "1px solid #E8E8E8",
                    color: selectedCategory === value ? "#fff" : "#2C3E50",
                  }}
                >
                  <Icon />
                </div>
                <span className="text-xs text-[#888888]">{label}</span>
              </button>
            ))}
          </div>

          {/* Search input — shown after CTA click */}
          {searchOpen ? (
            <div className="mb-6">
              <div className="flex gap-2">
                <input
                  autoFocus
                  className="flex-1 border border-[#E8E8E8] rounded-full px-4 py-3 text-sm text-[#1A1A1A] placeholder:text-[#888888] focus:outline-none focus:border-[#2C3E50]"
                  placeholder="Where to?"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  disabled={submitting}
                />
                <button
                  className="bg-[#2C3E50] text-white text-sm font-semibold rounded-full px-5 disabled:opacity-50 transition-opacity hover:opacity-90"
                  onClick={handleSearch}
                  disabled={submitting || !destination.trim()}
                >
                  {submitting ? "…" : "Go"}
                </button>
              </div>
              {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
            </div>
          ) : (
            <button
              className="bg-[#2C3E50] text-white text-sm font-semibold rounded-full w-full transition-opacity hover:opacity-90"
              style={{ maxWidth: 320, paddingTop: 15, paddingBottom: 15 }}
              onClick={() => openSearch()}
            >
              Let&apos;s search →
            </button>
          )}

          {/* "not sure?" divider */}
          <div className="flex items-center gap-3 mt-8" style={{ maxWidth: 420, margin: "32px auto 0" }}>
            <div className="flex-1 h-px bg-[#E8E8E8]" />
            <span className="text-xs uppercase tracking-wider text-[#aaaaaa]" style={{ letterSpacing: "0.06em" }}>not sure?</span>
            <div className="flex-1 h-px bg-[#E8E8E8]" />
          </div>

          {/* Vibe chips */}
          <div className="flex flex-wrap justify-center gap-2.5 mt-4" style={{ maxWidth: 420, margin: "16px auto 0" }}>
            {VIBE_CHIPS_PRIMARY.map((chip) => (
              <button
                key={chip.label}
                className="border rounded-full text-sm text-[#2C3E50] transition-all hover:bg-[#F5F4F0]"
                style={{
                  borderColor: selectedIntent === chip.intent && VIBE_CHIPS_PRIMARY.some(c => c.intent === chip.intent) ? "#2C3E50" : "#2C3E50",
                  padding: "9px 16px",
                  background: selectedIntent === chip.intent ? "#2C3E50" : "transparent",
                  color: selectedIntent === chip.intent ? "#fff" : "#2C3E50",
                }}
                onClick={() => openSearch(chip.intent)}
              >
                {chip.label}
              </button>
            ))}

            {chipsExpanded && VIBE_CHIPS_SECONDARY.map((chip) => (
              <button
                key={chip.label}
                className="border border-[#2C3E50] rounded-full text-sm text-[#2C3E50] transition-all hover:bg-[#F5F4F0]"
                style={{ padding: "9px 16px" }}
                onClick={() => openSearch(chip.intent)}
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* Show more/less toggle */}
          <button
            className="text-xs text-[#888888] underline mt-3 block mx-auto"
            onClick={() => setChipsExpanded((v) => !v)}
          >
            {chipsExpanded ? "Show fewer" : "Show more"}
          </button>
        </div>
      </div>
    );
  }

  // ── Returning user state ────────────────────────────────────────────────
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 py-12">
      <div style={{ width: "100%", maxWidth: 560 }}>

        {/* Active trip card */}
        {activeTrip && (
          <div className="mb-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#888888] mb-3">
              Active trip
            </p>
            <div className="border border-[#E8E8E8] rounded-lg p-4">
              <p
                className="font-medium text-[#2C3E50]"
                style={{ fontFamily: 'var(--font-lora, "Lora", Georgia, serif)', fontSize: 16 }}
              >
                {activeTrip.destination || activeTrip.name}
                {activeTrip.destination && activeTrip.name !== activeTrip.destination
                  ? " · Planning"
                  : ""}
              </p>
              <p className="text-sm text-[#888888] mt-1">
                {activeTrip.savedOptions.length} saved
              </p>
              <button
                className="text-sm text-[#2C3E50] underline mt-2"
                onClick={() => onSelectWorkspace(activeTrip.id)}
              >
                Continue →
              </button>
            </div>
          </div>
        )}

        {/* Saved thumbnails */}
        {allSaved.length > 0 && (
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#888888] mb-3">
              Saved
            </p>
            <div className="flex gap-2">
              {allSaved.map((item) => (
                <div
                  key={item.id}
                  className="border border-[#E8E8E8] rounded flex items-center justify-center px-3"
                  style={{ width: 100, height: 60 }}
                >
                  <span className="text-xs text-[#888888] truncate">{item.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Divider + new search prompt */}
        <div className="border-t border-[#E8E8E8] pt-6 text-center">
          <p
            className="font-medium text-[#2C3E50] mb-4"
            style={{ fontFamily: 'var(--font-lora, "Lora", Georgia, serif)', fontSize: 20 }}
          >
            {activeTrip?.destination
              ? `Still thinking about ${activeTrip.destination}?`
              : "No trip yet — where to next?"}
          </p>

          {searchOpen ? (
            <div>
              <div className="flex gap-2" style={{ maxWidth: 400, margin: "0 auto" }}>
                <input
                  autoFocus
                  className="flex-1 border border-[#E8E8E8] rounded-full px-4 py-3 text-sm text-[#1A1A1A] placeholder:text-[#888888] focus:outline-none focus:border-[#2C3E50]"
                  placeholder="Where to?"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  disabled={submitting}
                />
                <button
                  className="bg-[#2C3E50] text-white text-sm font-semibold rounded-full px-5 disabled:opacity-50 transition-opacity hover:opacity-90"
                  onClick={handleSearch}
                  disabled={submitting || !destination.trim()}
                >
                  {submitting ? "…" : "Go"}
                </button>
              </div>
              {error && <p className="text-red-500 text-xs mt-2">{error}</p>}
            </div>
          ) : (
            <button
              className="bg-[#2C3E50] text-white text-sm font-semibold rounded-full mx-auto block transition-opacity hover:opacity-90"
              style={{ maxWidth: 320, width: "100%", paddingTop: 14, paddingBottom: 14 }}
              onClick={() => setSearchOpen(true)}
            >
              Let&apos;s search →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
