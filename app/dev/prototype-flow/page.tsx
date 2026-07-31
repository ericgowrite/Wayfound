"use client";
import { useEffect, useState } from "react";

type Screen = "home" | "loading" | "search" | "card" | "deepdive" | "profile";

function HouseIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 20V9.5l8-5.5 8 5.5V20" />
      <path d="M3 20h18" />
      <rect x="9.5" y="13" width="5" height="7" />
    </svg>
  );
}

function SearchIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-4.5-4.5" />
    </svg>
  );
}

const SCREEN_LABELS: Record<Screen, string> = {
  home: "Home",
  loading: "Loading",
  search: "Search Results",
  card: "Result Card",
  deepdive: "Deep Dive",
  profile: "Traveler Profile",
};

export default function PrototypeFlow() {
  const [screen, setScreen] = useState<Screen>("home");
  const [cardExpanded, setCardExpanded] = useState(false);

  function goLoading() {
    setScreen("loading");
    setTimeout(() => setScreen("search"), 900);
  }

  function goSearch() { setScreen("search"); setCardExpanded(false); }
  function goHome() { setScreen("home"); setCardExpanded(false); }
  function goCard() { setScreen("card"); }
  function goDeepDive() { setScreen("deepdive"); }
  function goProfile() { setScreen("profile"); }

  return (
    <div style={{ fontFamily: "var(--font-encode), ui-sans-serif, system-ui, sans-serif", color: "#1A1A1A", minHeight: "100vh", background: "#F5F4F0", padding: "56px 40px", display: "flex", flexDirection: "column", alignItems: "center" }}>

      {/* Header */}
      <div style={{ maxWidth: 1200, width: "100%", margin: "0 auto 28px" }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#888888", marginBottom: 6 }}>
          Clickable Prototype
        </div>
        <div style={{ fontFamily: 'var(--font-noto-serif), Georgia, ui-serif, serif', fontSize: 24, color: "#2C3E50" }}>
          Home → Search → Result Card → Deep Dive → Traveler Profile
        </div>
      </div>

      {/* Phone mockup */}
      <div style={{ width: 375, background: "#FFFFFF", borderRadius: 24, overflow: "hidden", boxShadow: "0 20px 50px rgba(26,43,60,0.15)", display: "flex", flexDirection: "column", minHeight: 700 }}>

        {/* Status bar */}
        <div style={{ height: 40, background: "#2C3E50", flexShrink: 0 }} />

        {/* Screen content */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* ── Home ── */}
          {screen === "home" && (
            <div style={{ padding: "32px 24px", flex: 1, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", justifyContent: "center" }}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#C4956A" }}>
                The Harmonist
              </div>
              <div style={{ fontFamily: 'var(--font-noto-serif), Georgia, ui-serif, serif', fontWeight: 500, fontSize: 24, color: "#2C3E50", marginTop: 10 }}>
                The best experiences bring you back to yourself.
              </div>
              <div style={{ fontSize: 13, color: "#888888", marginTop: 8 }}>
                Going somewhere?
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", marginTop: 20 }}>
                {["Reset & recharge", "Somewhere new", "Reconnect"].map(t => (
                  <div key={t} style={{ border: "1px solid #2C3E50", borderRadius: 999, padding: "8px 14px", fontSize: 12, color: "#2C3E50", whiteSpace: "nowrap" }}>
                    {t}
                  </div>
                ))}
              </div>
              <button
                onClick={goLoading}
                style={{ background: "#2C3E50", color: "#fff", textAlign: "center", fontSize: 14, fontWeight: 600, padding: "14px 18px", borderRadius: 999, marginTop: 22, width: "100%", border: "none", cursor: "pointer" }}
              >
                Let&apos;s search →
              </button>
            </div>
          )}

          {/* ── Loading ── */}
          {screen === "loading" && (
            <div style={{ padding: 24, flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
              <div style={{ color: "#2C3E50" }}>
                <SearchIcon size={28} />
              </div>
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "#C4956A", marginTop: 18 }}>
                While you wait
              </div>
              <div style={{ fontFamily: 'var(--font-noto-serif), Georgia, ui-serif, serif', fontSize: 15, lineHeight: 1.6, color: "#2C3E50", marginTop: 12 }}>
                The Etruscans were making wine and olive oil here long before the Romans showed up, and frankly, a lot of the old-timers still talk about it like it was yesterday.
              </div>
              <div style={{ fontSize: 12, color: "#888888", marginTop: 18 }}>
                This may take 15–30 seconds
              </div>
            </div>
          )}

          {/* ── Search Results ── */}
          {screen === "search" && (
            <div style={{ padding: 24, flex: 1, overflowY: "auto" }}>
              <button onClick={goHome} style={{ fontSize: 13, color: "#888888", textDecoration: "underline", background: "none", border: "none", padding: 0, cursor: "pointer" }}>
                ← Back
              </button>
              <div style={{ border: "1px solid #2C3E50", borderRadius: 999, padding: "11px 16px", fontSize: 13, color: "#888888", marginTop: 16 }}>
                Sonoma, next weekend
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 14, overflowX: "auto" }}>
                <div style={{ border: "1px solid #2C3E50", borderRadius: 999, padding: "7px 12px", fontSize: 12, color: "#2C3E50", whiteSpace: "nowrap", fontWeight: 600 }}>
                  Places to stay
                </div>
                <button onClick={goProfile} style={{ border: "1px solid #E8E8E8", borderRadius: 999, padding: "7px 12px", fontSize: 12, color: "#888888", whiteSpace: "nowrap", cursor: "pointer", background: "#fff" }}>
                  Fits both
                </button>
              </div>
              <div style={{ marginTop: 18, borderTop: "1px solid #E8E8E8" }}>
                {[
                  { name: "The Kenwood Inn", judgment: "Quieter than Positano", clickable: true },
                  { name: "The Wythe Hotel", judgment: "Curator city hotel", clickable: false },
                  { name: "Farmhouse Inn", judgment: "Vineyard views, quiet", clickable: false },
                ].map((r, i) => (
                  <div
                    key={r.name}
                    onClick={r.clickable ? goCard : undefined}
                    style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 0", borderBottom: i < 2 ? "1px solid #E8E8E8" : "none", cursor: r.clickable ? "pointer" : "default" }}
                  >
                    <div style={{ width: 24, height: 24, borderRadius: "50%", background: "#F5F4F0", border: "1px solid #E8E8E8", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "#2C3E50" }}>
                      <HouseIcon size={13} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: "#2C3E50" }}>{r.name}</span>
                      <div style={{ fontFamily: 'var(--font-noto-serif), Georgia, ui-serif, serif', fontSize: 13, color: "#1A1A1A", marginTop: 2 }}>
                        &ldquo;{r.judgment}&rdquo;
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Result Card ── */}
          {screen === "card" && (
            <div style={{ padding: 24, flex: 1, overflowY: "auto" }}>
              <button onClick={goSearch} style={{ fontSize: 13, color: "#888888", textDecoration: "underline", background: "none", border: "none", padding: 0, cursor: "pointer" }}>
                ← Back to results
              </button>
              <div style={{ marginTop: 16, cursor: "pointer" }} onClick={() => setCardExpanded(e => !e)}>
                <div style={{ fontSize: 16, fontWeight: 600, color: "#2C3E50" }}>The Kenwood Inn</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 5, color: "#888888" }}>
                  <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#F5F4F0", border: "1px solid #E8E8E8", display: "flex", alignItems: "center", justifyContent: "center", color: "#2C3E50" }}>
                    <HouseIcon size={12} />
                  </div>
                  <span style={{ fontSize: 12 }}>Kenwood, Sonoma</span>
                </div>
                <div style={{ fontFamily: 'var(--font-noto-serif), Georgia, ui-serif, serif', fontWeight: 500, fontSize: 19, lineHeight: 1.5, color: "#2C3E50", marginTop: 14 }}>
                  &ldquo;Quieter than Positano, same quality of light.&rdquo;
                </div>

                {!cardExpanded && (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16, fontSize: 13, color: "#8a4530" }}>
                      <span style={{ color: "#B5654A" }}>▲</span>
                      <span>Books up fast in October</span>
                    </div>
                    <div style={{ fontSize: 13, color: "#888888", textDecoration: "underline", marginTop: 16 }}>See why →</div>
                  </>
                )}

                {cardExpanded && (
                  <>
                    <div style={{ borderLeft: "3px solid #C4956A", paddingLeft: 12, fontSize: 13, lineHeight: 1.6, color: "#1A1A1A", marginTop: 18 }}>
                      This is the kind of place you stop checking your phone. Slow mornings, no crowd noise, a pool you&apos;ll actually use.
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); goDeepDive(); }}
                      style={{ background: "#2C3E50", color: "#fff", textAlign: "center", fontSize: 14, fontWeight: 500, padding: 12, borderRadius: 4, marginTop: 18, width: "100%", border: "none", cursor: "pointer" }}
                    >
                      See why this fits you →
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* ── Deep Dive ── */}
          {screen === "deepdive" && (
            <div style={{ padding: 24, flex: 1, overflowY: "auto" }}>
              <button onClick={goCard} style={{ fontSize: 13, color: "#888888", textDecoration: "underline", background: "none", border: "none", padding: 0, cursor: "pointer" }}>
                ← Back to results
              </button>
              <div style={{ fontSize: 16, fontWeight: 600, color: "#2C3E50", marginTop: 16 }}>The Kenwood Inn</div>
              <div style={{ fontFamily: 'var(--font-noto-serif), Georgia, ui-serif, serif', fontWeight: 500, fontSize: 19, lineHeight: 1.5, color: "#2C3E50", marginTop: 12 }}>
                &ldquo;Quieter than Positano, same quality of light.&rdquo;
              </div>
              <div style={{ borderLeft: "3px solid #C4956A", paddingLeft: 12, fontSize: 13, lineHeight: 1.6, color: "#1A1A1A", marginTop: 18 }}>
                This is the kind of place you stop checking your phone. Slow mornings, no crowd noise, a pool you&apos;ll actually use.
              </div>
              <div style={{ marginTop: 20 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#2C3E50" }}>Why this fits you</div>
                <div style={{ fontSize: 13, color: "#1A1A1A", lineHeight: 1.7, marginTop: 6 }}>
                  · Quiet mornings, no rush<br />
                  · A pool you&apos;ll actually use<br />
                  · Walkable to the vineyard you mentioned
                </div>
              </div>
              <div style={{ borderTop: "1px solid #E8E8E8", marginTop: 20, paddingTop: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#8a4530" }}>Watch out for</div>
                <div style={{ fontSize: 13, color: "#1A1A1A", lineHeight: 1.6, marginTop: 6 }}>
                  ▲ Books up fast in October
                </div>
              </div>
            </div>
          )}

          {/* ── Traveler Profile ── */}
          {screen === "profile" && (
            <div style={{ padding: 24, flex: 1, overflowY: "auto" }}>
              <button onClick={goSearch} style={{ fontSize: 13, color: "#888888", textDecoration: "underline", background: "none", border: "none", padding: 0, cursor: "pointer" }}>
                ← Back
              </button>
              <div style={{ fontFamily: 'var(--font-noto-serif), Georgia, ui-serif, serif', fontWeight: 600, fontSize: 20, color: "#2C3E50", marginTop: 16 }}>
                Your traits
              </div>
              <div style={{ fontSize: 12, color: "#888888", marginTop: 2 }}>The Harmonist</div>
              <div style={{ marginTop: 18 }}>
                {[
                  { label: "Values calm over crowds", on: true },
                  { label: "Prefers unplanned time", on: true },
                  { label: "Chases novelty", on: false },
                ].map((trait, i, arr) => (
                  <div key={trait.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 13, padding: "11px 0", borderBottom: i < arr.length - 1 ? "1px solid #E8E8E8" : "none", color: trait.on ? "#1A1A1A" : "#888888" }}>
                    <span>{trait.label}</span>
                    <span style={{ fontSize: 12, color: trait.on ? "#2C3E50" : "#888888" }}>{trait.on ? "On" : "Off"}</span>
                  </div>
                ))}
                <div style={{ fontSize: 12, color: "#888888", textDecoration: "underline", marginTop: 12, cursor: "pointer" }}>+ Add a trait</div>
              </div>
              <div style={{ borderTop: "1px solid #E8E8E8", marginTop: 20, paddingTop: 18 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#2C3E50" }}>This trip: with Sam</div>
                <div style={{ fontSize: 12, color: "#888888", marginTop: 8 }}>Weighing results against:</div>
                <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                  <div style={{ border: "1px solid #2C3E50", borderRadius: 999, padding: "6px 12px", fontSize: 12, color: "#2C3E50" }}>Sam</div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Screen label bar */}
        <div style={{ padding: "12px 24px", borderTop: "1px solid #E8E8E8", flexShrink: 0 }}>
          <div style={{ fontSize: 11, color: "#888888", textAlign: "center" }}>
            Screen: {SCREEN_LABELS[screen]}
          </div>
        </div>
      </div>
    </div>
  );
}
