"use client";

export default function TripsDashboardPreviewClient() {
  const MOCK_WORKSPACES = [
    {
      id: "w1",
      name: "Costa Rica",
      destination: "Costa Rica",
      travelers: ["p1", "p2"],
      savedOptions: [
        { journeyState: "saved" },
        { journeyState: "saved" },
        { journeyState: "saved" },
        { journeyState: "interested" },
      ],
      searches: [],
      dates: null,
    },
    {
      id: "w2",
      name: "Sam's 30th",
      destination: "Napa",
      travelers: ["p1", "p2", "p3"],
      savedOptions: [],
      searches: [],
      dates: null,
    },
    {
      id: "w3",
      name: "Sonoma weekend",
      destination: "Sonoma",
      travelers: ["p1"],
      savedOptions: [
        { journeyState: "booked" },
        { journeyState: "booked" },
      ],
      searches: [],
      dates: { start: "2026-10-12", end: "2026-10-14" },
    },
  ];

  const MOCK_PROFILES = [
    { id: "p1", name: "Eric" },
    { id: "p2", name: "Sam" },
    { id: "p3", name: "Rae" },
  ];

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#F5F4F0", fontFamily: "'Inter', sans-serif" }}>
      {/* Sidebar */}
      <div style={{ width: 224, background: "#FFFFFF", borderRight: "1px solid #E0E8ED", display: "flex", flexDirection: "column", flexShrink: 0 }}>

        {/* Logo */}
        <div style={{ padding: "24px 16px 16px", borderBottom: "1px solid #E0E8ED" }}>
          <div style={{ fontFamily: '"Lora", serif', fontStyle: "italic", fontWeight: 500, fontSize: 20, color: "#2C3E50" }}>
            viya<span style={{ color: "#C4956A" }}>way</span>
          </div>
        </div>

        {/* Experiences section — redesigned */}
        <div style={{ flex: 1, overflowY: "auto" }}>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 16px 12px" }}>
            <span style={{ fontFamily: '"Lora", serif', fontWeight: 600, fontSize: 15, color: "#2C3E50" }}>
              Experiences
            </span>
            <button style={{ border: "1px solid #2C3E50", borderRadius: 999, padding: "5px 10px", fontSize: 11, color: "#2C3E50", fontWeight: 600, background: "transparent", cursor: "pointer", lineHeight: 1 }}>
              + New
            </button>
          </div>

          <div style={{ padding: "0 16px" }}>
            {MOCK_WORKSPACES.map((w) => {
              const travelerProfiles = (w.travelers ?? []).map(id => MOCK_PROFILES.find(p => p.id === id)).filter(Boolean) as { id: string; name: string }[];
              const travelerNames = travelerProfiles.map(p => p.name);
              const travelerStr = travelerNames.slice(0, 2).join(", ");
              const savedCount = w.savedOptions.length;
              const isBooked = w.savedOptions.some((s: { journeyState: string }) => s.journeyState === "booked");

              const subtitleParts: string[] = [];
              if (isBooked) {
                subtitleParts.push("Booked");
                if (w.dates?.start) {
                  const d = new Date(w.dates.start);
                  subtitleParts.push(d.toLocaleDateString("en-US", { month: "short", day: "numeric" }));
                }
              } else if (savedCount > 0) {
                subtitleParts.push("Planning");
                subtitleParts.push(`${savedCount} saved`);
              } else {
                subtitleParts.push("Just started");
              }
              if (travelerStr) subtitleParts.push(`with ${travelerStr}`);

              return (
                <div key={w.id} style={{ borderBottom: "1px solid #E8E8E8", padding: "14px 0", cursor: "pointer" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                    <p style={{ fontFamily: '"Lora", serif', fontWeight: 500, fontSize: 14, color: "#2C3E50", lineHeight: 1.3, flexGrow: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {w.name || w.destination || "Untitled"}
                    </p>
                  </div>
                  <p style={{ fontSize: 12, color: "#888888", marginTop: 3, lineHeight: 1.4 }}>
                    {subtitleParts.join(" · ")}
                  </p>
                  <button style={{ fontSize: 13, color: "#2C3E50", textDecoration: "underline", background: "none", border: "none", padding: 0, cursor: "pointer", marginTop: 6 }}>
                    {isBooked ? "View →" : "Continue →"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Empty state preview */}
        <div style={{ borderTop: "1px solid #E0E8ED", padding: "16px" }}>
          <p style={{ fontSize: 11, color: "#9BB0C1", textAlign: "center", marginBottom: 8 }}>Empty state ↓</p>
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <p style={{ fontFamily: '"Lora", serif', fontWeight: 500, fontSize: 15, color: "#2C3E50" }}>
              No experiences yet.
            </p>
            <p style={{ fontSize: 12, color: "#888888", marginTop: 8, lineHeight: 1.5 }}>
              Each experience is its own space — start one whenever you&apos;re ready.
            </p>
            <button style={{ border: "1px solid #2C3E50", borderRadius: 999, padding: "9px 14px", fontSize: 12, color: "#2C3E50", fontWeight: 600, background: "transparent", cursor: "pointer", marginTop: 14 }}>
              + New experience
            </button>
          </div>
        </div>
      </div>

      {/* Main content placeholder */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#888888", fontSize: 14 }}>
        Dashboard main content area
      </div>
    </div>
  );
}
