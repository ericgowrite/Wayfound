"use client";

import { useState } from "react";
import { Profile, AxisWeights } from "@/types";
import { fetchWithAuth } from "@/lib/fetchWithAuth";

interface Props {
  profile: Profile;
  onSave: (p: Profile) => void;
  onClose: () => void;
}

export default function ProfileEditor({ profile, onSave, onClose }: Props) {
  const [draft, setDraft] = useState<Profile>(JSON.parse(JSON.stringify(profile)));
  const [saving, setSaving] = useState(false);
  const [newDealbreaker, setNewDealbreaker] = useState("");

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
      const res = await fetchWithAuth(`/api/profiles/${draft.id}`, {
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

  const modal = "bg-white dark:bg-[#1e2d3d] border-[#E0E8ED] dark:border-[#3D5A6E]";
  const input = "bg-[#F8FAFB] dark:bg-[#2a3f52] text-[#2C3E50] dark:text-[#B8D4E3] border-[#E0E8ED] dark:border-[#3D5A6E] focus:border-[#5B8BA0]";
  const label = "text-[#6B8299] dark:text-[#6B8299] text-xs uppercase";
  const btnSecondary = "bg-[#EEF4F8] dark:bg-[#3D5A6E] text-[#3D5A6E] dark:text-[#B8D4E3] hover:bg-[#E0E8ED] dark:hover:bg-[#4A7A8F]";

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className={`${modal} rounded-xl border w-full max-w-2xl max-h-[90vh] overflow-auto`}>
        <div className={`flex justify-between items-center p-4 border-b border-[#E0E8ED] dark:border-[#3D5A6E] sticky top-0 bg-white dark:bg-[#1e2d3d]`}>
          <h2 className="text-lg font-semibold text-[#2C3E50] dark:text-white">Profile: {draft.name} ({draft.enneagramType})</h2>
          <button className="text-[#9BB0C1] hover:text-[#6B8299] dark:hover:text-white text-2xl leading-none" onClick={onClose}>×</button>
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
            <p className="text-xs text-[#9BB0C1] dark:text-[#6B8299] leading-relaxed">
              Your travel style is set by your personality assessment and shapes every recommendation ViyaWay makes.
            </p>
          </div>

          <div>
            <label className={`${label} block mb-2`}>Dealbreakers</label>
            <div className="space-y-1.5 mb-2">
              {draft.dealbreakers.map((d, i) => (
                <div key={i} className="flex items-center gap-2 bg-red-50 dark:bg-[#2a3f52] rounded px-2 py-1.5">
                  <span className="text-red-600 dark:text-red-400 text-sm flex-1">{d}</span>
                  <button className="text-[#9BB0C1] hover:text-red-500 text-sm" onClick={() => removeDealbreaker(i)}>×</button>
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

        <div className="p-4 border-t border-[#E0E8ED] dark:border-[#3D5A6E] flex gap-2 justify-end sticky bottom-0 bg-white dark:bg-[#1e2d3d]">
          <button
            className="px-4 py-2 text-sm rounded bg-[#5B8BA0] text-white hover:bg-[#4A7A8F] disabled:opacity-50"
            onClick={handleSave} disabled={saving}
          >
            {saving ? "Saving..." : "Done"}
          </button>
        </div>
      </div>
    </div>
  );
}
