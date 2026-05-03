"use client";

import { useState } from "react";
import { Profile, ProfileTemplate, AXIS_KEYS, AXIS_LABELS, AXIS_DESCRIPTIONS, AxisWeights } from "@/types";
import templates from "@/src/data/profileTemplates.json";

const TEMPLATES = templates as ProfileTemplate[];

interface Props {
  onSave: (p: Profile) => void;
  onClose: () => void;
}

type Step = "info" | "review";

export default function AddProfileModal({ onSave, onClose }: Props) {
  const [step, setStep] = useState<Step>("info");
  const [name, setName] = useState("");
  const [selectedType, setSelectedType] = useState("9w8");
  const [draft, setDraft] = useState<Partial<Profile>>({});
  const [saving, setSaving] = useState(false);
  const [newDealbreaker, setNewDealbreaker] = useState("");

  const template = TEMPLATES.find((t) => t.type === selectedType) ?? TEMPLATES[0];

  function handleNext() {
    if (!name.trim()) return;
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
      const res = await fetch("/api/profiles", {
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

  // Group templates by base type for the select
  const baseTypes = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl border border-gray-700 w-full max-w-lg max-h-[90vh] overflow-auto">
        <div className="flex justify-between items-center p-4 border-b border-gray-700 sticky top-0 bg-gray-900">
          <h2 className="text-lg font-semibold text-white">
            {step === "info" ? "Add Traveler Profile" : `Review: ${draft.name} (${draft.enneagramType})`}
          </h2>
          <button className="text-gray-400 hover:text-white text-2xl leading-none" onClick={onClose}>×</button>
        </div>

        <div className="p-4">
          {step === "info" && (
            <div className="space-y-4">
              <div>
                <label className="text-gray-500 text-xs uppercase block mb-1">Traveler Name</label>
                <input
                  className="w-full bg-gray-800 text-gray-200 text-sm rounded border border-gray-700 px-3 py-2 focus:outline-none focus:border-blue-500"
                  placeholder="Sarah"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleNext()}
                  autoFocus
                />
              </div>

              <div>
                <label className="text-gray-500 text-xs uppercase block mb-2">Enneagram Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {baseTypes.map((base) => {
                    const subtypes = TEMPLATES.filter(
                      (t) => t.type === base || t.type.startsWith(`${base}w`)
                    );
                    return subtypes.map((t) => (
                      <button
                        key={t.type}
                        className={`text-left px-3 py-2 rounded border text-xs transition-colors ${
                          selectedType === t.type
                            ? "border-blue-500 bg-blue-900/30 text-blue-300"
                            : "border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200"
                        }`}
                        onClick={() => setSelectedType(t.type)}
                      >
                        <div className="font-semibold">Type {t.type}</div>
                        <div className="text-gray-500 text-xs mt-0.5 line-clamp-1">{t.description.split("—")[0].trim()}</div>
                      </button>
                    ));
                  })}
                </div>
              </div>

              {selectedType && (
                <div className="bg-gray-800 rounded-lg p-3">
                  <p className="text-xs text-gray-500 uppercase mb-1">Selected</p>
                  <p className="text-white font-medium text-sm">Type {selectedType}</p>
                  <p className="text-gray-400 text-xs mt-0.5">{template.description}</p>
                </div>
              )}
            </div>
          )}

          {step === "review" && draft.axisWeights && (
            <div className="space-y-5">
              <p className="text-gray-400 text-sm">{draft.description}</p>

              <div>
                <label className="text-gray-500 text-xs uppercase block mb-3">Axis Weights — adjust to fit</label>
                <div className="space-y-3">
                  {AXIS_KEYS.map((k) => (
                    <div key={k}>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm text-gray-300" title={AXIS_DESCRIPTIONS[k]}>
                          {AXIS_LABELS[k]}
                        </span>
                        <span className="text-sm font-mono text-gray-400">
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
                        className="w-full accent-blue-500"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-gray-500 text-xs uppercase block mb-2">Dealbreakers</label>
                <div className="space-y-1.5 mb-2">
                  {(draft.dealbreakers ?? []).map((d, i) => (
                    <div key={i} className="flex items-center gap-2 bg-gray-800 rounded px-2 py-1.5">
                      <span className="text-red-400 text-sm flex-1">{d}</span>
                      <button className="text-gray-500 hover:text-red-400 text-sm" onClick={() => removeDealbreaker(i)}>×</button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    className="flex-1 bg-gray-800 text-gray-200 text-sm rounded border border-gray-700 p-2 focus:outline-none focus:border-blue-500"
                    placeholder="Add dealbreaker..."
                    value={newDealbreaker}
                    onChange={(e) => setNewDealbreaker(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addDealbreaker()}
                  />
                  <button className="px-3 py-2 bg-gray-700 text-gray-200 text-sm rounded hover:bg-gray-600" onClick={addDealbreaker}>
                    Add
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-700 flex gap-2 justify-between sticky bottom-0 bg-gray-900">
          {step === "review" ? (
            <>
              <button className="px-4 py-2 text-sm rounded bg-gray-700 text-gray-200 hover:bg-gray-600" onClick={() => setStep("info")}>
                ← Back
              </button>
              <button
                className="px-4 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? "Saving..." : "Save Profile"}
              </button>
            </>
          ) : (
            <>
              <button className="px-4 py-2 text-sm rounded bg-gray-700 text-gray-200 hover:bg-gray-600" onClick={onClose}>
                Cancel
              </button>
              <button
                className="px-4 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50"
                onClick={handleNext}
                disabled={!name.trim()}
              >
                Review Defaults →
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
