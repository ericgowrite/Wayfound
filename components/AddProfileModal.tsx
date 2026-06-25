"use client";

import { useState } from "react";
import { Profile, ProfileTemplate, AXIS_KEYS, AXIS_LABELS, AXIS_DESCRIPTIONS, AxisWeights } from "@/types";
import { AssessmentResult } from "@/lib/assessment";
import TravelAssessment from "./TravelAssessment";
import templates from "@/src/data/profileTemplates.json";
import { fetchWithAuth } from "@/lib/fetchWithAuth";

const TEMPLATES = templates as ProfileTemplate[];

interface Props {
  onSave: (p: Profile) => void;
  onClose: () => void;
  /** True when the current user is setting up their own profile (first-run or self-edit).
   *  Switches copy from third-person ("Does Eric know their type?") to first-person ("Do you know your type?"). */
  isSelf?: boolean;
}

type Step = "info" | "know-type" | "assess" | "type-select" | "review";

export default function AddProfileModal({ onSave, onClose, isSelf = false }: Props) {
  const [step, setStep] = useState<Step>("info");
  const [name, setName] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [draft, setDraft] = useState<Partial<Profile>>({});
  const [saving, setSaving] = useState(false);
  const [newDealbreaker, setNewDealbreaker] = useState("");

  const template = TEMPLATES.find((t) => t.type === selectedType);

  function handleNameNext() {
    if (!name.trim()) return;
    setStep("know-type");
  }

  function handleTypeConfirmed() {
    if (!template) return;
    setDraft({
      name: name.trim(),
      enneagramType: selectedType,
      description: template.description,
      axisWeights: { ...template.axisWeights },
      thresholds: { ...template.thresholds },
      dealbreakers: [...template.dealbreakers],
    });
    setStep("review");
  }

  function handleAssessmentComplete(result: AssessmentResult) {
    const typeKey = String(result.type);
    const t = TEMPLATES.find((tmpl) => tmpl.type === typeKey) ?? TEMPLATES[0];
    setSelectedType(typeKey);
    setDraft({
      name: name.trim(),
      enneagramType: typeKey,
      description: result.description,
      axisWeights: { ...result.axisWeights },
      thresholds: { ...(t?.thresholds ?? {}) },
      dealbreakers: [...(t?.dealbreakers ?? [])],
    });
    setStep("review");
  }

  function setWeight(key: keyof AxisWeights, val: number) {
    setDraft((d) => ({ ...d, axisWeights: { ...d.axisWeights!, [key]: val } }));
  }

  function addDealbreaker() {
    if (!newDealbreaker.trim()) return;
    setDraft((d) => ({ ...d, dealbreakers: [...(d.dealbreakers ?? []), newDealbreaker.trim()] }));
    setNewDealbreaker("");
  }

  function removeDealbreaker(i: number) {
    setDraft((d) => ({ ...d, dealbreakers: (d.dealbreakers ?? []).filter((_, idx) => idx !== i) }));
  }

  async function handleSave() {
    if (!draft.axisWeights) return;
    setSaving(true);
    try {
      const res = await fetchWithAuth("/api/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const profile: Profile = await res.json();
      onSave(profile);
    } finally {
      setSaving(false);
    }
  }

  const baseTypes = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

  const input = "bg-[#EEF4F8] dark:bg-[#2a3f52] text-[#2C3E50] dark:text-[#B8D4E3] border-[#E0E8ED] dark:border-[#3D5A6E] focus:border-[#5B8BA0]";
  const btnSecondary = "bg-[#E0E8ED] dark:bg-[#3D5A6E] text-[#3D5A6E] dark:text-[#B8D4E3] hover:bg-[#D0DCE4] dark:hover:bg-[#4A7A8F]";

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#1e2d3d] rounded-xl border border-[#E0E8ED] dark:border-[#3D5A6E] w-full max-w-lg max-h-[90vh] overflow-auto">
        <div className="flex justify-between items-center p-4 border-b border-[#E0E8ED] dark:border-[#3D5A6E] sticky top-0 bg-white dark:bg-[#1e2d3d]">
          <h2 className="text-lg font-semibold text-[#2C3E50] dark:text-white">
            {step === "info" && "Add Traveler Profile"}
            {step === "know-type" && (isSelf ? "Find Your Travel Style" : `Find ${name ? name + "'s" : "Their"} Travel Style`)}
            {step === "assess" && "Travel Style Assessment"}
            {step === "type-select" && (isSelf ? "Select Your Type" : `Select ${name ? name + "'s" : "Their"} Type`)}
            {step === "review" && `Review: ${draft.name} (${draft.enneagramType})`}
          </h2>
          <button className="text-[#9BB0C1] hover:text-[#2C3E50] dark:hover:text-white text-2xl leading-none" onClick={onClose}>×</button>
        </div>

        <div className="p-4">
          {/* Step 1: Name */}
          {step === "info" && (
            <div className="space-y-4">
              <div>
                <label className="text-[#6B8299] text-xs uppercase block mb-1">Traveler Name</label>
                <input
                  className={`w-full ${input} text-sm rounded border px-3 py-2 focus:outline-none`}
                  placeholder="Sarah"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleNameNext()}
                  autoFocus
                />
              </div>
            </div>
          )}

          {/* Step 2: Know your type? */}
          {step === "know-type" && (
            <div className="space-y-3">
              <p className="text-[#6B8299] dark:text-[#9BB0C1] text-sm leading-relaxed">
                Everyone travels differently. We use personality-based matching to understand what makes travel feel right for{" "}
                {isSelf
                  ? <span className="font-medium text-[#3D5A6E] dark:text-[#B8D4E3]">you</span>
                  : <span className="font-medium text-[#3D5A6E] dark:text-[#B8D4E3]">{name}</span>
                }.
              </p>
              <p className="text-[#3D5A6E] dark:text-[#B8D4E3] text-sm pt-1">
                {isSelf
                  ? "Do you already know your personality type?"
                  : <>Does <span className="text-[#2C3E50] dark:text-white font-medium">{name}</span> already know their personality type?</>
                }
              </p>
              <div className="flex flex-col gap-2 pt-1">
                <button
                  className="w-full text-left px-4 py-3 rounded-lg border border-[#E0E8ED] dark:border-[#3D5A6E] hover:border-[#5B8BA0] hover:bg-[#5B8BA0]/8 dark:hover:bg-[#5B8BA0]/10 transition-colors"
                  onClick={() => setStep("type-select")}
                >
                  <p className="text-[#2C3E50] dark:text-white text-sm font-medium">{isSelf ? "Yes, I know my type" : "Yes, I know their type"}</p>
                  <p className="text-[#6B8299] text-xs mt-0.5">I&apos;ll pick from the list</p>
                </button>
                <button
                  className="w-full text-left px-4 py-3 rounded-lg border border-[#E0E8ED] dark:border-[#3D5A6E] hover:border-[#5B8BA0] hover:bg-[#5B8BA0]/8 dark:hover:bg-[#5B8BA0]/10 transition-colors"
                  onClick={() => setStep("assess")}
                >
                  <p className="text-[#2C3E50] dark:text-white text-sm font-medium">{isSelf ? "No, help me find out" : "No, help them find out"}</p>
                  <p className="text-[#6B8299] text-xs mt-0.5">Take a quick in-app travel style assessment</p>
                </button>
              </div>
            </div>
          )}

          {/* Step 3: In-app travel style assessment */}
          {step === "assess" && (
            <div className="-mx-4 -mb-4" style={{ minHeight: 460 }}>
              <TravelAssessment
                prefilledName={name.trim()}
                isSelf={isSelf}
                onComplete={handleAssessmentComplete}
                onSkip={() => setStep("type-select")}
              />
            </div>
          )}

          {/* Step 4: Type selector */}
          {step === "type-select" && (
            <div className="space-y-4">
              <div>
                <label className="text-[#6B8299] text-xs uppercase block mb-2">Personality Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {baseTypes.map((base) => {
                    const t = TEMPLATES.find((tmpl) => tmpl.type === base);
                    if (!t) return null;
                    return (
                      <button
                        key={t.type}
                        className={`text-left px-3 py-2 rounded border text-xs transition-colors ${
                          selectedType === t.type
                            ? "border-[#5B8BA0] bg-[#5B8BA0]/8 dark:bg-[#5B8BA0]/15 text-[#5B8BA0] dark:text-[#7DBAD4]"
                            : "border-[#E0E8ED] dark:border-[#3D5A6E] text-[#6B8299] dark:text-[#9BB0C1] hover:border-[#9BB0C1] dark:hover:border-[#9BB0C1] hover:text-[#2C3E50] dark:hover:text-[#B8D4E3]"
                        }`}
                        onClick={() => setSelectedType(t.type)}
                      >
                        <div className="font-semibold">Type {t.type}</div>
                        <div className="text-[#6B8299] text-xs mt-0.5 line-clamp-1">{t.description.split("—")[0].trim()}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
              {selectedType && template && (
                <div className="bg-[#EEF4F8] dark:bg-[#2a3f52] rounded-lg p-3">
                  <p className="text-xs text-[#6B8299] uppercase mb-1">Selected</p>
                  <p className="text-[#2C3E50] dark:text-white font-medium text-sm">Type {selectedType}</p>
                  <p className="text-[#6B8299] dark:text-[#9BB0C1] text-xs mt-0.5">{template.description}</p>
                </div>
              )}
            </div>
          )}

          {step === "review" && draft.axisWeights && (
            <div className="space-y-5">
              <p className="text-[#6B8299] dark:text-[#9BB0C1] text-sm">{draft.description}</p>

              <div>
                <label className="text-[#6B8299] text-xs uppercase block mb-3">Axis Weights — adjust to fit</label>
                <div className="space-y-3">
                  {AXIS_KEYS.map((k) => (
                    <div key={k}>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm text-[#3D5A6E] dark:text-[#B8D4E3]" title={AXIS_DESCRIPTIONS[k]}>
                          {AXIS_LABELS[k]}
                        </span>
                        <span className="text-sm font-mono text-[#6B8299] dark:text-[#9BB0C1]">
                          {(draft.axisWeights![k] ?? 0).toFixed(2)}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={draft.axisWeights![k] ?? 0}
                        onChange={(e) => setWeight(k, parseFloat(e.target.value))}
                        className="w-full accent-[#5B8BA0]"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[#6B8299] text-xs uppercase block mb-2">Dealbreakers</label>
                <div className="space-y-1.5 mb-2">
                  {(draft.dealbreakers ?? []).map((d, i) => (
                    <div key={i} className="flex items-center gap-2 bg-red-50 dark:bg-[#2a3f52] rounded px-2 py-1.5">
                      <span className="text-red-600 dark:text-red-400 text-sm flex-1">{d}</span>
                      <button className="text-[#9BB0C1] hover:text-red-500 dark:hover:text-red-400 text-sm" onClick={() => removeDealbreaker(i)}>×</button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    className={`flex-1 ${input} text-sm rounded border p-2 focus:outline-none`}
                    placeholder="Add dealbreaker..."
                    value={newDealbreaker}
                    onChange={(e) => setNewDealbreaker(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addDealbreaker()}
                  />
                  <button className={`px-3 py-2 ${btnSecondary} text-sm rounded`} onClick={addDealbreaker}>
                    Add
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-[#E0E8ED] dark:border-[#3D5A6E] flex gap-2 justify-between sticky bottom-0 bg-white dark:bg-[#1e2d3d]">
          {step === "info" && (
            <>
              <button className={`px-4 py-2 text-sm rounded ${btnSecondary}`} onClick={onClose}>Cancel</button>
              <button
                className="px-4 py-2 text-sm rounded bg-[#5B8BA0] text-white hover:bg-[#4A7A8F] disabled:opacity-50"
                onClick={handleNameNext}
                disabled={!name.trim()}
              >
                Next →
              </button>
            </>
          )}
          {step === "know-type" && (
            <button className={`px-4 py-2 text-sm rounded ${btnSecondary}`} onClick={() => setStep("info")}>
              ← Back
            </button>
          )}
          {step === "assess" && (
            <button className={`px-4 py-2 text-sm rounded ${btnSecondary}`} onClick={() => setStep("know-type")}>← Back</button>
          )}
          {step === "type-select" && (
            <>
              <button className={`px-4 py-2 text-sm rounded ${btnSecondary}`} onClick={() => setStep("know-type")}>← Back</button>
              <button
                className="px-4 py-2 text-sm rounded bg-[#5B8BA0] text-white hover:bg-[#4A7A8F] disabled:opacity-50"
                onClick={handleTypeConfirmed}
                disabled={!selectedType}
              >
                Review Defaults →
              </button>
            </>
          )}
          {step === "review" && (
            <>
              <button className={`px-4 py-2 text-sm rounded ${btnSecondary}`} onClick={() => setStep("type-select")}>← Back</button>
              <button
                className="px-4 py-2 text-sm rounded bg-[#5B8BA0] text-white hover:bg-[#4A7A8F] disabled:opacity-50"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? "Saving..." : "Save Profile"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
