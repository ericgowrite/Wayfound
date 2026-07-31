"use client";

import { useEffect, useRef } from "react";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";

interface Props {
  onDone: () => void;
}

export default function DashboardTour({ onDone }: Props) {
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const doneCalledRef = { current: false };
    // On mobile the sidebar is hidden off-screen — targeting sidebar elements
    // causes Driver.js to position the popover outside the viewport, making
    // the Next/Back buttons unreachable. Use floating popovers instead.
    const mobile = window.innerWidth < 768;

    const driverObj = driver({
      animate: true,
      overlayOpacity: 0.65,
      stagePadding: 10,
      allowClose: true,
      overlayClickBehavior: "close",
      nextBtnText: "Next →",
      prevBtnText: "← Back",
      doneBtnText: "Start exploring →",
      onPopoverRender: (popover) => {
        popover.closeButton.innerHTML = "Skip tour";
      },
      onDestroyed: () => {
        if (!doneCalledRef.current) {
          doneCalledRef.current = true;
          onDoneRef.current();
        }
      },
      steps: [
        {
          ...(mobile ? {} : { element: "#tour-travelers" }),
          popover: {
            title: "Your Travelers",
            description:
              "This is you — how viyaway knows what fits when you travel. Tap your name anytime to view or update your travel style.",
          },
        },
        {
          ...(mobile ? {} : { element: "#tour-add-traveler" }),
          popover: {
            title: "Add a Travel Companion",
            description:
              "Traveling with someone? Add them here. viyaway finds what fits everyone — not just a compromise.",
          },
        },
        {
          ...(mobile ? {} : { element: "#tour-trips" }),
          popover: {
            title: "Your Experiences",
            description:
              "Each experience is its own space — search, save, and explore options for wherever you're headed. Your finds stay organized and ready when you need them.",
          },
        },
        {
          ...(mobile ? {} : { element: "#tour-create-trip" }),
          popover: {
            title: "Create an Experience",
            description:
              "Pick your destination and let viyaway find what fits. That's all there is to it.",
          },
        },
      ],
    });

    driverObj.drive();

    return () => {
      doneCalledRef.current = true; // prevent onDone from firing on unmount cleanup
      try { if (driverObj.isActive()) driverObj.destroy(); } catch {}
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
