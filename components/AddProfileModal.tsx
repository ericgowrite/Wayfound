"use client";

import { useState } from "react";
import { Profile, ProfileTemplate, AXIS_KEYS, AXIS_LABELS, AXIS_DESCRIPTIONS, AxisWeights } from "@/types";
import { AssessmentResult } from "@/lib/assessment";
import TravelAssessment from "./TravelAssessment";
import templates from "@/src/data/profileTemplates.json";
import { fetchWithAuth } from "@/lib/fetchWithAuth";

const TEMPLATES = templates as ProfileTemplate[];

const TYPE_INFO: Record<string, { name: string; descriptor: string; bullets: string[] }> = {
  "1": {
    name: "The Reformer",
    descriptor: "Values doing things right — seeks well-crafted, purposeful experiences with no wasted moments",
    bullets: [
      "You notice when things are done well — and when they're not",
      "You travel with intention; aimless wandering frustrates you",
      "You're drawn to places with craftsmanship, quality, and purpose",
      "A perfect day feels earned, not accidental",
    ],
  },
  "2": {
    name: "The Helper",
    descriptor: "Warmth-driven — drawn to places that feel welcoming, personal, and human",
    bullets: [
      "You're energized by warm, personal interactions with locals and staff",
      "You'd rather share a great experience than have it alone",
      "The feeling of being genuinely welcomed matters more than luxury",
      "You tend to remember how a place made you feel, not what it looked like",
    ],
  },
  "3": {
    name: "The Achiever",
    descriptor: "Motivated by quality and status — seeks experiences worth having and worth sharing",
    bullets: [
      "You're drawn to places that are worth the trip — and the story",
      "Quality matters: you want the best version of whatever you're doing",
      "You research before you go and prefer to arrive prepared",
      "The experience should reflect well — on the destination and on you",
    ],
  },
  "4": {
    name: "The Individualist",
    descriptor: "Craves depth and authenticity — drawn to places that feel distinctive and personally meaningful",
    bullets: [
      "You're drawn to places that feel distinctive, not generic",
      "You want to feel something — not just see something",
      "Authenticity matters more than popularity",
      "The best stays feel like they were made specifically for someone like you",
    ],
  },
  "5": {
    name: "The Investigator",
    descriptor: "Needs space and stimulation — seeks immersive, offbeat experiences away from the crowd",
    bullets: [
      "You prefer depth over breadth — one place explored fully beats five places skimmed",
      "You need time and space to yourself to recharge",
      "You're drawn to the offbeat, the overlooked, and the intellectually interesting",
      "Crowds and over-programmed itineraries drain you",
    ],
  },
  "6": {
    name: "The Loyalist",
    descriptor: "Values trust and reliability — most comfortable in places that feel safe, consistent, and well-reviewed",
    bullets: [
      "You do your research — reviews, safety, logistics — before you commit",
      "Once you find somewhere you trust, you return",
      "You travel better when you feel secure in the plan",
      "Surprises are fine when they're good; bad surprises ruin the trip",
    ],
  },
  "7": {
    name: "The Enthusiast",
    descriptor: "Energized by variety and novelty — drawn to destinations packed with options and new experiences",
    bullets: [
      "You want options — the best trip has more to do than you have time for",
      "Novelty energizes you; repetition bores you fast",
      "You're spontaneous and open to changing the plan if something better comes up",
      "FOMO is real: you'd rather try five things than perfect one",
    ],
  },
  "8": {
    name: "The Challenger",
    descriptor: "Bold and direct — seeks experiences that feel powerful, expansive, and worth the effort",
    bullets: [
      "You want experiences that feel significant, not safe",
      "You'd rather go somewhere raw and real than polished and predictable",
      "You make decisions quickly and move through a destination with purpose",
      "You need to feel like you earned the experience",
    ],
  },
  "9": {
    name: "The Peacemaker",
    descriptor: "Restores through calm — drawn to unhurried, harmonious places where they can fully decompress",
    bullets: [
      "You travel to genuinely restore — not just to change location",
      "Calm, unhurried environments are where you actually relax",
      "Conflict, crowds, and friction drain you faster than others",
      "The best trips leave you feeling like yourself again",
    ],
  },
};

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
  const [confirmingType, setConfirmingType] = useState<string | null>(null);
  const [draft, setDraft] = useState<Partial<Profile>>({});
  const [saving, setSaving] = useState(false);
  const [newDealbreaker, setNewDealbreaker] = useState("");

  function handleNameNext() {
    if (!name.trim()) return;
    setStep("know-type");
  }

  function handleTypeConfirmed(typeToConfirm: string) {
    const tmpl = TEMPLATES.find((t) => t.type === typeToConfirm);
    if (!tmpl) return;
    setSelectedType(typeToConfirm);
    setDraft({
      name: name.trim(),
      enneagramType: typeToConfirm,
      description: tmpl.description,
      axisWeights: { ...tmpl.axisWeights },
      thresholds: { ...tmpl.thresholds },
      dealbreakers: [...tmpl.dealbreakers],
    });
    setStep("review");
  }

  function goBackFromTypeSelect() {
    setConfirmingType(null);
    setSelectedType("");
    setStep("know-type");
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
            {step === "info" && "Who's traveling?"}
            {step === "know-type" && (isSelf ? "How do you travel?" : `Find ${name ? name + "'s" : "Their"} Travel Style`)}
            {step === "assess" && "Travel Style Assessment"}
            {step === "type-select" && !confirmingType && (isSelf ? "Which one sounds like you?" : `Select ${name ? name + "'s" : "Their"} Type`)}
            {step === "type-select" && confirmingType && `Type ${confirmingType} — ${TYPE_INFO[confirmingType]?.name ?? ""}`}
            {step === "review" && `Review: ${draft.name} (${draft.enneagramType})`}
          </h2>
          <button className="text-[#9BB0C1] hover:text-[#2C3E50] dark:hover:text-white text-2xl leading-none" onClick={onClose}>×</button>
        </div>

        <div className="p-4">
          {/* Step 1: Name */}
          {step === "info" && (
            <div className="space-y-4">
              <div>
                <label className="text-[#6B8299] text-xs block mb-1">Your name</label>
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
              <p className="text-[#9BB0C1] dark:text-[#6B8299] text-xs leading-relaxed">
                We look at how you&apos;re wired — what energizes you, what you need to feel at ease, and what makes an experience feel like it was made for you.
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
            <div>
              {!confirmingType ? (
                /* Type list — number + name + descriptor */
                <div className="space-y-2">
                  {baseTypes.map((base) => {
                    const info = TYPE_INFO[base];
                    if (!info) return null;
                    return (
                      <button
                        key={base}
                        className="w-full text-left px-4 py-3 rounded-lg border border-[#E0E8ED] dark:border-[#3D5A6E] hover:border-[#5B8BA0] hover:bg-[#5B8BA0]/8 dark:hover:bg-[#5B8BA0]/10 transition-colors active:scale-[0.99]"
                        onClick={() => setConfirmingType(base)}
                      >
                        <p className="text-[#9BB0C1] text-xs">Type {base}</p>
                        <p className="text-[#2C3E50] dark:text-white text-sm font-semibold mt-0.5">{info.name}</p>
                        <p className="text-[#6B8299] dark:text-[#9BB0C1] text-xs mt-1 leading-snug">{info.descriptor}</p>
                      </button>
                    );
                  })}
                </div>
              ) : (
                /* Confirmation view — inline, no page navigation */
                <div className="space-y-5">
                  <div>
                    <p className="text-[#9BB0C1] text-xs uppercase tracking-wide">Type {confirmingType}</p>
                    <p className="text-[#2C3E50] dark:text-white text-xl font-semibold mt-1">
                      {TYPE_INFO[confirmingType].name}
                    </p>
                    <p className="text-[#6B8299] dark:text-[#9BB0C1] text-sm mt-1 leading-relaxed">
                      Does this sound like {isSelf ? "you" : name}?
                    </p>
                  </div>
                  <ul className="space-y-3">
                    {TYPE_INFO[confirmingType].bullets.map((b, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm text-[#3D5A6E] dark:text-[#B8D4E3] leading-snug">
                        <span className="text-[#5B8BA0] flex-shrink-0 font-bold mt-px">·</span>
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
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
          {step === "type-select" && !confirmingType && (
            <button className={`px-4 py-2 text-sm rounded ${btnSecondary}`} onClick={goBackFromTypeSelect}>← Back</button>
          )}
          {step === "type-select" && confirmingType && (
            <>
              <button
                className={`px-4 py-2 text-sm rounded ${btnSecondary}`}
                onClick={() => setConfirmingType(null)}
              >
                Go back — try another
              </button>
              <button
                className="px-4 py-2 text-sm rounded bg-[#5B8BA0] text-white hover:bg-[#4A7A8F]"
                onClick={() => handleTypeConfirmed(confirmingType)}
              >
                Yes, this is me →
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
