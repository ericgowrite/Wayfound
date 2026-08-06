"use client";
import { useState } from "react";

const CATEGORY_META = {
  accommodation: { label: "Accommodation" },
  tour: { label: "Tour" },
  restaurant: { label: "Restaurant" },
  activity: { label: "Activity" },
  attraction: { label: "Attraction" },
};

type Cat = keyof typeof CATEGORY_META;

const MOCK_RESULTS = [
  {
    id: "1",
    name: "Hacienda AltaGracia",
    judgment: "Deeply calm, rooted in land — exactly the antidote to your usual pace",
  },
  {
    id: "2",
    name: "Kura Design Villas",
    judgment: "Architectural drama with restraint — rare to find both this far off the grid",
  },
  {
    id: "3",
    name: "Nayara Springs",
    judgment: "Private-pool intimacy without the scene — fits how you prefer to decompress",
  },
];

function CategoryIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

export default function SearchFilterPreview() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<Cat>("accommodation");
  const [state, setState] = useState<"empty" | "loading" | "results" | "no-results">("empty");

  const cats = Object.keys(CATEGORY_META) as Cat[];

  return (
    <div style={{ minHeight: "100vh", background: "#F5F4F0", fontFamily: "var(--font-encode), ui-sans-serif, system-ui, sans-serif" }}>
      <div style={{ maxWidth: 700, margin: "0 auto", padding: "48px 24px" }}>

        {/* State switcher */}
        <div style={{ display: "flex", gap: 8, marginBottom: 32 }}>
          {(["empty", "loading", "results", "no-results"] as const).map(s => (
            <button key={s} onClick={() => setState(s)} style={{ border: `1px solid ${state === s ? "#2C3E50" : "#E8E8E8"}`, borderRadius: 999, padding: "6px 12px", fontSize: 12, color: state === s ? "#2C3E50" : "#888888", background: "#fff", cursor: "pointer" }}>
              {s}
            </button>
          ))}
        </div>

        {/* Search bar */}
        <div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input
              style={{ flex: 1, border: "1px solid #2C3E50", borderRadius: 999, padding: "12px 18px", fontSize: 14, color: "#1A1A1A", outline: "none", fontFamily: "var(--font-encode), ui-sans-serif, system-ui, sans-serif", background: "#fff" }}
              placeholder="Search Costa Rica…"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
            <button
              style={{ background: "#2C3E50", color: "#fff", borderRadius: 999, padding: "12px 20px", fontSize: 14, fontWeight: 600, border: "none", cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}
            >
              Search
            </button>
          </div>
          {/* Category chips */}
          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            {cats.map(cat => {
              const isActive = category === cat;
              return (
                <button key={cat} onClick={() => setCategory(cat)} style={{ border: `1px solid ${isActive ? "#2C3E50" : "#E8E8E8"}`, borderRadius: 999, padding: "8px 14px", fontSize: 13, color: isActive ? "#2C3E50" : "#888888", background: "#fff", cursor: "pointer", fontWeight: isActive ? 600 : 400 }}>
                  {CATEGORY_META[cat].label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content area */}
        <div style={{ marginTop: 32 }}>

          {/* Loading state */}
          {state === "loading" && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "64px 24px", textAlign: "center" }}>
              <div style={{ marginBottom: 24 }}>
                <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#2C3E50" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </div>
              <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#C4956A", marginBottom: 12 }}>
                While you wait
              </p>
              <p style={{ fontFamily: 'var(--font-noto-serif), Georgia, ui-serif, serif', fontSize: 18, lineHeight: 1.6, color: "#2C3E50", maxWidth: 320 }}>
                Costa Rica has more biodiversity per square kilometer than almost anywhere else on Earth.
              </p>
              <p style={{ fontSize: 13, color: "#888888", marginTop: 24 }}>
                This may take 15–30 seconds
              </p>
            </div>
          )}

          {/* Results */}
          {state === "results" && (
            <div>
              {MOCK_RESULTS.map(r => (
                <div key={r.id} style={{ display: "flex", gap: 14, padding: "16px 0", borderBottom: "1px solid #E8E8E8" }}>
                  <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#F5F4F0", border: "1px solid #E8E8E8", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "#2C3E50", marginTop: 2 }}>
                    <CategoryIcon size={13} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "#2C3E50", lineHeight: 1.3 }}>{r.name}</div>
                    <div style={{ fontFamily: 'var(--font-noto-serif), Georgia, ui-serif, serif', fontSize: 14, color: "#1A1A1A", marginTop: 4, lineHeight: 1.4 }}>
                      &ldquo;{r.judgment}&rdquo;
                    </div>
                    <div style={{ display: "flex", gap: 16, marginTop: 10 }}>
                      <button style={{ fontSize: 13, color: "#888888", textDecoration: "underline", background: "none", border: "none", padding: 0, cursor: "pointer" }}>See why →</button>
                      <button style={{ fontSize: 13, color: "#888888", textDecoration: "underline", background: "none", border: "none", padding: 0, cursor: "pointer" }}>Ask Wayfound →</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* No results */}
          {state === "no-results" && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "64px 0", textAlign: "center" }}>
              <p style={{ fontFamily: 'var(--font-noto-serif), Georgia, ui-serif, serif', fontSize: 19, fontWeight: 500, color: "#2C3E50" }}>
                Nothing quite fits that yet.
              </p>
              <p style={{ fontSize: 13, color: "#888888", marginTop: 8 }}>
                Try a different search or adjust your filters.
              </p>
            </div>
          )}

          {/* Empty (initial) */}
          {state === "empty" && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "64px 0", textAlign: "center" }}>
              <p style={{ fontFamily: 'var(--font-noto-serif), Georgia, ui-serif, serif', fontSize: 19, fontWeight: 500, color: "#2C3E50" }}>
                What are you looking for in Costa Rica?
              </p>
              <p style={{ fontSize: 13, color: "#888888", marginTop: 8 }}>
                Try &quot;boutique eco resort&quot; or &quot;rooftop restaurant with a view&quot;
              </p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
