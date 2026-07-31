"use client";

import HomeScreen from "@/components/HomeScreen";
import { Profile, TripWorkspace } from "@/types";

const mockProfile: Profile = {
  id: "profile-1",
  name: "Alex",
  enneagramType: "9",
  description: "The Harmonist",
  axisWeights: { calm: 0.8, designSincerity: 0.7, valueIntegrity: 0.7, socialPermeability: 0.5, autonomy: 0.7, novelty: 0.6, locationFriction: 0.5 },
  thresholds: {},
  dealbreakers: [],
  isDefault: true,
};

const mockWorkspace: TripWorkspace = {
  id: "ws-1",
  name: "Costa Rica · Getting away properly",
  destination: "Costa Rica",
  travelers: ["profile-1"],
  searches: [],
  savedOptions: [
    { id: "s1", searchId: "search-1", name: "Nayara Springs", source: "#", description: "", price: "$450/night", axisScores: { calm: 0.9, designSincerity: 0.8, valueIntegrity: 0.7, socialPermeability: 0.4, autonomy: 0.6, novelty: 0.5, locationFriction: 0.6 }, alignmentScore: 88, thresholdViolations: [], watchOutFor: [], dealbreakersTriggered: [], fitExplanation: "", tradeoffs: [], status: "new", notes: "", travelerScores: {}, savedAt: new Date().toISOString(), tags: [], journeyState: "saved" },
    { id: "s2", searchId: "search-1", name: "Kura Design Villas", source: "#", description: "", price: "$380/night", axisScores: { calm: 0.85, designSincerity: 0.92, valueIntegrity: 0.75, socialPermeability: 0.3, autonomy: 0.8, novelty: 0.6, locationFriction: 0.5 }, alignmentScore: 84, thresholdViolations: [], watchOutFor: [], dealbreakersTriggered: [], fitExplanation: "", tradeoffs: [], status: "new", notes: "", travelerScores: {}, savedAt: new Date().toISOString(), tags: [], journeyState: "saved" },
  ],
  notes: "",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export default function HomePreviewClient() {
  return (
    <div className="min-h-screen bg-[#F5F4F0]">
      {/* Section labels */}
      <div className="max-w-2xl mx-auto px-8 pt-8 pb-4 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#888888]">Home Screen Preview — Dev Only</p>
      </div>

      {/* State 1: New user */}
      <div className="max-w-2xl mx-auto px-8 mb-12">
        <p className="text-xs text-[#888888] mb-4">State 1 — New user (no workspaces)</p>
        <div className="bg-white border border-[#E8E8E8] rounded-2xl overflow-hidden" style={{ minHeight: 520 }}>
          <HomeScreen
            profiles={[mockProfile]}
            workspaces={[]}
            onWorkspaceCreated={() => {}}
            onSelectWorkspace={() => {}}
          />
        </div>
      </div>

      {/* State 2: Returning user with active trip */}
      <div className="max-w-2xl mx-auto px-8 mb-12">
        <p className="text-xs text-[#888888] mb-4">State 2 — Returning user (active trip + saved items)</p>
        <div className="bg-white border border-[#E8E8E8] rounded-2xl overflow-hidden" style={{ minHeight: 400 }}>
          <HomeScreen
            profiles={[mockProfile]}
            workspaces={[mockWorkspace]}
            onWorkspaceCreated={() => {}}
            onSelectWorkspace={() => {}}
          />
        </div>
      </div>

      {/* State 3: Returning user, no saved items */}
      <div className="max-w-2xl mx-auto px-8 pb-12">
        <p className="text-xs text-[#888888] mb-4">State 3 — Returning user (no saved items)</p>
        <div className="bg-white border border-[#E8E8E8] rounded-2xl overflow-hidden" style={{ minHeight: 300 }}>
          <HomeScreen
            profiles={[mockProfile]}
            workspaces={[{ ...mockWorkspace, id: "ws-2", savedOptions: [], destination: "Belize" }]}
            onWorkspaceCreated={() => {}}
            onSelectWorkspace={() => {}}
          />
        </div>
      </div>
    </div>
  );
}
