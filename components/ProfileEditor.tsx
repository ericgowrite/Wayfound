"use client";

import { useState } from "react";
import { Profile, AXIS_KEYS, AXIS_LABELS, AXIS_DESCRIPTIONS, AxisWeights } from "@/types";

interface Props {
  profile: Profile;
  onSave: (p: Profile) => void;
  onClose: () => void;
}

export default function ProfileEditor({ profile, onSave, onClose }: Props) {
  const [draft, setDraft] = useState<Profile>(JSON.parse(JSON.stringify(profile)));
  const [saving, setSaving] = useState(false);
  const [newDealbreaker, setNewDealbreaker] = useState("");

  function setWeight(key: keyof AxisWeights, val: number) {
    setDraft((d) => ({ ...d, axisWeights: { ...d.axisWeights, [key]: val } }));
  }

  function setThreshold(key: keyof AxisWeights, val: string) {
    setDraft((d) => {
      const t = { ...d.thresholds };
      if (val === "") delete t[key];
      else t[key] = parseFloat(val);
      return { ...d, thresholds: t };
    });
  }

  function addDealbreaker() {
    if (!newDealbreaker.trim()) return;
    setDraft((d) => ({ ...d, dealbreakers: [...d.dealbreakers, newDealbreaker.trim()] }));
    setNewDealbreaker("");
  }

  function removeDealbreaker(i: number) {
    setDraft((d) => ({ ...d, dealbreakers: d.dealbreakers.filter((_, idx) => idx !== i) }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/profiles/${draft.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const updated = await res.json();
      onSave(updated);
    } finally {
      setSaving(false);
    }
  }

  const modal = "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700";
  const input = "bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-200 border-gray-300 dark:border-gray-700 focus:border-blue-500";
  const label = "text-gray-500 dark:text-gray-500 text-xs uppercase";
  const btnSecondary = "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600";

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className={`${modal} rounded-xl border w-full max-w-2xl max-h-[90vh] overflow-auto`}>
        <div className={`flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-900`}>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Profile: {draft.name} ({draft.enneagramType})</h2>
          <button className="text-gray-400 hover:text-gray-600 dark:hover:text-white text-2xl leading-none" onClick={onClose}>×</button>
        </div>

        <div className="p-4 space-y-6">
          <div>
            <label className={`${label} block mb-1`}>Description</label>
            <textarea
              className={`w-full ${input} text-sm rounded border p-2 resize-none focus:outline-none`}
              rows={2}
              value={draft.description}
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
            />
          </div>

          <div>
            <label className={`${label} block mb-3`}>Axis Weights</label>
            <div className="space-y-3">
              {AXIS_KEYS.map((k) => (
                <div key={k}>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm text-gray-700 dark:text-gray-300" title={AXIS_DESCRIPTIONS[k]}>
                      {AXIS_LABELS[k]}
                    </span>
                    <span className="text-sm font-mono text-gray-500 dark:text-gray-400">
                      {draft.axisWeights[k].toFixed(2)}
                    </span>
                  </div>
                  <input
                    type="range" min={0} max={1} step={0.05}
                    value={draft.axisWeights[k]}
                    onChange={(e) => setWeight(k, parseFloat(e.target.value))}
                    className="w-full accent-blue-500"
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className={`${label} block mb-2`}>Thresholds (warn if axis falls below)</label>
            <div className="grid grid-cols-2 gap-2">
              {AXIS_KEYS.map((k) => (
                <div key={k} className="flex items-center gap-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400 w-28 truncate">{AXIS_LABELS[k]}</span>
                  <input
                    type="number" min={0} max={1} step={0.05}
                    className={`w-16 ${input} text-xs rounded border p-1 focus:outline-none`}
                    placeholder="—"
                    value={draft.thresholds[k] ?? ""}
                    onChange={(e) => setThreshold(k, e.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className={`${label} block mb-2`}>Dealbreakers</label>
            <div className="space-y-1.5 mb-2">
              {draft.dealbreakers.map((d, i) => (
                <div key={i} className="flex items-center gap-2 bg-red-50 dark:bg-gray-800 rounded px-2 py-1.5">
                  <span className="text-red-600 dark:text-red-400 text-sm flex-1">{d}</span>
                  <button className="text-gray-400 hover:text-red-500 text-sm" onClick={() => removeDealbreaker(i)}>×</button>
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
              <button className={`px-3 py-2 ${btnSecondary} text-sm rounded`} onClick={addDealbreaker}>Add</button>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex gap-2 justify-end sticky bottom-0 bg-white dark:bg-gray-900">
          <button className={`px-4 py-2 text-sm rounded ${btnSecondary}`} onClick={onClose}>Cancel</button>
          <button
            className="px-4 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-50"
            onClick={handleSave} disabled={saving}
          >
            {saving ? "Saving..." : "Save Profile"}
          </button>
        </div>
      </div>
    </div>
  );
}
