"use client";

import { useEffect, useRef, useState } from "react";
import { LoadingContentItem, Profile } from "@/types";

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

function parseTravelerType(enneagramType: string): number {
  return parseInt(enneagramType.replace(/\D/g, ""), 10) || 0;
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
    }, 8000);

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
      {/* Magnifying glass — unchanged per spec */}
      <div className="text-5xl mb-6 animate-pulse">🔍</div>

      {/* Content area */}
      <div
        className="max-w-sm w-full min-h-[100px] flex flex-col items-center justify-center transition-opacity duration-400"
        style={{ opacity: visible ? 1 : 0 }}
      >
        {!contentReady || !item ? (
          /* Fallback while parallel call is pending */
          <p className="text-[#3D5A6E] dark:text-[#B8D4E3] font-medium">
            Finding what fits you in {destination || "your destination"}&hellip;
          </p>
        ) : item.type === "fact" ? (
          /* Destination fact */
          <>
            <p className="text-[11px] font-semibold tracking-widest text-[#C4956A] uppercase mb-3">
              While you wait
            </p>
            <p className="text-[#3D5A6E] dark:text-[#B8D4E3] text-sm leading-relaxed">
              {item.text}
            </p>
          </>
        ) : item.traveler === "both" ? (
          /* Group recommendation — no avatar */
          <p className="text-[#3D5A6E] dark:text-[#B8D4E3] text-sm leading-relaxed">
            {item.text}
          </p>
        ) : (
          /* Named traveler recommendation — show avatar chip */
          <>
            {itemTraveler && (
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-full bg-[#5B8BA0] dark:bg-[#3D5A6E] flex items-center justify-center text-white text-xs font-semibold flex-shrink-0">
                  {travelerInitial(itemTraveler.name)}
                </div>
                <span className="text-xs font-medium text-[#3D5A6E] dark:text-[#B8D4E3]">
                  {itemTraveler.name}
                  <span className="text-[#9BB0C1] dark:text-[#6B8299] font-normal ml-1">
                    · Type {parseTravelerType(itemTraveler.enneagramType)}
                  </span>
                </span>
              </div>
            )}
            <p className="text-[#3D5A6E] dark:text-[#B8D4E3] text-sm leading-relaxed">
              {item.text}
            </p>
          </>
        )}
      </div>

      {/* Timing subline — unchanged per spec */}
      <p className="text-sm text-[#6B8299] dark:text-[#9BB0C1] mt-6">
        This may take 15–30 seconds
      </p>
    </div>
  );
}
