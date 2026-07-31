"use client";

import { useEffect, useRef, useState } from "react";

const VIDEOS = [
  "/hero-videos/AdobeStock_213174987.mp4",  // 2.7MB — loads first
  "/hero-videos/AdobeStock_1917925959.mp4", // 6.8MB
  "/hero-videos/AdobeStock_210635397.mp4",  // 7.0MB
  "/hero-videos/AdobeStock_572285551.mp4",  // 8.2MB
  "/hero-videos/AdobeStock_939625404.mp4",  // 9.2MB
  "/hero-videos/AdobeStock_219448182.mp4",  // 12MB
];

const DISPLAY_DURATION = 5000; // ms each video is shown
const FADE_DURATION    = 800;  // ms crossfade

export default function HeroVideoCarousel() {
  const [current, setCurrent] = useState(0);
  const [next, setNext]       = useState<number | null>(null);
  const [fading, setFading]   = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function advance() {
      const nextIdx = (current + 1) % VIDEOS.length;
      setNext(nextIdx);
      setFading(true);

      // After fade completes, swap current and reset
      timerRef.current = setTimeout(() => {
        setCurrent(nextIdx);
        setNext(null);
        setFading(false);
      }, FADE_DURATION);
    }

    const interval = setInterval(advance, DISPLAY_DURATION);
    return () => {
      clearInterval(interval);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [current]);

  const sharedStyle: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover",
  };

  return (
    <>
      {/* Current video */}
      <video
        key={current}
        autoPlay
        muted
        loop
        playsInline
        style={{ ...sharedStyle, zIndex: 0, opacity: fading ? 0 : 1, transition: `opacity ${FADE_DURATION}ms ease` }}
      >
        <source src={VIDEOS[current]} type="video/mp4" />
      </video>

      {/* Next video — fades in on top */}
      {next !== null && (
        <video
          key={next}
          autoPlay
          muted
          playsInline
          style={{ ...sharedStyle, zIndex: 1, opacity: fading ? 1 : 0, transition: `opacity ${FADE_DURATION}ms ease` }}
        >
          <source src={VIDEOS[next]} type="video/mp4" />
        </video>
      )}
    </>
  );
}
