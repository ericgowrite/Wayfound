"use client";

import TravelAssessment from "@/components/TravelAssessment";

export default function OnboardingPreviewClient() {
  return (
    <div className="min-h-screen bg-[#F5F4F0] p-8">
      <div className="max-w-2xl mx-auto">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#888888] mb-6">
          Onboarding Preview — Dev Only
        </p>
        <div
          className="bg-white border border-[#E8E8E8] rounded-2xl overflow-hidden"
          style={{ minHeight: 520 }}
        >
          <TravelAssessment
            isSelf
            onComplete={(result, name) => {
              console.log("[preview] onComplete", result.name, name);
            }}
            onSkip={() => {
              console.log("[preview] onSkip");
            }}
          />
        </div>
      </div>
    </div>
  );
}
