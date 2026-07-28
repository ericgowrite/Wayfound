"use client";

import ResultCard from "@/components/ResultCard";
import { ScoredOption, TripWorkspace, Profile } from "@/types";

const mockOption: ScoredOption = {
  id: "preview-1",
  searchId: "search-1",
  name: "Casa Higueras",
  source: "https://example.com/casa-higueras",
  description:
    "A boutique hilltop hotel with 20 rooms perched above Valparaíso's harbor. The design mixes 19th-century Chilean architecture with contemporary restraint — no fuss, but nothing cheap either. Service is personal without being intrusive.",
  price: "~$180/night",
  axisScores: {
    calm: 0.72,
    designSincerity: 0.85,
    valueIntegrity: 0.78,
    socialPermeability: 0.65,
    autonomy: 0.80,
    novelty: 0.60,
    locationFriction: 0.55,
  },
  alignmentScore: 82,
  thresholdViolations: [],
  watchOutFor: [],
  dealbreakersTriggered: [],
  fitExplanation:
    "This place matches your preference for thoughtful, unhurried spaces. The architecture has genuine soul — it was designed to feel like someone's home, not a product. Quieter than most Valparaíso options, and the views reward the climb.",
  judgmentLine: "The kind of place that turns a good trip into a great one.",
  tradeoffs: [
    "Steep walk from the city center — not ideal if mobility is a concern",
    "Limited on-site dining; you'll need to venture out for meals",
  ],
  status: "new",
  notes: "",
  travelerScores: {
    "traveler-1": { alignmentScore: 82, thresholdViolations: [] },
    "traveler-2": { alignmentScore: 74, thresholdViolations: [] },
  },
};

const mockWorkspace: TripWorkspace = {
  id: "ws-preview",
  name: "Chile 2025",
  destination: "Valparaíso, Chile",
  travelers: ["traveler-1", "traveler-2"],
  searches: [],
  savedOptions: [],
  notes: "",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const mockTravelers: Profile[] = [
  {
    id: "traveler-1",
    name: "Alex",
    enneagramType: "4",
    description: "Seeks beauty and meaning in travel",
    axisWeights: {
      calm: 0.7, designSincerity: 0.9, valueIntegrity: 0.75,
      socialPermeability: 0.6, autonomy: 0.8, novelty: 0.65, locationFriction: 0.5,
    },
    thresholds: {},
    dealbreakers: [],
  },
  {
    id: "traveler-2",
    name: "Jordan",
    enneagramType: "7",
    description: "Loves variety and new experiences",
    axisWeights: {
      calm: 0.4, designSincerity: 0.6, valueIntegrity: 0.7,
      socialPermeability: 0.8, autonomy: 0.9, novelty: 0.85, locationFriction: 0.7,
    },
    thresholds: {},
    dealbreakers: [],
  },
];

const mockProfileWeights = mockTravelers[0].axisWeights;

export default function CardPreviewClient() {
  return (
    <div className="min-h-screen bg-[#F5F4F0] p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-[11px] font-semibold uppercase tracking-wider text-[#888888]">
          Result Card Preview — Dev Only
        </h1>

        <p className="text-[12px] text-[#888888]">Collapsed (default)</p>
        <ResultCard
          option={mockOption}
          workspace={mockWorkspace}
          travelers={mockTravelers}
          profileWeights={mockProfileWeights}
          isSelected={false}
          category="accommodation"
          searchQuery="boutique hotel valparaiso"
          onToggleSelect={() => {}}
          onSave={() => {}}
          onStatusChange={() => {}}
          onNotesChange={() => {}}
          onChatUpdate={() => {}}
          onDeepDive={() => {}}
          onFeedbackSubmit={() => {}}
        />

        <p className="text-[12px] text-[#888888] pt-4">List variant (desktop left panel)</p>
        <div className="w-72">
          <ResultCard
            option={mockOption}
            workspace={mockWorkspace}
            travelers={mockTravelers}
            profileWeights={mockProfileWeights}
            isSelected={false}
            category="accommodation"
            variant="list"
            selected={false}
            onSelect={() => {}}
            onToggleSelect={() => {}}
            onSave={() => {}}
            onStatusChange={() => {}}
            onNotesChange={() => {}}
            onChatUpdate={() => {}}
            onDeepDive={() => {}}
            onFeedbackSubmit={() => {}}
          />
        </div>

        <p className="text-[12px] text-[#888888] pt-4">Expanded (detail variant — always open)</p>
        <ResultCard
          option={mockOption}
          workspace={mockWorkspace}
          travelers={mockTravelers}
          profileWeights={mockProfileWeights}
          isSelected={false}
          category="accommodation"
          variant="detail"
          onToggleSelect={() => {}}
          onSave={() => {}}
          onStatusChange={() => {}}
          onNotesChange={() => {}}
          onChatUpdate={() => {}}
          onDeepDive={() => {}}
          onFeedbackSubmit={() => {}}
        />

        <p className="text-[12px] text-[#888888] pt-4">Restaurant variant</p>
        <ResultCard
          option={{ ...mockOption, id: "preview-2", name: "El Internado", judgmentLine: "Dinner here is the evening, not just part of it." }}
          workspace={mockWorkspace}
          travelers={mockTravelers}
          profileWeights={mockProfileWeights}
          isSelected={false}
          category="restaurant"
          onToggleSelect={() => {}}
          onSave={() => {}}
          onStatusChange={() => {}}
          onNotesChange={() => {}}
          onChatUpdate={() => {}}
          onDeepDive={() => {}}
          onFeedbackSubmit={() => {}}
        />
      </div>
    </div>
  );
}
