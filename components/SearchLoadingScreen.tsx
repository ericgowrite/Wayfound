"use client";

import { useEffect, useRef, useState } from "react";
import { LoadingContentItem, Profile } from "@/types";
import { TYPE_INFO } from "@/lib/typeInfo";

interface Props {
  phase: "searching" | "handoff";
  destination: string;
  travelers: Profile[];
  items: LoadingContentItem[];
  contentReady: boolean;
}

function travelerInitial(name: string): string {
  return name.charAt(0).toUpperCase();
}


export default function SearchLoadingScreen({ phase, destination, travelers, items, contentReady }: Props) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Rotate items every 5 seconds with fade
  useEffect(() => {
    if (!contentReady || items.length === 0 || phase === "handoff") return;

    intervalRef.current = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setCurrentIndex((i) => (i + 1) % items.length);
        setVisible(true);
      }, 400);
    }, 10000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [contentReady, items.length, phase]);

  // Reset fade-in when content first arrives
  useEffect(() => {
    if (contentReady) {
      setVisible(false);
      setTimeout(() => setVisible(true), 50);
    }
  }, [contentReady]);

  const item = contentReady && items.length > 0 ? items[currentIndex] : null;

  // Find traveler Profile for a named item
  const itemTraveler = item?.traveler && item.traveler !== "both"
    ? travelers.find((t) => t.name === item.traveler) ?? null
    : null;

  if (phase === "handoff") {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-16 animate-fade-in">
        <p className="text-[#3D5A6E] dark:text-[#B8D4E3] font-medium text-lg">
          Here&apos;s what fits you.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center py-16 px-6 text-center">
      {/* Navy magnifying glass SVG */}
      <div style={{ marginBottom: 24 }}>
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#2C3E50" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      </div>

      {/* Content area */}
      <div
        className="max-w-sm w-full min-h-[100px] flex flex-col items-center justify-center transition-opacity duration-400"
        style={{ opacity: visible ? 1 : 0 }}
      >
        {!contentReady || !item ? (
          /* Fallback while parallel call is pending */
          <p style={{ fontFamily: 'var(--font-noto-serif), Georgia, ui-serif, serif', fontSize: 20, lineHeight: 1.6, color: '#2C3E50', fontWeight: 500 }}>
            Finding what fits you in {destination || "your destination"}&hellip;
          </p>
        ) : item.type === "fact" ? (
          /* Destination fact */
          <>
            <p style={{ fontSize: 14, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#C4956A', marginBottom: 12 }}>
              While you wait
            </p>
            <p style={{ fontFamily: 'var(--font-noto-serif), Georgia, ui-serif, serif', fontSize: 20, lineHeight: 1.6, color: '#2C3E50' }}>
              {item.text}
            </p>
          </>
        ) : item.traveler === "both" ? (
          /* Group recommendation — no avatar */
          <p style={{ fontFamily: 'var(--font-noto-serif), Georgia, ui-serif, serif', fontSize: 20, lineHeight: 1.6, color: '#2C3E50' }}>
            {item.text}
          </p>
        ) : (
          /* Named traveler recommendation — show avatar chip */
          <>
            {itemTraveler && (
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-full bg-[#2C3E50] flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                  {travelerInitial(itemTraveler.name)}
                </div>
                <span className="text-xs font-medium text-[#2C3E50]">
                  {itemTraveler.name}
                  <span style={{ color: '#3D5A73', fontWeight: 400, marginLeft: 4 }}>
                    · {TYPE_INFO[itemTraveler.enneagramType]?.name ?? ""}
                  </span>
                </span>
              </div>
            )}
            <p style={{ fontFamily: 'var(--font-noto-serif), Georgia, ui-serif, serif', fontSize: 20, lineHeight: 1.6, color: '#2C3E50' }}>
              {item.text}
            </p>
          </>
        )}
      </div>

      <p style={{ fontSize: 14, color: '#3D5A73', marginTop: 24 }}>
        This may take 15–30 seconds
      </p>
    </div>
  );
}
