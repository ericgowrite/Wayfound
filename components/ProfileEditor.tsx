"use client";

import { useState } from "react";
import { Profile, AxisWeights } from "@/types";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import { TYPE_INFO } from "@/lib/typeInfo";
import { isCalibrationSuppressed } from "@/lib/typeCalibration";

const PRESET_TRAITS = [
  "Prefers to eat local, not touristy",
  "Likes a plan, not just a vibe",
  "Wants downtime built in",
  "Values design & atmosphere",
  "Avoids tourist traps",
  "Prefers boutique over chain",
  "Skips the itinerary",
  "Needs good coffee nearby",
];

interface Props {
  profile: Profile;
  onSave: (p: Profile) => void;
  onClose: () => void;
  onRetakeAssessment?: () => void;
  onCalibrate?: () => void;
  workspaceProfiles?: Profile[];
}

type View = "main" | "add-trait";

export default function ProfileEditor({ profile, onSave, onClose, onRetakeAssessment, onCalibrate, workspaceProfiles }: Props) {
  const [draft, setDraft] = useState<Profile>(JSON.parse(JSON.stringify(profile)));
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState<View>("main");
  const [selectedPresets, setSelectedPresets] = useState<string[]>([]);

  const typeInfo = TYPE_INFO[draft.enneagramType ?? ""];
  const suppressed = isCalibrationSuppressed(draft.lastCalibratedAt);

  function removeDealbreaker(i: number) {
    setDraft((d) => ({ ...d, dealbreakers: d.dealbreakers.filter((_, idx) => idx !== i) }));
  }

  function togglePreset(trait: string) {
    setSelectedPresets(prev => prev.includes(trait) ? prev.filter(t => t !== trait) : [...prev, trait]);
  }

  async function handleSave(overrideDraft?: Profile) {
    const toSave = overrideDraft ?? draft;
    setSaving(true);
    try {
      const res = await fetchWithAuth(`/api/profiles/${toSave.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toSave),
      });
      const updated = await res.json();
      onSave(updated);
    } finally {
      setSaving(false);
    }
  }

  async function saveAndClose() {
    await handleSave();
    onClose();
  }

  async function saveTraits() {
    if (selectedPresets.length === 0) { setView("main"); return; }
    const newDraft = { ...draft, dealbreakers: [...draft.dealbreakers, ...selectedPresets] };
    setDraft(newDraft);
    setSelectedPresets([]);
    setView("main");
    await handleSave(newDraft);
  }

  const availablePresets = PRESET_TRAITS.filter(t => !draft.dealbreakers.includes(t) && !(typeInfo?.bullets ?? []).includes(t));

  const otherAxisKey = Object.keys(draft.axisWeights ?? {}).find(
    (k) => (draft.axisWeights[k as keyof AxisWeights] ?? 0.5) < 0.35
  ) as keyof AxisWeights | undefined;

  const offTraitLabel = otherAxisKey === "novelty"
    ? "Chases novelty"
    : otherAxisKey === "calm"
    ? "Needs high stimulation"
    : otherAxisKey === "autonomy"
    ? "Prefers guided itineraries"
    : null;

  if (view === "add-trait") {
    return (
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}>
        <div style={{ background: "#FFFFFF", border: "1px solid #E8E8E8", borderRadius: 4, padding: "28px 32px", width: "100%", maxWidth: 520, fontFamily: "'Inter', sans-serif" }}>

          <button
            onClick={() => { setView("main"); setSelectedPresets([]); }}
            style={{ fontSize: 13, color: "#888888", textDecoration: "underline", background: "none", border: "none", padding: 0, cursor: "pointer" }}
          >
            ← Back
          </button>

          <div style={{ fontFamily: '"Lora", serif', fontWeight: 600, fontSize: 20, color: "#2C3E50", marginTop: 16 }}>
            Anything else that&apos;s true for you?
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 20 }}>
            {availablePresets.map(trait => {
              const selected = selectedPresets.includes(trait);
              return (
                <button
                  key={trait}
                  onClick={() => togglePreset(trait)}
                  style={{
                    border: `1px solid ${selected ? "#C4956A" : "#2C3E50"}`,
                    borderRadius: 999,
                    padding: "9px 16px",
                    fontSize: 13,
                    color: selected ? "#C4956A" : "#2C3E50",
                    background: selected ? "#FDF8F4" : "#FFFFFF",
                    cursor: "pointer",
                    fontFamily: "'Inter', sans-serif",
                  }}
                >
                  {trait}
                </button>
              );
            })}
            {availablePresets.length === 0 && (
              <p style={{ fontSize: 13, color: "#888888" }}>All traits already added.</p>
            )}
          </div>

          <button
            onClick={saveTraits}
            disabled={saving}
            style={{ background: "#2C3E50", color: "#fff", textAlign: "center", fontSize: 14, fontWeight: 500, padding: 13, borderRadius: 999, marginTop: 24, width: 200, border: "none", cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1, display: "block" }}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}>
      <div style={{ background: "#FFFFFF", border: "1px solid #E8E8E8", borderRadius: 4, padding: "28px 32px", width: "100%", maxWidth: 600, fontFamily: "'Inter', sans-serif", maxHeight: "90vh", overflowY: "auto" }}>

        {/* Header row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            {typeInfo && (
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#C4956A" }}>
                {typeInfo.name}
              </div>
            )}
            <div style={{ fontFamily: '"Lora", serif', fontWeight: 600, fontSize: 22, color: "#2C3E50", marginTop: 4 }}>
              {draft.name}&apos;s traits
            </div>
          </div>
          <button
            onClick={saveAndClose}
            style={{ fontSize: 20, color: "#9BB0C1", background: "none", border: "none", cursor: "pointer", lineHeight: 1, padding: 0, marginLeft: 16, flexShrink: 0 }}
          >
            ×
          </button>
        </div>

        {/* Two-column layout */}
        <div style={{ display: "flex", gap: 40, marginTop: 24 }}>

          {/* Trait list */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {(typeInfo?.bullets ?? []).map((bullet, i) => (
              <div
                key={i}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 14, padding: "12px 0", borderBottom: "1px solid #E8E8E8" }}
              >
                <span style={{ color: "#1A1A1A" }}>{bullet}</span>
                <span style={{ fontSize: 13, color: "#2C3E50", flexShrink: 0, marginLeft: 12 }}>On</span>
              </div>
            ))}

            {draft.dealbreakers.map((d, i) => (
              <div
                key={i}
                className="group"
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 14, padding: "12px 0", borderBottom: "1px solid #E8E8E8" }}
              >
                <span style={{ color: "#1A1A1A" }}>{d}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0, marginLeft: 12 }}>
                  <span style={{ fontSize: 13, color: "#2C3E50" }}>On</span>
                  <button
                    className="opacity-0 group-hover:opacity-100"
                    onClick={() => removeDealbreaker(i)}
                    style={{ fontSize: 14, color: "#888888", background: "none", border: "none", cursor: "pointer", padding: 0, lineHeight: 1 }}
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}

            {offTraitLabel && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 14, padding: "12px 0", borderBottom: "1px solid #E8E8E8", color: "#888888" }}>
                <span>{offTraitLabel}</span>
                <span style={{ fontSize: 13 }}>Off</span>
              </div>
            )}

            <button
              onClick={() => setView("add-trait")}
              style={{ fontSize: 13, color: "#888888", textDecoration: "underline", background: "none", border: "none", padding: 0, cursor: "pointer", marginTop: 14 }}
            >
              + Add a trait
            </button>

            {/* Calibrate / retake links */}
            <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 6 }}>
              {onCalibrate && !suppressed && (
                <button
                  onClick={onCalibrate}
                  style={{ fontSize: 12, color: "#888888", textDecoration: "underline", background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }}
                >
                  Refine your experience style →
                </button>
              )}
              {onRetakeAssessment && (
                <button
                  onClick={onRetakeAssessment}
                  style={{ fontSize: 12, color: "#888888", textDecoration: "underline", background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }}
                >
                  Update travel style →
                </button>
              )}
            </div>
          </div>

          {/* Right panel — co-travelers */}
          {workspaceProfiles && workspaceProfiles.length > 0 && (
            <div style={{ width: 200, flexShrink: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#2C3E50" }}>
                This trip
              </div>
              <div style={{ fontSize: 12, color: "#888888", marginTop: 8 }}>Weighing results against:</div>
              <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                {workspaceProfiles.map(p => (
                  <div
                    key={p.id}
                    style={{ border: "1px solid #2C3E50", borderRadius: 999, padding: "6px 12px", fontSize: 12, color: "#2C3E50" }}
                  >
                    {p.name}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
