"use client";

import { useState } from "react";
import { AssessmentResult } from "@/lib/assessment";
import TravelAssessment from "@/components/TravelAssessment";
import templates from "@/src/data/profileTemplates.json";
import { ProfileTemplate, AxisWeights } from "@/types";

const TEMPLATES = templates as ProfileTemplate[];

type Phase = "intro" | "assessing" | "submitting" | "done" | "error";

export default function AssessClient({ token }: { token: string }) {
  const [phase, setPhase] = useState<Phase>("intro");
  const [profileName, setProfileName] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleComplete(result: AssessmentResult, name: string, pastTripContext?: string) {
    setPhase("submitting");

    const tmpl = TEMPLATES.find((t) => t.type === String(result.type));

    try {
      const res = await fetch(`/api/assess-link/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          enneagramType: result.type,
          axisWeights: result.axisWeights as AxisWeights,
          thresholds: tmpl?.thresholds ?? {},
          dealbreakers: tmpl?.dealbreakers ?? [],
          pastTripContext: pastTripContext ?? "",
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error ?? "Something went wrong. The link may have already been used.");
        setPhase("error");
        return;
      }

      setProfileName(data.profileName ?? name);
      setPhase("done");
    } catch {
      setErrorMsg("Couldn't connect. Check your internet and try again.");
      setPhase("error");
    }
  }

  if (phase === "intro") {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-md text-center space-y-6">
          <div>
            <p className="text-xs font-semibold tracking-widest text-[#C4956A] uppercase mb-3">Wayfound</p>
            <h1 className="text-2xl font-bold text-[#2C3E50] leading-tight">
              Find your travel style
            </h1>
            <p className="text-[#3D5A73] text-sm mt-3 leading-relaxed">
              Someone is planning a trip and wants to find experiences that work for both of you.
              Answer 10 quick questions to share your travel style — no account needed.
            </p>
          </div>
          <button
            onClick={() => setPhase("assessing")}
            className="w-full py-3 rounded-xl bg-[#2C3E50] text-white font-semibold text-sm hover:bg-[#3d5166] transition-colors"
          >
            Let&apos;s go →
          </button>
          <p className="text-xs text-[#BBBBBB]">Takes about 2 minutes. Nothing is stored under your name.</p>
        </div>
      </div>
    );
  }

  if (phase === "assessing") {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex flex-col items-center justify-start pt-8 px-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-[#E8E8E8] overflow-hidden" style={{ minHeight: 520 }}>
          <TravelAssessment
            isSelf={true}
            onComplete={handleComplete}
            onSkip={() => setPhase("intro")}
          />
        </div>
      </div>
    );
  }

  if (phase === "submitting") {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center">
        <p className="text-[#3D5A73] text-sm">Saving your travel style…</p>
      </div>
    );
  }

  if (phase === "done") {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex flex-col items-center justify-center px-6">
        <div className="w-full max-w-md text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-[#C4956A]/15 flex items-center justify-center mx-auto text-2xl">
            ✓
          </div>
          <h1 className="text-xl font-bold text-[#2C3E50]">You&apos;re in</h1>
          <p className="text-[#3D5A73] text-sm leading-relaxed">
            {profileName ? `${profileName}'s` : "Your"} travel style has been added to the trip.
            Results will now be scored for both of you.
          </p>
          <p className="text-xs text-[#BBBBBB] pt-2">
            Want to save your style and plan your own trips?{" "}
            <a href="/signup" className="text-[#C4956A] hover:underline">
              Create a free account
            </a>
          </p>
        </div>
      </div>
    );
  }

  // error
  return (
    <div className="min-h-screen bg-[#FAF8F5] flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-md text-center space-y-4">
        <h1 className="text-xl font-bold text-[#2C3E50]">Link unavailable</h1>
        <p className="text-[#3D5A73] text-sm leading-relaxed">{errorMsg}</p>
      </div>
    </div>
  );
}
