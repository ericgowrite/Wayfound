"use client";
import { useState } from "react";

const PRESET_TRAITS = [
  "Prefers to eat local, not touristy",
  "Likes a plan, not just a vibe",
  "Wants downtime built in",
  "Values design & atmosphere",
  "Avoids tourist traps",
  "Prefers boutique over chain",
];

const MOCK_BULLETS = [
  "Values calm over crowds",
  "Prefers unplanned time",
  "Drawn to places with character",
];

export default function TripsDashboardPreviewClient() {
  const [view, setView] = useState<"main" | "add-trait">("main");
  const [dealbreakers, setDealbreakers] = useState<string[]>([]);
  const [selectedPresets, setSelectedPresets] = useState<string[]>([]);

  function togglePreset(t: string) {
    setSelectedPresets(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  }

  function saveTraits() {
    setDealbreakers(prev => [...prev, ...selectedPresets]);
    setSelectedPresets([]);
    setView("main");
  }

  const available = PRESET_TRAITS.filter(t => !dealbreakers.includes(t));

  if (view === "add-trait") {
    return (
      <div style={{ minHeight: "100vh", background: "#F5F4F0", display: "flex", alignItems: "center", justifyContent: "center", padding: 40, fontFamily: "'Inter', sans-serif" }}>
        <div style={{ background: "#FFFFFF", border: "1px solid #E8E8E8", borderRadius: 4, padding: "28px 32px", width: "100%", maxWidth: 520 }}>
          <button onClick={() => { setView("main"); setSelectedPresets([]); }} style={{ fontSize: 13, color: "#888888", textDecoration: "underline", background: "none", border: "none", padding: 0, cursor: "pointer" }}>
            ← Back
          </button>
          <div style={{ fontFamily: '"Lora", serif', fontWeight: 600, fontSize: 20, color: "#2C3E50", marginTop: 16 }}>
            Anything else that&apos;s true for you?
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 20 }}>
            {available.map(t => {
              const sel = selectedPresets.includes(t);
              return (
                <button key={t} onClick={() => togglePreset(t)} style={{ border: `1px solid ${sel ? "#C4956A" : "#2C3E50"}`, borderRadius: 999, padding: "9px 16px", fontSize: 13, color: sel ? "#C4956A" : "#2C3E50", background: sel ? "#FDF8F4" : "#FFF", cursor: "pointer" }}>
                  {t}
                </button>
              );
            })}
          </div>
          <button onClick={saveTraits} style={{ background: "#2C3E50", color: "#fff", fontSize: 14, fontWeight: 500, padding: 13, borderRadius: 999, marginTop: 24, width: 200, border: "none", cursor: "pointer", display: "block", textAlign: "center" }}>
            Save
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#F5F4F0", display: "flex", alignItems: "center", justifyContent: "center", padding: 40, fontFamily: "'Inter', sans-serif" }}>
      <div style={{ background: "#FFFFFF", border: "1px solid #E8E8E8", borderRadius: 4, padding: "28px 32px", width: "100%", maxWidth: 600 }}>

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#C4956A" }}>The Harmonist</div>
            <div style={{ fontFamily: '"Lora", serif', fontWeight: 600, fontSize: 22, color: "#2C3E50", marginTop: 4 }}>Your traits</div>
          </div>
          <button style={{ fontSize: 20, color: "#9BB0C1", background: "none", border: "none", cursor: "pointer", lineHeight: 1, padding: 0 }}>×</button>
        </div>

        {/* Two-column layout */}
        <div style={{ display: "flex", gap: 40, marginTop: 24 }}>

          {/* Trait list */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {MOCK_BULLETS.map((b, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 14, padding: "12px 0", borderBottom: "1px solid #E8E8E8" }}>
                <span>{b}</span>
                <span style={{ fontSize: 13, color: "#2C3E50", flexShrink: 0, marginLeft: 12 }}>On</span>
              </div>
            ))}

            {dealbreakers.map((d, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 14, padding: "12px 0", borderBottom: "1px solid #E8E8E8" }}>
                <span>{d}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, marginLeft: 12 }}>
                  <span style={{ fontSize: 13, color: "#2C3E50" }}>On</span>
                  <button onClick={() => setDealbreakers(prev => prev.filter((_, idx) => idx !== i))} style={{ fontSize: 14, color: "#888888", background: "none", border: "none", cursor: "pointer", padding: 0, lineHeight: 1 }}>×</button>
                </div>
              </div>
            ))}

            {/* Example "Off" trait */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 14, padding: "12px 0", borderBottom: "1px solid #E8E8E8", color: "#888888" }}>
              <span>Chases novelty</span>
              <span style={{ fontSize: 13 }}>Off</span>
            </div>

            <button onClick={() => setView("add-trait")} style={{ fontSize: 13, color: "#888888", textDecoration: "underline", background: "none", border: "none", padding: 0, cursor: "pointer", marginTop: 14 }}>
              + Add a trait
            </button>
          </div>

          {/* Right panel */}
          <div style={{ width: 200, flexShrink: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#2C3E50" }}>This trip: with Sam</div>
            <div style={{ fontSize: 12, color: "#888888", marginTop: 8 }}>Weighing results against:</div>
            <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
              <div style={{ border: "1px solid #2C3E50", borderRadius: 999, padding: "6px 12px", fontSize: 12, color: "#2C3E50" }}>Sam</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
